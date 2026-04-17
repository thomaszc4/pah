import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { findAvailableInterpreter } from '@/lib/matching/algorithm';
import { isRushBooking, calculateClientCharge } from '@/lib/utils/pricing';
import { PLATFORM_RATES } from '@/types';
import { CURRENT_ADA_NOTICE, CURRENT_VRI_WARNING } from '@/lib/attestation/ada';
import { sendNotification } from '@/lib/notifications/dispatch';

const bookingSchema = z.object({
  specialization_required: z.string().default('general'),
  specialization_other_description: z.string().nullable().optional(),
  location_type: z.enum(['in_person', 'vri']).default('in_person'),
  booking_type: z.enum(['scheduled', 'urgent', 'on_demand']).default('scheduled'),
  booking_context: z.enum(['personal', 'emergency', 'business']).default('personal'),
  scheduled_start: z.string().optional(),
  scheduled_end: z.string().optional(),
  estimated_duration_minutes: z.number().int().positive().default(120),
  address_line1: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  public_notes: z.string().nullable().optional(),
  organization_name: z.string().nullable().optional(),
  organization_id: z.string().uuid().nullable().optional(),
  authorized_max_minutes: z.number().int().positive().nullable().optional(),
  client_name: z.string().nullable().optional(),
  client_email: z.string().email().nullable().optional().or(z.literal('')),
  client_phone: z.string().nullable().optional(),
  ada_notice_version: z.string().nullable().optional(),
  vri_warning_acknowledged: z.boolean().optional(),
  vri_warning_version: z.string().nullable().optional(),
});

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

export async function POST(request: Request) {
  try {
    const supabase = await getAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = bookingSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;

    // --- #1 Restricted Booking — role-based context enforcement ---
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('roles')
      .eq('id', user.id)
      .single();
    const roles: string[] = requesterProfile?.roles ?? [];
    const isDeafUser = roles.includes('deaf_user');
    const isBusinessAdmin = roles.includes('business_admin');

    if (isDeafUser && !isBusinessAdmin && body.booking_context === 'business') {
      return NextResponse.json(
        {
          error:
            'Deaf users may only book for personal or emergency needs. For business/medical/legal visits, the business is legally responsible for providing an interpreter under the ADA. Use the "Request a business" flow.',
        },
        { status: 403 },
      );
    }

    // --- #21 Mandatory client name for business bookings ---
    if (body.booking_context === 'business' && !body.client_name?.trim()) {
      return NextResponse.json(
        { error: 'Client name is required for business bookings.' },
        { status: 400 },
      );
    }

    // --- #19 ADA acknowledgement for business bookings ---
    if (body.booking_context === 'business') {
      if (body.ada_notice_version !== CURRENT_ADA_NOTICE.version) {
        return NextResponse.json(
          { error: 'ADA acknowledgement is required for business bookings.' },
          { status: 400 },
        );
      }
    }

    // --- #20 VRI acknowledgement for business VRI bookings ---
    if (body.booking_context === 'business' && body.location_type === 'vri') {
      if (!body.vri_warning_acknowledged || body.vri_warning_version !== CURRENT_VRI_WARNING.version) {
        return NextResponse.json(
          { error: 'VRI acknowledgement is required before selecting Video Remote Interpreting.' },
          { status: 400 },
        );
      }
    }

    // --- Pricing ---
    const rush = body.scheduled_start ? isRushBooking(new Date(body.scheduled_start)) : true;
    const baseRateCents = body.location_type === 'in_person'
      ? PLATFORM_RATES.in_person_hourly_cents
      : PLATFORM_RATES.vri_hourly_cents;
    const rushMultiplier = rush ? PLATFORM_RATES.rush_multiplier : 1.0;
    const { totalChargeCents } = calculateClientCharge({
      locationType: body.location_type,
      durationMinutes: body.estimated_duration_minutes,
      isRush: rush,
    });

    const serviceClient = getServiceClient();

    // Resolve organization: use provided ID or search by name
    let organizationId: string | null = body.organization_id ?? null;
    if (!organizationId && body.booking_context === 'business' && body.organization_name) {
      const { data: existingOrg } = await serviceClient
        .from('organizations')
        .select('id')
        .ilike('name', body.organization_name)
        .limit(1)
        .single();
      if (existingOrg) organizationId = existingOrg.id;
    }

    // #22 Preference snapshot — lookup Deaf user by email if business booked for them
    let preferencesSnapshot: Record<string, unknown> | null = null;
    if (body.booking_context === 'business' && body.client_email) {
      const { data: clientProfile } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('email', body.client_email)
        .maybeSingle();
      if (clientProfile) {
        const { data: prefs } = await serviceClient
          .from('deaf_user_preferences')
          .select('*')
          .eq('user_id', clientProfile.id)
          .maybeSingle();
        if (prefs) preferencesSnapshot = prefs;
      }
    }

    const needsBusinessApproval = body.booking_context === 'business' && organizationId;
    const initialStatus = needsBusinessApproval ? 'pending_business_approval' : 'matching';

    // Insert booking
    const { data: booking, error: bookingError } = await serviceClient
      .from('bookings')
      .insert({
        deaf_user_id: isDeafUser ? user.id : null,
        requested_by: user.id,
        booking_type: body.booking_type,
        booking_context: body.booking_context,
        specialization_required: body.specialization_required,
        specialization_other_description: body.specialization_other_description ?? null,
        location_type: body.location_type,
        scheduled_start: body.scheduled_start ?? null,
        scheduled_end: body.scheduled_end ?? null,
        estimated_duration_minutes: body.estimated_duration_minutes,
        address_line1: body.address_line1 ?? null,
        city: body.city ?? null,
        state: body.state ?? null,
        zip: body.zip ?? null,
        public_notes: body.public_notes ?? null,
        base_rate_cents: baseRateCents,
        rush_multiplier: rushMultiplier,
        total_charge_cents: totalChargeCents,
        organization_id: organizationId,
        authorized_max_minutes: body.authorized_max_minutes ?? null,
        client_name: body.client_name?.trim() ?? null,
        client_email: body.client_email || null,
        client_phone: body.client_phone ?? null,
        ada_notice_acknowledged_at: body.booking_context === 'business' ? new Date().toISOString() : null,
        ada_notice_version: body.booking_context === 'business' ? body.ada_notice_version : null,
        vri_warning_acknowledged: body.vri_warning_acknowledged ?? false,
        interpreter_preferences_snapshot: preferencesSnapshot,
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
      metadata: {
        booking_type: body.booking_type,
        booking_context: body.booking_context,
        specialization_required: body.specialization_required,
        ada_version: body.ada_notice_version,
        vri_acknowledged: body.vri_warning_acknowledged,
      },
    });

    // If business approval needed, notify org admins
    if (needsBusinessApproval) {
      const { data: orgMembers } = await serviceClient
        .from('organization_members')
        .select('user_id')
        .eq('org_id', organizationId)
        .in('role', ['owner', 'admin']);

      if (orgMembers) {
        await Promise.all(
          orgMembers.map((m: { user_id: string }) =>
            sendNotification({
              userId: m.user_id,
              type: 'booking_approval_needed',
              title: 'New Interpreter Request',
              body: `A Deaf client has requested a ${body.specialization_required} interpreter. Please review and approve or decline.`,
              data: { booking_id: booking.id },
            }),
          ),
        );
      }

      return NextResponse.json({ ...booking, status: 'pending_business_approval' });
    }

    // Otherwise try to match immediately
    const match = await findAvailableInterpreter({
      specialization: body.specialization_required,
      scheduledStart: body.scheduled_start ?? new Date().toISOString(),
      scheduledEnd: body.scheduled_end ?? new Date(Date.now() + body.estimated_duration_minutes * 60 * 1000).toISOString(),
      deafUserId: isDeafUser ? user.id : null,
      preferences: preferencesSnapshot,
    });

    if (match) {
      await serviceClient
        .from('bookings')
        .update({
          interpreter_id: match.interpreterId,
          status: 'offered',
        })
        .eq('id', booking.id);

      await serviceClient.from('booking_offers').insert({
        booking_id: booking.id,
        interpreter_id: match.interpreterId,
        offer_order: 1,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        match_score: match.score ?? 1.0,
        distance_miles: match.distanceMiles ?? 0,
      });

      await sendNotification({
        userId: match.userId,
        type: 'new_booking_offer',
        title: 'New Job Offer',
        body: `You've been offered a ${body.specialization_required} interpreting job. Please accept or decline.`,
        data: { booking_id: booking.id },
      });

      return NextResponse.json({ ...booking, status: 'offered' });
    }

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
      const { data: interpProfile } = await supabase
        .from('interpreter_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (interpProfile) query = query.eq('interpreter_id', interpProfile.id);
    } else {
      query = query.eq('deaf_user_id', user.id);
    }

    if (status) query = query.eq('status', status);

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
