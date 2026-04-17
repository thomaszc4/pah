import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { haversineMiles, estimateEtaMinutes } from '@/lib/utils/geo';

async function getAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch { /* ignore */ }
        },
      },
    },
  );
}

const schema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

const MIN_INTERVAL_MS = 15_000;

// In-memory rate limiter — fine for single-instance dev; replace with Redis in prod.
const lastPush = new Map<string, number>();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const key = `${user.id}:${id}`;
  const last = lastPush.get(key) || 0;
  if (Date.now() - last < MIN_INTERVAL_MS) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }
  lastPush.set(key, Date.now());

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: booking } = await service
    .from('bookings')
    .select('id, interpreter_id, lat, lng, status')
    .eq('id', id)
    .single();
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['confirmed', 'interpreter_en_route'].includes(booking.status)) {
    return NextResponse.json({ error: 'Booking not active' }, { status: 400 });
  }

  const { data: interp } = await service
    .from('interpreter_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!interp || interp.id !== booking.interpreter_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Compute ETA
  let etaMinutes: number | null = null;
  if (booking.lat !== null && booking.lng !== null) {
    const miles = haversineMiles(
      { lat: parsed.data.lat, lng: parsed.data.lng },
      { lat: Number(booking.lat), lng: Number(booking.lng) },
    );
    etaMinutes = estimateEtaMinutes(miles);
  }

  const { error: insertErr } = await service.from('interpreter_locations').insert({
    booking_id: id,
    interpreter_id: interp.id,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    eta_minutes: etaMinutes,
  });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Keep booking.interpreter_eta_minutes in sync so server-rendered pages see it.
  await service
    .from('bookings')
    .update({ interpreter_eta_minutes: etaMinutes })
    .eq('id', id);

  // Also update the interpreter's last known position for future matching.
  await service
    .from('interpreter_profiles')
    .update({
      current_lat: parsed.data.lat,
      current_lng: parsed.data.lng,
      last_location_update: new Date().toISOString(),
    })
    .eq('id', interp.id);

  return NextResponse.json({ ok: true, eta_minutes: etaMinutes });
}
