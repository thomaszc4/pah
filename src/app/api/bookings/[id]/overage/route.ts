import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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

// POST /api/bookings/[id]/overage — interpreter requests extra time
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await getAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { additional_minutes } = body;

    if (!additional_minutes || additional_minutes < 15) {
      return NextResponse.json(
        { error: 'Must request at least 15 additional minutes' },
        { status: 400 },
      );
    }

    const serviceClient = getServiceClient();

    // Verify this interpreter owns this booking
    const { data: booking } = await serviceClient
      .from('bookings')
      .select('*, interpreter_profiles!inner(user_id)')
      .eq('id', id)
      .single();

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const interpUserId = (booking.interpreter_profiles as Record<string, unknown>)?.user_id;
    if (interpUserId !== user.id) {
      return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
    }

    if (booking.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Overage can only be requested for in-progress sessions' },
        { status: 400 },
      );
    }

    // Update booking with overage request
    const { error: updateError } = await serviceClient
      .from('bookings')
      .update({
        overage_requested_at: new Date().toISOString(),
        overage_requested_minutes: additional_minutes,
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Notify org admin (if org booking)
    if (booking.organization_id) {
      const { data: orgMembers } = await serviceClient
        .from('organization_members')
        .select('user_id')
        .eq('org_id', booking.organization_id)
        .in('role', ['owner', 'admin']);

      if (orgMembers) {
        const notifications = orgMembers.map((m) => ({
          user_id: m.user_id,
          type: 'overage_request',
          title: 'Session Extension Requested',
          body: `An interpreter has requested ${additional_minutes} additional minutes for an active session.`,
          data: { booking_id: id, additional_minutes },
        }));
        await serviceClient.from('notifications').insert(notifications);
      }
    }

    // Audit log
    await serviceClient.from('audit_log').insert({
      user_id: user.id,
      action: 'request_overage',
      resource_type: 'booking',
      resource_id: id,
      metadata: { additional_minutes },
    });

    return NextResponse.json({ success: true, additional_minutes });
  } catch (err) {
    console.error('Overage request error:', err);
    return NextResponse.json(
      { error: 'Failed to request overage' },
      { status: 500 },
    );
  }
}
