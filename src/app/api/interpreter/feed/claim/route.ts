import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { sendNotification } from '@/lib/notifications/dispatch';

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
  booking_id: z.string().uuid(),
});

/**
 * Interpreter claims an unassigned job from the feed.
 * Uses an optimistic "compare-and-swap" against status='matching' | 'no_match'
 * to prevent double-booking.
 */
export async function POST(request: Request) {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { data: interp } = await supabase
    .from('interpreter_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!interp) return NextResponse.json({ error: 'Not an interpreter' }, { status: 403 });

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Compare-and-swap: only update if still unclaimed.
  const { data: updated, error } = await service
    .from('bookings')
    .update({
      interpreter_id: interp.id,
      status: 'confirmed',
      interpreter_accepted_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.booking_id)
    .in('status', ['matching', 'no_match'])
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: 'This job was already claimed by another interpreter.' },
      { status: 409 },
    );
  }

  // Record the offer as accepted.
  await service.from('booking_offers').insert({
    booking_id: parsed.data.booking_id,
    interpreter_id: interp.id,
    offer_order: 999,
    status: 'accepted',
    expires_at: new Date().toISOString(),
    match_score: 100,
    distance_miles: 0,
  });

  // Notify the Deaf user.
  if (updated.deaf_user_id) {
    await sendNotification({
      userId: updated.deaf_user_id,
      type: 'interpreter_confirmed',
      title: 'Interpreter Confirmed',
      body: 'An interpreter has claimed your booking!',
      data: { booking_id: updated.id },
    });
  }

  return NextResponse.json({ ok: true, booking: updated });
}
