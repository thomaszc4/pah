import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, getServiceClient } from '@/lib/auth/admin';

const schema = z.object({
  action: z.enum(['kept', 'hidden', 'removed']),
  admin_notes: z.string().max(2000).nullable().optional(),
});

/**
 * POST /api/admin/reviews/[id] — admin moderates a flagged review.
 * - kept: dismisses the flag, review stays visible
 * - hidden: review is hidden from public but kept on record
 * - removed: review is removed permanently (still audited)
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

  const updates: Record<string, unknown> = {
    admin_action: parsed.data.action,
    admin_notes: parsed.data.admin_notes ?? null,
    flagged_for_review: false,
  };
  if (parsed.data.action === 'hidden' || parsed.data.action === 'removed') {
    updates.is_visible = false;
  } else {
    updates.is_visible = true;
  }

  const { data, error } = await service
    .from('organization_ratings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Recompute aggregates
  if (data) {
    const { data: stats } = await service
      .from('organization_ratings')
      .select('overall_rating')
      .eq('organization_id', data.organization_id)
      .eq('is_visible', true);
    const count = stats?.length ?? 0;
    const avg = count > 0
      ? Math.round((stats!.reduce((a: number, r: { overall_rating: number }) => a + r.overall_rating, 0) / count) * 100) / 100
      : null;
    await service
      .from('organizations')
      .update({ avg_rating: avg, rating_count: count })
      .eq('id', data.organization_id);
  }

  await service.from('audit_log').insert({
    user_id: admin.id,
    action: `admin_review_${parsed.data.action}`,
    resource_type: 'organization_rating',
    resource_id: id,
    metadata: { notes: parsed.data.admin_notes },
  });

  return NextResponse.json({ ok: true });
}
