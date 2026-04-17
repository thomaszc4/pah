import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

/**
 * Daily cron — aggregates payouts for interpreters on weekly/biweekly schedules.
 *
 * - Per-job interpreters already get transferred at job completion elsewhere.
 * - Weekly interpreters get aggregated every Friday.
 * - Biweekly interpreters get aggregated every other Friday.
 *
 * Security: Vercel Cron sends a fixed `authorization: Bearer $CRON_SECRET` header.
 */

function verifyCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${secret}`;
}

function isTodayPayoutDay(frequency: 'weekly' | 'biweekly'): boolean {
  const now = new Date();
  // Friday is day 5
  if (now.getDay() !== 5) return false;
  if (frequency === 'weekly') return true;
  // Biweekly: pay on even ISO week numbers (simple anchor).
  const weeksSinceEpoch = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  return weeksSinceEpoch % 2 === 0;
}

export async function GET(request: Request) {
  if (!verifyCron(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  const stripe = new Stripe(stripeKey);

  const summary = { weekly: 0, biweekly: 0, skipped: 0, errors: 0 };

  for (const freq of ['weekly', 'biweekly'] as const) {
    if (!isTodayPayoutDay(freq)) {
      summary.skipped += 1;
      continue;
    }
    const { data: interpreters } = await service
      .from('interpreter_profiles')
      .select('id, user_id, stripe_connect_account_id, stripe_onboarding_complete')
      .eq('payout_frequency', freq)
      .eq('stripe_onboarding_complete', true);

    for (const interp of interpreters || []) {
      if (!interp.stripe_connect_account_id) continue;
      const { data: unpaid } = await service
        .from('bookings')
        .select('id, interpreter_payout_cents')
        .eq('interpreter_id', interp.id)
        .in('status', ['completed', 'billed'])
        .eq('payment_status', 'captured');
      if (!unpaid || unpaid.length === 0) continue;

      const totalCents = unpaid.reduce(
        (s: number, b: { interpreter_payout_cents: number | null }) =>
          s + (b.interpreter_payout_cents || 0),
        0,
      );
      if (totalCents <= 0) continue;

      try {
        const transfer = await stripe.transfers.create({
          amount: totalCents,
          currency: 'usd',
          destination: interp.stripe_connect_account_id,
          metadata: {
            interpreter_id: interp.id,
            booking_count: String(unpaid.length),
            payout_frequency: freq,
          },
        });
        await service
          .from('bookings')
          .update({ payment_status: 'transferred', stripe_transfer_id: transfer.id })
          .in('id', unpaid.map((u: { id: string }) => u.id));
        summary[freq] += 1;
      } catch (err) {
        summary.errors += 1;
        console.error('[cron/payouts]', err);
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
