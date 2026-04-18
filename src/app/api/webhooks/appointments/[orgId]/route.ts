import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'crypto';

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * POST /api/webhooks/appointments/[orgId]
 *
 * Generic appointment ingestion for clinics/EHR systems that want to hand
 * PAH their appointment data. The POST body is saved to
 * `external_appointment_ingests` for later processing by staff or by an
 * async worker (out of scope for this endpoint — this is the "front door").
 *
 * Auth: the clinic must pass `Authorization: Bearer <secret>` where secret
 * is a token shared out-of-band with the org admin. The hashed secret is
 * stored in the organization's `accessibility_summary.webhook_secret_hash`
 * jsonb field for this MVP (simple and avoids new tables).
 *
 * This is intentionally *not* automatic booking creation — it just queues
 * the appointment so a business admin can convert it into a PAH booking in
 * one click from their dashboard.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;

  const supabase = svc();
  const { data: org } = await supabase
    .from('organizations')
    .select('id, accessibility_summary')
    .eq('id', orgId)
    .maybeSingle();
  if (!org) return NextResponse.json({ error: 'Unknown org' }, { status: 404 });

  const expectedHash = (org.accessibility_summary as Record<string, unknown> | null)?.webhook_secret_hash as string | undefined;
  if (!expectedHash) {
    return NextResponse.json(
      { error: 'Webhook not enabled for this org. Contact admin to generate a secret.' },
      { status: 403 },
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/.exec(authHeader);
  if (!match) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }
  const candidate = match[1];
  const candidateHash = createHash('sha256').update(candidate).digest('hex');
  // Timing-safe compare
  const a = Buffer.from(candidateHash);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Accept JSON payload. The shape is intentionally loose; the org can POST
  // whatever their EHR emits. Expected keys (optional):
  //   external_id: string        // their appointment ID
  //   external_system: string    // "epic" | "athena" | "custom"
  //   scheduled_start: iso
  //   scheduled_end: iso
  //   client_name: string
  //   client_email: string
  //   client_phone: string
  //   location: string
  //   reason: string
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const externalId = typeof payload.external_id === 'string' ? payload.external_id : null;
  const externalSystem = typeof payload.external_system === 'string' ? payload.external_system : 'custom';
  if (!externalId) {
    return NextResponse.json({ error: 'external_id is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('external_appointment_ingests')
    .upsert({
      organization_id: orgId,
      external_id: externalId,
      external_system: externalSystem,
      raw_payload: payload,
      status: 'pending',
      received_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,external_system,external_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('audit_log').insert({
    action: 'appointment_webhook_ingest',
    resource_type: 'external_appointment_ingest',
    resource_id: data.id,
    metadata: { external_id: externalId, external_system: externalSystem },
  });

  return NextResponse.json({ ok: true, ingest_id: data.id });
}
