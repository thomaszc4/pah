import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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
 * POST /api/organizations/[id]/ratings/[ratingId]/flag — anyone can flag a
 * review for admin review (abuse, libel, PII). Admin resolves in /admin/reviews.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; ratingId: string }> },
) {
  const { ratingId } = await params;
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await service
    .from('organization_ratings')
    .update({ flagged_for_review: true })
    .eq('id', ratingId);

  await service.from('audit_log').insert({
    user_id: user.id,
    action: 'flag_rating',
    resource_type: 'organization_rating',
    resource_id: ratingId,
  });

  return NextResponse.json({ ok: true });
}
