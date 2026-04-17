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
          } catch { /* Server Component */ }
        },
      },
    },
  );
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * POST /api/bookings/[id]/respond
 * Interpreter accepts or declines a booking offer.
 * Body: { decision: 'accept' | 'decline', reason?: string }
 *
 * On decline, the system cascades to the next available interpreter.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { decision, reason } = body;

  if (!['accept', 'decline'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }

  const serviceClient = getServiceClient();

  // Get the booking
  const { data: booking } = await serviceClient
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.status !== 'offered') {
    return NextResponse.json(
      { error: 'Booking is not in offered status' },
      { status: 400 },
    );
  }

  // Verify this interpreter is the one who was offered
  const { data: interpProfile } = await serviceClient
    .from('interpreter_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!interpProfile || interpProfile.id !== booking.interpreter_id) {
    return NextResponse.json({ error: 'This offer is not for you' }, { status: 403 });
  }

  if (decision === 'accept') {
    // Interpreter accepts — confirm the booking
    await serviceClient
      .from('bookings')
      .update({
        status: 'confirmed',
        interpreter_accepted_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Update the offer record
    await serviceClient
      .from('booking_offers')
      .update({ status: 'accepted' })
      .eq('booking_id', id)
      .eq('interpreter_id', interpProfile.id)
      .eq('status', 'pending');

    // Notify deaf user (SMS+email via dispatch)
    if (booking.deaf_user_id) {
      await sendNotification({
        userId: booking.deaf_user_id,
        type: 'interpreter_confirmed',
        title: 'Interpreter Confirmed',
        body: 'An interpreter has accepted your booking!',
        data: { booking_id: id },
      });
    }

    // Notify org if applicable
    if (booking.organization_id) {
      const { data: orgMembers } = await serviceClient
        .from('organization_members')
        .select('user_id')
        .eq('org_id', booking.organization_id)
        .in('role', ['owner', 'admin']);

      if (orgMembers) {
        await Promise.all(
          orgMembers.map((m: { user_id: string }) =>
            sendNotification({
              userId: m.user_id,
              type: 'interpreter_confirmed',
              title: 'Interpreter Confirmed',
              body: 'An interpreter has accepted the booking request.',
              data: { booking_id: id },
            }),
          ),
        );
      }
    }

    await serviceClient.from('audit_log').insert({
      user_id: user.id,
      action: 'accept_booking',
      resource_type: 'booking',
      resource_id: id,
    });

    return NextResponse.json({ status: 'confirmed' });
  }

  // DECLINE: cascade to next interpreter
  // Mark current offer as declined
  await serviceClient
    .from('booking_offers')
    .update({ status: 'declined' })
    .eq('booking_id', id)
    .eq('interpreter_id', interpProfile.id)
    .eq('status', 'pending');

  await serviceClient
    .from('bookings')
    .update({
      interpreter_id: null,
      interpreter_declined_at: new Date().toISOString(),
      interpreter_decline_reason: reason || null,
      status: 'matching',
    })
    .eq('id', id);

  await serviceClient.from('audit_log').insert({
    user_id: user.id,
    action: 'decline_booking',
    resource_type: 'booking',
    resource_id: id,
    metadata: { reason },
  });

  // Get all interpreters who already declined this booking
  const { data: declinedOffers } = await serviceClient
    .from('booking_offers')
    .select('interpreter_id')
    .eq('booking_id', id)
    .eq('status', 'declined');

  const excludeIds = (declinedOffers || []).map((o: { interpreter_id: string }) => o.interpreter_id);

  // Find the next available interpreter (excluding those who declined), scored
  const nextMatch = await findAvailableInterpreter({
    specialization: booking.specialization_required,
    scheduledStart: booking.scheduled_start,
    scheduledEnd: booking.scheduled_end,
    excludeInterpreterIds: excludeIds,
    deafUserId: booking.deaf_user_id,
    preferences: booking.interpreter_preferences_snapshot,
    targetLat: booking.lat !== null ? Number(booking.lat) : null,
    targetLng: booking.lng !== null ? Number(booking.lng) : null,
  });

  if (nextMatch) {
    const offerOrder = excludeIds.length + 1;

    await serviceClient
      .from('bookings')
      .update({
        interpreter_id: nextMatch.interpreterId,
        status: 'offered',
        interpreter_declined_at: null,
        interpreter_decline_reason: null,
      })
      .eq('id', id);

    await serviceClient.from('booking_offers').insert({
      booking_id: id,
      interpreter_id: nextMatch.interpreterId,
      offer_order: offerOrder,
      status: 'pending',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      match_score: nextMatch.score,
      distance_miles: nextMatch.distanceMiles,
    });

    await sendNotification({
      userId: nextMatch.userId,
      type: 'new_booking_offer',
      title: 'New Job Offer',
      body: `You've been offered a ${booking.specialization_required} interpreting job. Please accept or decline.`,
      data: { booking_id: id },
    });

    return NextResponse.json({
      status: 'declined',
      next_interpreter_offered: true,
    });
  }

  // No more interpreters available
  await serviceClient
    .from('bookings')
    .update({ status: 'no_match' })
    .eq('id', id);

  if (booking.deaf_user_id) {
    await sendNotification({
      userId: booking.deaf_user_id,
      type: 'no_interpreter_available',
      title: 'No Interpreter Available',
      body: "We're having trouble finding an interpreter. You can wait, switch to VRI, or reschedule.",
      data: { booking_id: id },
    });
  }

  return NextResponse.json({
    status: 'declined',
    next_interpreter_offered: false,
  });
}
