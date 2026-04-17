import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
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

const MAX_REMATCHES = 3;

export async function POST(
  request: Request,
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
    .select('*')
    .eq('id', id)
    .single();
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (booking.deaf_user_id !== user.id && booking.requested_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['offered', 'confirmed'].includes(booking.status)) {
    return NextResponse.json({ error: 'Booking not eligible for rematch' }, { status: 400 });
  }
  if ((booking.rematch_count ?? 0) >= MAX_REMATCHES) {
    return NextResponse.json({ error: `Rematch limit reached (${MAX_REMATCHES})` }, { status: 400 });
  }

  // Block scheduled-start threshold — no rematch within 4 hours of start
  if (booking.scheduled_start) {
    const hoursUntil = (new Date(booking.scheduled_start).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 4) {
      return NextResponse.json(
        { error: 'Rematch not allowed within 4 hours of the appointment.' },
        { status: 400 },
      );
    }
  }

  const previousInterpId = booking.interpreter_id;

  // Mark any pending offer to the previous interpreter as declined / superseded
  if (previousInterpId) {
    await service
      .from('booking_offers')
      .update({ status: 'declined', decline_reason: 'user_rematch_requested' })
      .eq('booking_id', id)
      .eq('interpreter_id', previousInterpId)
      .in('status', ['pending', 'accepted']);

    // Notify the previous interpreter their offer was revoked
    const { data: prevInterp } = await service
      .from('interpreter_profiles')
      .select('user_id')
      .eq('id', previousInterpId)
      .single();
    if (prevInterp) {
      await sendNotification({
        userId: prevInterp.user_id,
        type: 'booking_reassigned',
        title: 'Assignment revoked',
        body: 'The client has requested a different interpreter for this booking.',
        data: { booking_id: id },
      });
    }
  }

  // Collect everyone already declined/offered
  const { data: pastOffers } = await service
    .from('booking_offers')
    .select('interpreter_id')
    .eq('booking_id', id);
  const excludeIds = (pastOffers || []).map((o: { interpreter_id: string }) => o.interpreter_id);

  const match = await findAvailableInterpreter({
    specialization: booking.specialization_required,
    scheduledStart: booking.scheduled_start,
    scheduledEnd: booking.scheduled_end,
    excludeInterpreterIds: excludeIds,
    deafUserId: booking.deaf_user_id,
    preferences: booking.interpreter_preferences_snapshot,
  });

  if (!match) {
    await service
      .from('bookings')
      .update({
        interpreter_id: null,
        status: 'no_match',
        rematch_count: (booking.rematch_count ?? 0) + 1,
      })
      .eq('id', id);
    return NextResponse.json({ ok: true, matched: false });
  }

  await service
    .from('bookings')
    .update({
      interpreter_id: match.interpreterId,
      status: 'offered',
      rematch_count: (booking.rematch_count ?? 0) + 1,
    })
    .eq('id', id);

  await service.from('booking_offers').insert({
    booking_id: id,
    interpreter_id: match.interpreterId,
    offer_order: excludeIds.length + 1,
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

  await service.from('audit_log').insert({
    user_id: user.id,
    action: 'rematch_requested',
    resource_type: 'booking',
    resource_id: id,
    metadata: { previous_interpreter_id: previousInterpId },
  });

  return NextResponse.json({ ok: true, matched: true });
}
