import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { hashToken } from '@/lib/invitations/tokens';
import { sendNotification } from '@/lib/notifications/dispatch';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

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

/**
 * POST /api/invite/[token] — accept or decline a booking invitation.
 *
 * If decision=accept and the caller is authenticated, the booking is linked
 * to their user (deaf_user_id set) and the invitation is marked accepted.
 * If decision=decline, invitation is declined; the booking remains valid
 * (the business still gets interpreter service) but no Deaf-user linkage.
 */
const schema = z.object({
  decision: z.enum(['accept', 'decline']),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const svc = serviceClient();
  const hash = hashToken(token);

  const { data: invitation } = await svc
    .from('booking_invitations')
    .select('*, bookings(id, organization_id, scheduled_start, requested_by)')
    .eq('token_hash', hash)
    .maybeSingle();

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found or expired.' }, { status: 404 });
  }
  if (invitation.status !== 'pending') {
    return NextResponse.json(
      { error: `This invitation was already ${invitation.status}.` },
      { status: 400 },
    );
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await svc
      .from('booking_invitations')
      .update({ status: 'expired' })
      .eq('id', invitation.id);
    return NextResponse.json({ error: 'This invitation has expired.' }, { status: 410 });
  }

  // Must be logged in to accept.
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (parsed.data.decision === 'accept') {
    if (!user) {
      return NextResponse.json(
        { error: 'You must sign in to accept this invitation.' },
        { status: 401 },
      );
    }
    // Verify the signed-in user's email matches the invitation email if one was set.
    if (invitation.email) {
      const { data: profile } = await svc
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();
      if (profile?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        return NextResponse.json(
          { error: 'This invitation is for a different email address.' },
          { status: 403 },
        );
      }
    }

    // Link the booking to the Deaf user and mark accepted.
    await svc
      .from('bookings')
      .update({ deaf_user_id: user.id })
      .eq('id', invitation.booking_id);

    await svc
      .from('booking_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        linked_user_id: user.id,
      })
      .eq('id', invitation.id);

    // Notify the business that their client accepted
    const requesterId = (invitation.bookings as { requested_by?: string } | null)?.requested_by;
    if (requesterId) {
      await sendNotification({
        userId: requesterId,
        type: 'invitation_accepted',
        title: 'Client accepted the booking invitation',
        body: 'They can now see the booking and message the interpreter.',
        data: { booking_id: invitation.booking_id },
      });
    }

    await svc.from('audit_log').insert({
      user_id: user.id,
      action: 'invitation_accepted',
      resource_type: 'booking_invitation',
      resource_id: invitation.id,
      metadata: { booking_id: invitation.booking_id },
    });

    return NextResponse.json({ ok: true, booking_id: invitation.booking_id });
  }

  // Decline
  await svc
    .from('booking_invitations')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      linked_user_id: user?.id ?? null,
    })
    .eq('id', invitation.id);

  await svc.from('audit_log').insert({
    user_id: user?.id ?? null,
    action: 'invitation_declined',
    resource_type: 'booking_invitation',
    resource_id: invitation.id,
    metadata: { booking_id: invitation.booking_id },
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/invite/[token] — read the invitation details (for the public landing page).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const svc = serviceClient();
  const hash = hashToken(token);

  const { data: invitation } = await svc
    .from('booking_invitations')
    .select(`
      id, status, expires_at, email, full_name,
      bookings(
        id, scheduled_start, scheduled_end, location_type,
        address_line1, city, state, specialization_required,
        organization:organizations(name, org_type)
      )
    `)
    .eq('token_hash', hash)
    .maybeSingle();

  if (!invitation) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(invitation);
}
