import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { findAvailableInterpreter } from '@/lib/matching/algorithm';
import { isRushBooking, calculateClientCharge } from '@/lib/utils/pricing';
import { PLATFORM_RATES } from '@/types';

// Create authenticated supabase client for the current user
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

// Service role client for admin operations
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await getAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      specialization_required = 'general',
      location_type = 'in_person',
      booking_type = 'scheduled',
      scheduled_start,
      scheduled_end,
      estimated_duration_minutes = 120,
      address_line1,
      city,
      state,
      zip,
      public_notes,
      organization_name,
      organization_id: providedOrgId,
      booking_context = 'personal',
      authorized_max_minutes,
    } = body;

    // Determine rush pricing
    const rush = scheduled_start
      ? isRushBooking(new Date(scheduled_start))
      : true; // Urgent bookings are always rush

    const baseRateCents = location_type === 'in_person'
      ? PLATFORM_RATES.in_person_hourly_cents
      : PLATFORM_RATES.vri_hourly_cents;

    const rushMultiplier = rush ? PLATFORM_RATES.rush_multiplier : 1.0;

    // Calculate estimated charge
    const { totalChargeCents } = calculateClientCharge({
      locationType: location_type,
      durationMinutes: estimated_duration_minutes,
      isRush: rush,
    });

    const serviceClient = getServiceClient();

    // Resolve organization: use provided ID (from autocomplete) or search by name
    let organizationId: string | null = providedOrgId || null;
    if (!organizationId && booking_context === 'business' && organization_name) {
      const { data: existingOrg } = await serviceClient
        .from('organizations')
        .select('id')
        .ilike('name', organization_name)
        .limit(1)
        .single();

      if (existingOrg) {
        organizationId = existingOrg.id;
      }
    }

    // Determine initial status based on whether an org is involved
    // If business context with a registered org → needs business approval first
    // If personal or no org → go straight to matching
    const needsBusinessApproval = booking_context === 'business' && organizationId;
    const initialStatus = needsBusinessApproval ? 'pending_business_approval' : 'matching';

    // Create the booking
    const { data: booking, error: bookingError } = await serviceClient
      .from('bookings')
      .insert({
        deaf_user_id: user.id,
        requested_by: user.id,
        booking_type,
        specialization_required,
        location_type,
        scheduled_start,
        scheduled_end,
        estimated_duration_minutes,
        address_line1,
        city,
        state,
        zip,
        public_notes,
        base_rate_cents: baseRateCents,
        rush_multiplier: rushMultiplier,
        total_charge_cents: totalChargeCents,
        organization_id: organizationId,
        authorized_max_minutes: authorized_max_minutes || null,
        status: initialStatus,
      })
      .select()
      .single();

    if (bookingError) {
      return NextResponse.json({ error: bookingError.message }, { status: 500 });
    }

    // Audit log
    await serviceClient.from('audit_log').insert({
      user_id: user.id,
      action: 'create_booking',
      resource_type: 'booking',
      resource_id: booking.id,
      metadata: { booking_type, specialization_required, needs_business_approval: !!needsBusinessApproval },
    });

    // If business approval needed, notify org admins and return
    if (needsBusinessApproval) {
      // Notify all org owners/admins
      const { data: orgMembers } = await serviceClient
        .from('organization_members')
        .select('user_id')
        .eq('org_id', organizationId)
        .in('role', ['owner', 'admin']);

      if (orgMembers) {
        const notifications = orgMembers.map((m: { user_id: string }) => ({
          user_id: m.user_id,
          type: 'booking_approval_needed',
          title: 'New Interpreter Request',
          body: `A Deaf client has requested a ${specialization_required} interpreter. Please review and approve or decline.`,
          data: { booking_id: booking.id },
        }));
        await serviceClient.from('notifications').insert(notifications);
      }

      return NextResponse.json({ ...booking, status: 'pending_business_approval' });
    }

    // No business approval needed — try to match immediately
    const match = await findAvailableInterpreter({
      specialization: specialization_required,
      scheduledStart: scheduled_start,
      scheduledEnd: scheduled_end,
    });

    if (match) {
      // For personal bookings, auto-confirm. For matched bookings, offer to interpreter.
      await serviceClient
        .from('bookings')
        .update({
          interpreter_id: match.interpreterId,
          status: 'offered',
        })
        .eq('id', booking.id);

      // Create offer record
      await serviceClient.from('booking_offers').insert({
        booking_id: booking.id,
        interpreter_id: match.interpreterId,
        offer_order: 1,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        match_score: 1.0,
        distance_miles: 0,
      });

      // Notify interpreter to accept/decline
      await serviceClient.from('notifications').insert({
        user_id: match.userId,
        type: 'new_booking_offer',
        title: 'New Job Offer',
        body: `You've been offered a ${specialization_required} interpreting job. Please accept or decline.`,
        data: { booking_id: booking.id },
      });

      return NextResponse.json({ ...booking, status: 'offered' });
    }

    // No match found — stays in 'matching' status
    await serviceClient
      .from('bookings')
      .update({ status: 'no_match' })
      .eq('id', booking.id);

    return NextResponse.json({ ...booking, status: 'no_match' });
  } catch (err) {
    console.error('Booking creation error:', err);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await getAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role') || 'deaf_user';

    let query = supabase.from('bookings').select('*');

    if (role === 'interpreter') {
      // Get interpreter profile ID first
      const { data: interpProfile } = await supabase
        .from('interpreter_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (interpProfile) {
        query = query.eq('interpreter_id', interpProfile.id);
      }
    } else {
      query = query.eq('deaf_user_id', user.id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('scheduled_start', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Booking list error:', err);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}
