import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getServiceClient } from '@/lib/auth/admin';
import { calculateTier } from '@/lib/utils/tier';
import type { CertificationType } from '@/types';
import { sendNotification } from '@/lib/notifications/dispatch';

const schema = z.object({
  decision: z.enum(['verify', 'reject', 'expire']),
  reason: z.string().max(2000).nullable().optional(),
});

/**
 * Admin approve/reject a certification.
 * On verify: also recalculates the interpreter's tier and marks certifications_verified = true.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const raw = await request.json();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const service = getServiceClient();

  const { data: cert } = await service
    .from('certifications')
    .select('id, interpreter_id, cert_type')
    .eq('id', id)
    .single();

  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const newStatus =
    parsed.data.decision === 'verify'
      ? 'verified'
      : parsed.data.decision === 'reject'
      ? 'rejected'
      : 'expired';

  await service
    .from('certifications')
    .update({
      verification_status: newStatus,
      verified_by: admin.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', id);

  // If verified, recalculate tier for the interpreter and flip certifications_verified.
  if (parsed.data.decision === 'verify') {
    const { data: interp } = await service
      .from('interpreter_profiles')
      .select('id, user_id, years_experience, specializations')
      .eq('id', cert.interpreter_id)
      .single();

    if (interp) {
      const { data: allCerts } = await service
        .from('certifications')
        .select('cert_type')
        .eq('interpreter_id', interp.id)
        .eq('verification_status', 'verified');
      const certTypes = (allCerts ?? []).map((c) => c.cert_type as CertificationType);
      const { tier, hourlyRateCents } = calculateTier(
        certTypes,
        interp.years_experience,
        interp.specializations?.length || 1,
      );
      await service
        .from('interpreter_profiles')
        .update({
          experience_tier: tier,
          hourly_rate_cents: hourlyRateCents,
          certifications_verified: true,
        })
        .eq('id', interp.id);

      await sendNotification({
        userId: interp.user_id,
        type: 'cert_verified',
        title: 'Certification verified',
        body: `Your ${cert.cert_type.replace(/_/g, ' ')} certification was verified. You're now a ${tier} tier interpreter.`,
        data: { cert_id: id, tier },
      });
    }
  } else if (parsed.data.decision === 'reject') {
    const { data: interp } = await service
      .from('interpreter_profiles')
      .select('user_id')
      .eq('id', cert.interpreter_id)
      .single();
    if (interp) {
      await sendNotification({
        userId: interp.user_id,
        type: 'cert_rejected',
        title: 'Certification needs attention',
        body:
          parsed.data.reason
            ? `Your ${cert.cert_type.replace(/_/g, ' ')} certification was not verified. Reason: ${parsed.data.reason}`
            : `Your ${cert.cert_type.replace(/_/g, ' ')} certification was not verified. Please re-upload or contact support.`,
        data: { cert_id: id, reason: parsed.data.reason },
      });
    }
  }

  await service.from('audit_log').insert({
    user_id: admin.id,
    action: `admin_cert_${parsed.data.decision}`,
    resource_type: 'certification',
    resource_id: id,
    metadata: { reason: parsed.data.reason, cert_type: cert.cert_type },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
