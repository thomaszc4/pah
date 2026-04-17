import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PayoutFrequencySelector from './PayoutFrequencySelector';

function startOfWeek(d = new Date()) {
  // Sunday-start week
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function nextPayoutDate(frequency: string): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  // Friday payout anchor
  const dayOfWeek = now.getDay();
  const daysUntilFriday = ((5 - dayOfWeek) + 7) % 7 || 7;
  next.setDate(now.getDate() + daysUntilFriday);
  if (frequency === 'biweekly') {
    const weekNum = Math.floor(next.getTime() / (7 * 24 * 60 * 60 * 1000));
    if (weekNum % 2 !== 0) next.setDate(next.getDate() + 7);
  }
  return next;
}

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: interp } = await supabase
    .from('interpreter_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!interp) redirect('/interpreter/onboarding');

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, scheduled_start, specialization_required, actual_duration_minutes, interpreter_payout_cents, payment_status, actual_end')
    .eq('interpreter_id', interp.id)
    .in('status', ['completed', 'billed'])
    .order('actual_end', { ascending: false })
    .limit(60);

  const all = bookings || [];
  const weekStart = startOfWeek();

  const periodStart = interp.payout_frequency === 'biweekly'
    ? new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    : weekStart;

  const currentPeriodJobs = all.filter((b) => {
    const when = b.actual_end || b.scheduled_start;
    return when && new Date(when) >= periodStart;
  });
  const currentPeriodCents = currentPeriodJobs.reduce(
    (s, b) => s + (b.interpreter_payout_cents || 0),
    0,
  );

  const lifetimeCents = all.reduce((s, b) => s + (b.interpreter_payout_cents || 0), 0);

  const pendingPayouts = all.filter((b) => b.payment_status !== 'transferred');

  const tierRates: Record<string, string> = {
    provisional: '$42/hr',
    certified: '$52/hr',
    advanced: '$62/hr',
    expert: '$72/hr',
  };

  const nextPayout = nextPayoutDate(interp.payout_frequency);
  const daysUntilPayout = Math.max(
    0,
    Math.ceil((nextPayout.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  // Last 4 periods sparkline
  const sparkData: number[] = [];
  for (let i = 3; i >= 0; i--) {
    const periodLen = interp.payout_frequency === 'biweekly' ? 14 : 7;
    const from = new Date(weekStart.getTime() - (i + 1) * periodLen * 24 * 60 * 60 * 1000);
    const to = new Date(weekStart.getTime() - i * periodLen * 24 * 60 * 60 * 1000);
    const cents = all
      .filter((b) => {
        const when = b.actual_end || b.scheduled_start;
        if (!when) return false;
        const w = new Date(when);
        return w >= from && w < to;
      })
      .reduce((s, b) => s + (b.interpreter_payout_cents || 0), 0);
    sparkData.push(cents);
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">Earnings</h1>

      {/* #14 CURRENT PAY PERIOD — big */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-sm p-6 sm:p-8 mb-6">
        <div className="text-xs font-medium uppercase tracking-wider text-emerald-100">
          This pay period · {periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' – '}
          {nextPayout.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
        <div className="text-5xl font-semibold mt-2 tracking-tight">
          ${(currentPeriodCents / 100).toFixed(2)}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-emerald-100">
            {currentPeriodJobs.length} job{currentPeriodJobs.length === 1 ? '' : 's'} this period
          </div>
          <div className="text-sm font-medium text-white">
            Payout in {daysUntilPayout} day{daysUntilPayout === 1 ? '' : 's'}
          </div>
        </div>

        {/* Sparkline of last 4 periods */}
        <div className="mt-5 flex items-end gap-1.5 h-10">
          {sparkData.map((v, i) => {
            const max = Math.max(...sparkData, 1);
            const pct = (v / max) * 100;
            return (
              <div
                key={i}
                className="flex-1 bg-white/30 rounded-sm relative group"
                style={{ height: `${Math.max(pct, 4)}%` }}
                aria-label={`Period ${i + 1}: $${(v / 100).toFixed(0)}`}
              />
            );
          })}
          <div
            className="flex-1 bg-white rounded-sm"
            style={{
              height: `${Math.max((currentPeriodCents / Math.max(...sparkData, currentPeriodCents, 1)) * 100, 4)}%`,
            }}
            aria-label={`This period: $${(currentPeriodCents / 100).toFixed(0)}`}
          />
        </div>
        <div className="text-[10px] text-emerald-100 mt-1 text-right">Last 4 periods · current</div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Pending</div>
          <div className="text-2xl font-semibold text-slate-900 mt-2 tracking-tight">
            {pendingPayouts.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            payout{pendingPayouts.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Your rate</div>
          <div className="text-2xl font-semibold text-slate-900 mt-2 tracking-tight">
            {tierRates[interp.experience_tier] || '$42/hr'}
          </div>
          <div className="text-xs text-slate-500 capitalize mt-0.5">
            {interp.experience_tier} tier
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Lifetime</div>
          <div className="text-2xl font-semibold text-slate-900 mt-2 tracking-tight">
            ${(lifetimeCents / 100).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">total earned</div>
        </div>
      </div>

      {/* #15 Pay period selector */}
      <PayoutFrequencySelector initialFrequency={interp.payout_frequency} />

      {/* Stripe Connect */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Payment setup</h2>
        {interp.stripe_onboarding_complete ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-emerald-900">Stripe connected</p>
              <p className="text-sm text-emerald-700">
                Payouts are sent directly to your bank account.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-amber-700 text-sm mb-4">
              Complete your Stripe setup to receive payouts.
            </p>
            <Link
              href="/stripe-setup"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              Set Up Stripe
            </Link>
          </div>
        )}
      </div>

      {/* Payout history (lifetime, compact) */}
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent history</h2>
      {all.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <p className="text-slate-700 font-medium">No earnings yet</p>
          <p className="text-sm text-slate-600 mt-1">Complete your first job to get paid.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {all.slice(0, 20).map((p, i) => (
            <div
              key={p.id}
              className={`p-4 flex justify-between items-center ${
                i !== Math.min(all.length, 20) - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div>
                <span className="font-semibold text-sm text-slate-900 capitalize">
                  {p.specialization_required.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-400 mx-2" aria-hidden="true">·</span>
                <span className="text-sm text-slate-600">
                  {p.scheduled_start && new Date(p.scheduled_start).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                  })}
                </span>
                <span className="text-slate-400 mx-2" aria-hidden="true">·</span>
                <span className="text-sm text-slate-600">
                  {p.actual_duration_minutes
                    ? `${Math.round((p.actual_duration_minutes / 60) * 10) / 10} hrs`
                    : 'N/A'}
                </span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-emerald-700">
                  +${((p.interpreter_payout_cents || 0) / 100).toFixed(2)}
                </div>
                <div
                  className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${
                    p.payment_status === 'transferred'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {p.payment_status === 'transferred' ? 'Paid' : 'Pending'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
