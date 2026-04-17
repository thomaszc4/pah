import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { generateFeed } from '@/lib/feed/generate';

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

export async function GET(request: Request) {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: interp } = await supabase
    .from('interpreter_profiles')
    .select('id, user_id, specializations, current_lat, current_lng, service_radius_miles')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!interp) return NextResponse.json({ error: 'Not an interpreter' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const windowParam = searchParams.get('window') || '7d';
  const days = windowParam === '14d' ? 14 : windowParam === '30d' ? 30 : 7;

  const feed = await generateFeed({
    interpreterId: interp.id,
    interpreterUserId: interp.user_id,
    specializations: interp.specializations ?? ['general'],
    currentLat: interp.current_lat !== null ? Number(interp.current_lat) : null,
    currentLng: interp.current_lng !== null ? Number(interp.current_lng) : null,
    serviceRadius: interp.service_radius_miles ?? 25,
    windowDays: days,
  });

  return NextResponse.json(feed);
}
