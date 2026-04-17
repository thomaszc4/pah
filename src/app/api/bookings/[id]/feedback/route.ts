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

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review_text: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string()).max(20).optional(),
  would_rebook: z.boolean().nullable().optional(),
  video_feedback_url: z.string().url().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = await request.json();
  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: booking } = await service
    .from('bookings')
    .select('id, interpreter_id, deaf_user_id, status')
    .eq('id', id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.deaf_user_id !== user.id) {
    return NextResponse.json({ error: 'Only the booking client can leave feedback' }, { status: 403 });
  }
  if (!['completed', 'billed'].includes(booking.status)) {
    return NextResponse.json({ error: 'Booking is not yet completed' }, { status: 400 });
  }
  if (!booking.interpreter_id) {
    return NextResponse.json({ error: 'No interpreter to rate' }, { status: 400 });
  }

  const { data: interp } = await service
    .from('interpreter_profiles')
    .select('user_id')
    .eq('id', booking.interpreter_id)
    .single();

  if (!interp) return NextResponse.json({ error: 'Interpreter not found' }, { status: 404 });

  const { error: insertErr } = await service.from('ratings').upsert({
    booking_id: id,
    rated_by: user.id,
    rated_user: interp.user_id,
    rating: parsed.data.rating,
    review_text: parsed.data.review_text ?? null,
    tags: parsed.data.tags ?? [],
    would_rebook: parsed.data.would_rebook ?? null,
    video_feedback_url: parsed.data.video_feedback_url ?? null,
    is_visible: true,
  }, { onConflict: 'booking_id,rated_by' });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Recalculate avg rating for the interpreter.
  const { data: allRatings } = await service
    .from('ratings')
    .select('rating')
    .eq('rated_user', interp.user_id)
    .eq('is_visible', true);
  if (allRatings && allRatings.length > 0) {
    const avg =
      allRatings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
      allRatings.length;
    await service
      .from('interpreter_profiles')
      .update({ avg_rating: Math.round(avg * 100) / 100 })
      .eq('id', booking.interpreter_id);
  }

  return NextResponse.json({ ok: true });
}
