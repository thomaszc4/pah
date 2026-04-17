import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: booking } = await service
    .from('bookings')
    .select('id, deaf_user_id, interpreter_id, status')
    .eq('id', id)
    .single();
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify caller is the assigned interpreter
  const { data: interp } = await service
    .from('interpreter_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!interp || interp.id !== booking.interpreter_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await service
    .from('bookings')
    .update({ status: 'interpreter_en_route', interpreter_en_route_at: new Date().toISOString() })
    .eq('id', id);

  if (booking.deaf_user_id) {
    await sendNotification({
      userId: booking.deaf_user_id,
      type: 'interpreter_en_route',
      title: 'Your interpreter is on the way',
      body: 'Track their location from the booking page.',
      data: { booking_id: id },
    });
  }

  return NextResponse.json({ ok: true });
}
