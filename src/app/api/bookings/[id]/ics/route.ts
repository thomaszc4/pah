import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { buildIcs } from '@/lib/calendar/ics';

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

/**
 * GET /api/bookings/[id]/ics
 * Returns an iCalendar .ics file for the booking, downloadable/pasteable into
 * Google Calendar, Outlook, Apple Calendar, or many EHR scheduling modules.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // RLS on bookings will scope this to participants only.
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_start, scheduled_end, specialization_required, location_type,
      address_line1, address_line2, city, state, zip, public_notes,
      client_name, client_email,
      organization:organizations(name, email),
      interpreter:interpreter_profiles(
        profiles:user_id(full_name, email)
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (!booking || !booking.scheduled_start || !booking.scheduled_end) {
    return NextResponse.json({ error: 'Booking not found or missing schedule' }, { status: 404 });
  }

  const interp = (booking.interpreter as unknown as {
    profiles: { full_name: string; email: string } | null;
  } | null);
  const interpName = interp?.profiles?.full_name ?? 'Interpreter';
  const interpEmail = interp?.profiles?.email;

  const org = (booking.organization as unknown as { name: string; email: string } | null);

  const locationLine = booking.location_type === 'vri'
    ? 'Video Remote Interpreting (VRI)'
    : [booking.address_line1, booking.city, booking.state, booking.zip].filter(Boolean).join(', ');

  const specLabel = booking.specialization_required.replace(/_/g, ' ');

  const description = [
    `ASL ${specLabel} interpreting`,
    booking.client_name ? `Client: ${booking.client_name}` : null,
    org?.name ? `For: ${org.name}` : null,
    `Interpreter: ${interpName}`,
    booking.public_notes ? `Notes: ${booking.public_notes}` : null,
    `Details & chat: ${process.env.NEXT_PUBLIC_APP_URL || ''}/bookings/${booking.id}`,
  ].filter(Boolean).join('\n');

  const attendees = [];
  if (interpEmail) attendees.push({ displayName: interpName, email: interpEmail });
  if (booking.client_email) attendees.push({ displayName: booking.client_name ?? 'Client', email: booking.client_email });

  const ics = buildIcs({
    uid: booking.id,
    summary: `ASL Interpreter — ${specLabel}`,
    description,
    location: locationLine,
    startUtc: booking.scheduled_start,
    endUtc: booking.scheduled_end,
    organizerEmail: org?.email ?? undefined,
    attendees,
    url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/bookings/${booking.id}`,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="pah-booking-${booking.id.slice(0, 8)}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
