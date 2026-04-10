import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { calculateCancellationFee } from '@/lib/utils/pricing';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = getServiceClient();
  const { data: booking, error } = await serviceClient
    .from('bookings')
    .select(`
      *,
      interpreter:interpreter_profiles(
        id,
        user_id,
        bio,
        experience_tier,
        specializations,
        avg_rating,
        total_jobs,
        profiles:user_id(full_name, avatar_url)
      ),
      organization:organizations(name, org_type)
    `)
    .eq('id', id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  // Audit log
  await serviceClient.from('audit_log').insert({
    user_id: user.id,
    action: 'view_booking',
    resource_type: 'booking',
    resource_id: id,
  });

  return NextResponse.json(booking);
}

export async function PATCH(
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
  const { action, ...updateData } = body;
  const serviceClient = getServiceClient();

  // Get current booking
  const { data: booking } = await serviceClient
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  let updates: Record<string, unknown> = {};

  switch (action) {
    case 'cancel': {
      if (['completed', 'billed', 'cancelled'].includes(booking.status)) {
        return NextResponse.json({ error: 'Cannot cancel this booking' }, { status: 400 });
      }

      const { feeCents } = calculateCancellationFee({
        scheduledStart: new Date(booking.scheduled_start),
        cancelledAt: new Date(),
        estimatedTotalCents: booking.total_charge_cents || 0,
      });

      updates = {
        status: 'cancelled',
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: updateData.reason || null,
        cancellation_fee_cents: feeCents,
      };
      break;
    }

    case 'checkin': {
      // Interpreter arrives and checks in
      updates = {
        status: 'in_progress',
        actual_start: new Date().toISOString(),
      };
      break;
    }

    case 'checkout': {
      // Interpreter completes the session
      const actualStart = booking.actual_start
        ? new Date(booking.actual_start)
        : new Date(booking.scheduled_start);
      const actualEnd = new Date();
      const actualMinutes = Math.round(
        (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60),
      );

      updates = {
        status: 'completed',
        actual_end: actualEnd.toISOString(),
        actual_duration_minutes: actualMinutes,
        wait_time_minutes: updateData.wait_time_minutes || 0,
        interpreter_notes: updateData.interpreter_notes || null,
      };
      break;
    }

    case 'en_route': {
      updates = { status: 'interpreter_en_route' };
      break;
    }

    default: {
      // Generic update (limited fields)
      const allowedFields = ['public_notes', 'scheduled_start', 'scheduled_end'];
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      }
    }
  }

  const { data: updated, error } = await serviceClient
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await serviceClient.from('audit_log').insert({
    user_id: user.id,
    action: action || 'update_booking',
    resource_type: 'booking',
    resource_id: id,
    metadata: { action, updates },
  });

  return NextResponse.json(updated);
}
