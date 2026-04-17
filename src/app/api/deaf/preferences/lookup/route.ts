import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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
 * Business admins call this to look up a Deaf client's preferences by email.
 * Returns a bounded subset (no internal IDs leaked).
 * Requires caller to be an org member.
 */
export async function GET(request: Request) {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Must be a business admin (member of at least one org)
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ preferences: null });

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: profile } = await service
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!profile) return NextResponse.json({ preferences: null });

  const { data: prefs } = await service
    .from('deaf_user_preferences')
    .select('preferred_gender, preferred_specializations, prefers_location_type')
    .eq('user_id', profile.id)
    .maybeSingle();

  return NextResponse.json({ preferences: prefs ?? null });
}
