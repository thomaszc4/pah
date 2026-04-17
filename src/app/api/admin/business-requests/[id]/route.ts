import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getServiceClient } from '@/lib/auth/admin';

const schema = z.object({
  status: z.enum(['pending', 'contacted', 'registered', 'declined']),
  admin_notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
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

  const { data, error } = await service
    .from('business_registration_requests')
    .update({
      status: parsed.data.status,
      admin_notes: parsed.data.admin_notes ?? null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await service.from('audit_log').insert({
    user_id: admin.id,
    action: `admin_business_request_${parsed.data.status}`,
    resource_type: 'business_registration_request',
    resource_id: id,
    metadata: { notes: parsed.data.admin_notes },
  });

  return NextResponse.json(data);
}
