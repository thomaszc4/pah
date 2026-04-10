import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: interpProfile } = await supabase
    .from('interpreter_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!interpProfile) redirect('/interpreter/onboarding');

  const { data: payouts } = await supabase
    .from('bookings')
    .select('id, scheduled_start, specialization_required, actual_duration_minutes, interpreter_payout_cents, payment_status')
    .eq('interpreter_id', interpProfile.id)
    .in('status', ['completed', 'billed'])
    .order('actual_end', { ascending: false })
    .limit(20);

  const totalEarned = (payouts || []).reduce(
    (sum, p) => sum + (p.interpreter_payout_cents || 0),
    0,
  );
  const pendingPayouts = (payouts || []).filter((p) => p.payment_status !== 'transferred');

  const tierRates: Record<string, string> = {
    provisional: '$42/hr',
    certified: '$52/hr',
    advanced: '$62/hr',
    expert: '$72/hr',
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">Earnings</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-emerald-100">Total earned</div>
          <div className="text-3xl font-semibold mt-2 tracking-tight">
            ${(totalEarned / 100).toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Pending</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2 tracking-tight">
            {pendingPayouts.length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            payout{pendingPayouts.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Your rate</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2 tracking-tight">
            {tierRates[interpProfile.experience_tier] || '$42/hr'}
          </div>
          <div className="text-xs text-slate-500 capitalize mt-0.5">
            {interpProfile.experience_tier} tier
          </div>
        </div>
      </div>

      {/* Stripe Connect */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Payment setup</h2>
        {interpProfile.stripe_onboarding_complete ? (
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        )}
      </div>

      {/* Payout History */}
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Payout history</h2>
      {!payouts || payouts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <p className="text-slate-500 font-medium">No earnings yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Complete your first job to get paid.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {payouts.map((p, i) => (
            <div
              key={p.id}
              className={`p-4 flex justify-between items-center ${
                i !== payouts.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div>
                <span className="font-semibold text-sm text-slate-900">
                  {p.specialization_required.charAt(0).toUpperCase() + p.specialization_required.slice(1)}
                </span>
                <span className="text-slate-400 mx-2" aria-hidden="true">·</span>
                <span className="text-sm text-slate-600">
                  {p.scheduled_start &&
                    new Date(p.scheduled_start).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
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
