import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { findAvailableInterpreter } from '@/lib/matching/algorithm';

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
 * POST /api/bookings/[id]/approve
 * Business admin approves or rejects a booking request.
 * Body: { decision: 'approve' | 'reject', reason?: string }
 *
 * After approval, the system finds an interpreter and sends them an offer.
 * If rejected, the deaf user is notified.
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

  if (!['approve', 'reject'].includes(decision)) {
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

  if (booking.status !== 'pending_business_approval') {
    return NextResponse.json(
      { error: 'Booking is not pending approval' },
      { status: 400 },
    );
  }

  // Verify the user is an owner/admin of the booking's organization
  const { data: membership } = await serviceClient
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('org_id', booking.organization_id)
    .in('role', ['owner', 'admin'])
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Not authorized for this organization' }, { status: 403 });
  }

  if (decision === 'reject') {
    await serviceClient
      .from('bookings')
      .update({
        status: 'cancelled',
        business_rejected_at: new Date().toISOString(),
        business_rejected_by: user.id,
        business_rejection_reason: reason || 'Declined by organization',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: reason || 'Declined by organization',
      })
      .eq('id', id);

    // Notify the deaf user
    await serviceClient.from('notifications').insert({
      user_id: booking.deaf_user_id,
      type: 'booking_rejected',
      title: 'Booking Request Declined',
      body: reason
        ? `Your interpreter request was declined: ${reason}`
        : 'Your interpreter request was declined by the organization.',
      data: { booking_id: id },
    });

    await serviceClient.from('audit_log').insert({
      user_id: user.id,
      action: 'reject_booking',
      resource_type: 'booking',
      resource_id: id,
      metadata: { reason },
    });

    return NextResponse.json({ status: 'rejected' });
  }

  // APPROVE: update the booking and start interpreter matching
  await serviceClient
    .from('bookings')
    .update({
      business_approved_at: new Date().toISOString(),
      business_approved_by: user.id,
      status: 'matching',
    })
    .eq('id', id);

  // Try to find an interpreter
  const match = await findAvailableInterpreter({
    specialization: booking.specialization_required,
    scheduledStart: booking.scheduled_start,
    scheduledEnd: booking.scheduled_end,
  });

  if (match) {
    // Offer to interpreter (they need to accept)
    await serviceClient
      .from('bookings')
      .update({
        interpreter_id: match.interpreterId,
        status: 'offered',
      })
      .eq('id', id);

    await serviceClient.from('booking_offers').insert({
      booking_id: id,
      interpreter_id: match.interpreterId,
      offer_order: 1,
      status: 'pending',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      match_score: 1.0,
      distance_miles: 0,
    });

    await serviceClient.from('notifications').insert({
      user_id: match.userId,
      type: 'new_booking_offer',
      title: 'New Job Offer',
      body: `You've been offered a ${booking.specialization_required} interpreting job. Please accept or decline.`,
      data: { booking_id: id },
    });
  } else {
    // No match — stays in 'matching'
    await serviceClient
      .from('bookings')
      .update({ status: 'no_match' })
      .eq('id', id);
  }

  // Notify deaf user that business approved
  await serviceClient.from('notifications').insert({
    user_id: booking.deaf_user_id,
    type: 'booking_approved',
    title: 'Request Approved',
    body: match
      ? 'Your interpreter request was approved! An interpreter has been offered the job.'
      : 'Your interpreter request was approved! We\'re searching for an available interpreter.',
    data: { booking_id: id },
  });

  await serviceClient.from('audit_log').insert({
    user_id: user.id,
    action: 'approve_booking',
    resource_type: 'booking',
    resource_id: id,
  });

  return NextResponse.json({
    status: 'approved',
    interpreter_matched: !!match,
  });
}
