import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { z } from 'zod';
import { CURRENT_BUSINESS_EMERGENCY_CONFIRMATION } from '@/lib/attestation/ada';
import { sendNotification } from '@/lib/notifications/dispatch';

const schema = z.object({
  signer_name: z.string().min(2).max(200),
  signer_title: z.string().max(200).nullable().optional(),
  version: z.string(),
  booking_id: z.string().uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  if (parsed.data.version !== CURRENT_BUSINESS_EMERGENCY_CONFIRMATION.version) {
    return NextResponse.json({ error: 'Stale version' }, { status: 400 });
  }

  const hash = createHash('sha256').update(token).digest('hex');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, deaf_user_id, ada_notice_acknowledged_at')
    .eq('id', parsed.data.booking_id)
    .eq('emergency_attestation_token', hash)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
  if (booking.ada_notice_acknowledged_at) {
    return NextResponse.json({ ok: true, already: true });
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = (forwardedFor || '').split(',')[0].trim() || null;

  await supabase
    .from('bookings')
    .update({
      ada_notice_acknowledged_at: new Date().toISOString(),
      ada_notice_version: parsed.data.version,
    })
    .eq('id', booking.id);

  await supabase.from('audit_log').insert({
    user_id: null,
    action: 'business_ada_confirmation',
    resource_type: 'booking',
    resource_id: booking.id,
    ip_address: ip,
    metadata: {
      signer_name: parsed.data.signer_name,
      signer_title: parsed.data.signer_title ?? null,
      version: parsed.data.version,
      version_hash: CURRENT_BUSINESS_EMERGENCY_CONFIRMATION.hash,
    },
  });

  if (booking.deaf_user_id) {
    await sendNotification({
      userId: booking.deaf_user_id,
      type: 'business_confirmed_ada',
      title: 'Business confirmed payment',
      body: `${parsed.data.signer_name} confirmed that the business accepts ADA payment responsibility.`,
      data: { booking_id: booking.id },
    });
  }

  return NextResponse.json({ ok: true });
}
