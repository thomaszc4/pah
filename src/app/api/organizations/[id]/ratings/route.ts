import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';

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

function getService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * GET /api/organizations/[id]/ratings — public list of visible ratings.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getService();
  const { data: ratings } = await supabase
    .from('organization_ratings')
    .select('id, overall_rating, attributes, review_text, business_response, business_response_at, created_at')
    .eq('organization_id', id)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(50);
  return NextResponse.json(ratings ?? []);
}

const postSchema = z.object({
  booking_id: z.string().uuid(),
  overall_rating: z.number().int().min(1).max(5),
  attributes: z.record(z.string(), z.boolean()).optional(),
  review_text: z.string().max(2000).nullable().optional(),
});

/**
 * POST /api/organizations/[id]/ratings — leave a review.
 * Verified-visit gated: only callers with a 'completed' or 'billed' booking at
 * the org can rate, and only once per booking.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await request.json();
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const service = getService();

  // Verified-visit gate: the booking must belong to this user (as deaf_user)
  // at this org and be completed.
  const { data: booking } = await service
    .from('bookings')
    .select('id, deaf_user_id, organization_id, status')
    .eq('id', parsed.data.booking_id)
    .single();
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.deaf_user_id !== user.id) {
    return NextResponse.json({ error: 'You can only review bookings you attended.' }, { status: 403 });
  }
  if (booking.organization_id !== orgId) {
    return NextResponse.json({ error: 'Booking was not at this organization.' }, { status: 400 });
  }
  if (!['completed', 'billed'].includes(booking.status)) {
    return NextResponse.json({ error: 'You can only review completed bookings.' }, { status: 400 });
  }

  // Insert (unique index on booking_id+rated_by prevents duplicates)
  const { data: created, error } = await service
    .from('organization_ratings')
    .insert({
      organization_id: orgId,
      booking_id: parsed.data.booking_id,
      rated_by: user.id,
      overall_rating: parsed.data.overall_rating,
      attributes: parsed.data.attributes ?? {},
      review_text: parsed.data.review_text ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Recompute aggregates
  const { data: stats } = await service
    .from('organization_ratings')
    .select('overall_rating')
    .eq('organization_id', orgId)
    .eq('is_visible', true);
  if (stats && stats.length > 0) {
    const sum = stats.reduce((a: number, r: { overall_rating: number }) => a + r.overall_rating, 0);
    const avg = Math.round((sum / stats.length) * 100) / 100;
    await service
      .from('organizations')
      .update({ avg_rating: avg, rating_count: stats.length })
      .eq('id', orgId);
  }

  await service.from('audit_log').insert({
    user_id: user.id,
    action: 'create_organization_rating',
    resource_type: 'organization_rating',
    resource_id: created.id,
    metadata: { organization_id: orgId, rating: parsed.data.overall_rating },
  });

  return NextResponse.json(created);
}
