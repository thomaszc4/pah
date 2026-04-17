import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { findAvailableInterpreter } from '@/lib/matching/algorithm';
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
  option: z.enum(['wait', 'vri', 'reschedule', 'cancel']),
  new_scheduled_start: z.string().optional(),
  new_scheduled_end: z.string().optional(),
});

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

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: booking } = await service
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (booking.deaf_user_id !== user.id && booking.requested_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { option } = parsed.data;
  const updates: Record<string, unknown> = { fallback_option_chosen: option };

  if (option === 'wait') {
    // Just record the choice; keep status matching so the system keeps trying.
    updates.status = 'matching';
  } else if (option === 'vri') {
    updates.location_type = 'vri';
    updates.status = 'matching';
  } else if (option === 'reschedule') {
    if (!parsed.data.new_scheduled_start || !parsed.data.new_scheduled_end) {
      return NextResponse.json({ error: 'New time required' }, { status: 400 });
    }
    updates.scheduled_start = parsed.data.new_scheduled_start;
    updates.scheduled_end = parsed.data.new_scheduled_end;
    updates.status = 'matching';
  } else if (option === 'cancel') {
    updates.status = 'cancelled';
    updates.cancelled_by = user.id;
    updates.cancelled_at = new Date().toISOString();
    updates.cancellation_reason = 'no_match_user_cancelled';
  }

  await service.from('bookings').update(updates).eq('id', id);

  await service.from('audit_log').insert({
    user_id: user.id,
    action: 'fallback_choice',
    resource_type: 'booking',
    resource_id: id,
    metadata: { option },
  });

  // Re-run matching for wait/vri/reschedule
  if (option !== 'cancel') {
    const match = await findAvailableInterpreter({
      specialization: booking.specialization_required,
      scheduledStart: (updates.scheduled_start as string) ?? booking.scheduled_start,
      scheduledEnd: (updates.scheduled_end as string) ?? booking.scheduled_end,
      deafUserId: booking.deaf_user_id,
      preferences: booking.interpreter_preferences_snapshot,
    });
    if (match) {
      await service
        .from('bookings')
        .update({ interpreter_id: match.interpreterId, status: 'offered' })
        .eq('id', id);
      await service.from('booking_offers').insert({
        booking_id: id,
        interpreter_id: match.interpreterId,
        offer_order: 1,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        match_score: match.score,
        distance_miles: match.distanceMiles,
      });
      await sendNotification({
        userId: match.userId,
        type: 'new_booking_offer',
        title: 'New Job Offer',
        body: `You've been offered a ${booking.specialization_required} interpreting job.`,
        data: { booking_id: id },
      });
    }
  }

  return NextResponse.json({ ok: true, option });
}
