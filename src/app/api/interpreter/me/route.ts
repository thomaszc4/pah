import { NextResponse } from 'next/server';
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

const patchSchema = z.object({
  headline: z.string().max(140).nullable().optional(),
  bio: z.string().max(4000).nullable().optional(),
  profile_photo_url: z.string().url().nullable().optional(),
  intro_video_url: z.string().url().nullable().optional(),
  intro_video_caption_url: z.string().url().nullable().optional(),
  intro_video_transcript: z.string().max(10000).nullable().optional(),
  gender: z.enum(['female', 'male', 'non_binary', 'prefer_not_to_say']).nullable().optional(),
  pronouns: z.string().max(60).nullable().optional(),
  skills: z.array(z.string()).max(30).optional(),
  languages: z.array(z.string()).max(10).optional(),
  specializations: z.array(z.string()).max(20).optional(),
  service_radius_miles: z.number().int().positive().max(500).optional(),
  is_accepting_offers: z.boolean().optional(),
  payout_frequency: z.enum(['per_job', 'weekly', 'biweekly']).optional(),
  current_lat: z.number().gte(-90).lte(90).nullable().optional(),
  current_lng: z.number().gte(-180).lte(180).nullable().optional(),
});

export async function GET() {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('interpreter_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await request.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // WCAG guardrail: if intro_video_url set, require captions url OR transcript.
  const incomingVideo = parsed.data.intro_video_url;
  if (incomingVideo) {
    const hasCaption = !!parsed.data.intro_video_caption_url;
    const hasTranscript = !!parsed.data.intro_video_transcript?.trim();
    if (!hasCaption && !hasTranscript) {
      return NextResponse.json(
        { error: 'Videos require a captions file or written transcript for accessibility.' },
        { status: 400 },
      );
    }
  }

  const updates: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  // Stamp location update time whenever lat/lng is provided.
  if (parsed.data.current_lat !== undefined || parsed.data.current_lng !== undefined) {
    updates.last_location_update = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('interpreter_profiles')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
