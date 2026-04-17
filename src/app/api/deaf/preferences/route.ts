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
          } catch { /* Server Component */ }
        },
      },
    },
  );
}

const prefsSchema = z.object({
  preferred_gender: z.array(z.enum(['female', 'male', 'non_binary', 'prefer_not_to_say'])).optional(),
  preferred_specializations: z.array(z.string()).optional(),
  preferred_interpreter_ids: z.array(z.string().uuid()).optional(),
  blocked_interpreter_ids: z.array(z.string().uuid()).optional(),
  prefers_location_type: z.enum(['in_person', 'vri', 'no_preference']).optional(),
  notify_email: z.boolean().optional(),
  notify_sms: z.boolean().optional(),
  notify_push: z.boolean().optional(),
  hide_pricing_for_business: z.boolean().optional(),
  intro_video_url: z.string().url().nullable().optional(),
  intro_video_caption_url: z.string().url().nullable().optional(),
  intro_video_transcript: z.string().nullable().optional(),
});

export async function GET() {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('deaf_user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json(data ?? {
    user_id: user.id,
    preferred_gender: [],
    preferred_specializations: [],
    preferred_interpreter_ids: [],
    blocked_interpreter_ids: [],
    prefers_location_type: 'no_preference',
    notify_email: true,
    notify_sms: false,
    notify_push: true,
    hide_pricing_for_business: true,
  });
}

export async function PATCH(request: Request) {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await request.json();
  const parsed = prefsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('deaf_user_preferences')
    .upsert({
      user_id: user.id,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
