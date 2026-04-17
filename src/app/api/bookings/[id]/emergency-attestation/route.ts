import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { sendEmail } from '@/lib/notifications/email';
import { sendSms } from '@/lib/notifications/sms';
import { CURRENT_EMERGENCY_ATTESTATION } from '@/lib/attestation/ada';

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
  signer_name: z.string().min(2).max(200),
  attestation_version: z.string(),
  business_name: z.string().min(2).max(200),
  business_contact: z.string().min(3).max(200),
});

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function generateToken(): string {
  const raw = randomBytes(24).toString('base64url');
  return raw;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

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
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  if (parsed.data.attestation_version !== CURRENT_EMERGENCY_ATTESTATION.version) {
    return NextResponse.json({ error: 'Stale attestation version' }, { status: 400 });
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Verify the caller owns this emergency booking
  const { data: booking } = await service
    .from('bookings')
    .select('id, deaf_user_id, booking_context, booking_type')
    .eq('id', id)
    .single();
  if (!booking || booking.deaf_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = (forwardedFor || '').split(',')[0].trim() || null;

  const token = generateToken();
  const hashed = tokenHash(token);

  await service
    .from('bookings')
    .update({
      emergency_attestation_signed_at: new Date().toISOString(),
      emergency_attestation_ip: ip,
      emergency_attestation_name: parsed.data.signer_name,
      emergency_attestation_token: hashed,
      emergency_attestation_version: parsed.data.attestation_version,
    })
    .eq('id', id);

  await service.from('audit_log').insert({
    user_id: user.id,
    action: 'sign_emergency_attestation',
    resource_type: 'booking',
    resource_id: id,
    ip_address: ip,
    metadata: {
      signer_name: parsed.data.signer_name,
      version: parsed.data.attestation_version,
      version_hash: CURRENT_EMERGENCY_ATTESTATION.hash,
    },
  });

  // Send confirmation request to business contact
  const confirmUrl = `${appUrl()}/confirm/${token}`;
  const subject = 'Urgent interpreter request — please confirm ADA payment';
  const text =
    `A Deaf client has requested an urgent interpreter at ${parsed.data.business_name}.\n\n` +
    `Under the ADA, the business is legally responsible for providing and paying for ` +
    `qualified interpreters. Please confirm authorization:\n\n${confirmUrl}\n\n` +
    `If we don't hear back within one hour, the Deaf client may be temporarily charged ` +
    `with a right to seek reimbursement.`;

  const contact = parsed.data.business_contact;
  if (contact.includes('@')) {
    await sendEmail({ to: contact, subject, text });
  } else {
    await sendSms({
      to: contact,
      body: `PAH: Urgent ADA interpreter request at ${parsed.data.business_name}. Confirm: ${confirmUrl}`,
    });
  }

  return NextResponse.json({ ok: true, token_sent: true });
}
