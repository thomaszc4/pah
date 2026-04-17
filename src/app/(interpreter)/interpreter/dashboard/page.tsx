import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge, EmptyState } from '@/components/ui';

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export default async function InterpreterDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const { data: interpProfile } = await supabase
    .from('interpreter_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!interpProfile) redirect('/interpreter/onboarding');

  const { data: upcomingJobs } = await supabase
    .from('bookings')
    .select('*')
    .eq('interpreter_id', interpProfile.id)
    .in('status', ['offered', 'confirmed', 'interpreter_en_route', 'in_progress'])
    .order('scheduled_start', { ascending: true })
    .limit(5);

  const { data: recentJobs } = await supabase
    .from('bookings')
    .select('*')
    .eq('interpreter_id', interpProfile.id)
    .in('status', ['completed', 'billed'])
    .order('actual_end', { ascending: false })
    .limit(5);

  // Current pay period earnings (for the #14 dashboard tile)
  const periodStart = interpProfile.payout_frequency === 'biweekly'
    ? new Date(startOfWeek().getTime() - 7 * 24 * 60 * 60 * 1000)
    : startOfWeek();
  const { data: periodJobs } = await supabase
    .from('bookings')
    .select('interpreter_payout_cents')
    .eq('interpreter_id', interpProfile.id)
    .in('status', ['completed', 'billed'])
    .gte('actual_end', periodStart.toISOString());
  const currentPeriodCents = (periodJobs ?? []).reduce(
    (s: number, b: { interpreter_payout_cents: number | null }) => s + (b.interpreter_payout_cents || 0),
    0,
  );

  // Feed count — how many open jobs in the interpreter's specializations
  const { count: feedCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .in('status', ['matching', 'no_match'])
    .in('specialization_required', interpProfile.specializations ?? ['general']);

  const tierLabel: Record<string, string> = {
    provisional: 'Provisional',
    certified: 'Certified',
    advanced: 'Advanced',
    expert: 'Expert',
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'Interpreter';
  const periodLabel = interpProfile.payout_frequency === 'biweekly'
    ? 'Biweekly period'
    : interpProfile.payout_frequency === 'weekly'
    ? 'This week'
    : 'Per-job';

  return (
    <div>
      <div className="flex items-start sm:items-center justify-between mb-8 flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Welcome, {firstName}
          </h1>
          <p className="text-slate-600 mt-1">
            {tierLabel[interpProfile.experience_tier] || 'Provisional'} Interpreter
            {interpProfile.avg_rating > 0 && ` · ${interpProfile.avg_rating.toFixed(1)} ★`}
          </p>
        </div>
        <AvailabilityBadge isAvailable={interpProfile.is_available} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-emerald-100">
            {periodLabel}
          </div>
          <div className="text-2xl font-semibold mt-2 tracking-tight">
            ${(currentPeriodCents / 100).toFixed(2)}
          </div>
          <Link
            href="/interpreter/earnings"
            className="text-xs text-emerald-100 hover:text-white mt-1 inline-block"
          >
            View earnings →
          </Link>
        </div>
        <StatCard label="Total jobs" value={interpProfile.total_jobs} />
        <StatCard
          label="Avg rating"
          value={interpProfile.avg_rating > 0 ? interpProfile.avg_rating.toFixed(1) : '—'}
        />
        <StatCard
          label="Service radius"
          value={`${interpProfile.service_radius_miles} mi`}
        />
      </div>

      {/* Feed CTA */}
      {(feedCount ?? 0) > 0 && (
        <Link
          href="/interpreter/feed"
          className="block mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-blue-900">
                {feedCount} open {feedCount === 1 ? 'job' : 'jobs'} waiting
              </div>
              <p className="text-sm text-blue-800 mt-0.5">
                In your specializations. Browse the feed and claim one.
              </p>
            </div>
            <span className="text-blue-700 font-semibold text-sm shrink-0">Open feed →</span>
          </div>
        </Link>
      )}

      {/* Onboarding checklist */}
      {!interpProfile.certifications_verified && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <h3 className="font-semibold text-amber-900">Finish your setup</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {!interpProfile.stripe_onboarding_complete && (
              <li>
                •{' '}
                <Link href="/stripe-setup" className="underline underline-offset-4 font-medium">
                  Set up Stripe
                </Link>{' '}
                to receive payments
              </li>
            )}
            <li>
              • Your certifications are{' '}
              <span className="font-semibold">pending review</span>
            </li>
            <li>
              •{' '}
              <Link href="/interpreter/profile" className="underline underline-offset-4 font-medium">
                Complete your profile
              </Link>{' '}
              (photo, bio, intro video) so clients know who you are
            </li>
          </ul>
        </div>
      )}

      {/* Upcoming Jobs */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming jobs</h2>
          <Link
            href="/interpreter/jobs"
            className="text-sm font-medium text-blue-700 hover:text-blue-800 underline underline-offset-4"
          >
            View all
          </Link>
        </div>
        {!upcomingJobs || upcomingJobs.length === 0 ? (
          <EmptyState
            title="No upcoming jobs"
            subtitle="Browse the feed to pick up your next booking."
            cta="Browse the feed"
            ctaHref="/interpreter/feed"
          />
        ) : (
          <div className="space-y-3">
            {upcomingJobs.map((job) => (
              <Link
                key={job.id}
                href={`/interpreter/jobs/${job.id}`}
                className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 capitalize">
                      {job.specialization_required.replace(/_/g, ' ')} interpreting
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {job.scheduled_start &&
                        new Date(job.scheduled_start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                    </div>
                    {job.address_line1 && (
                      <div className="text-sm text-slate-600 mt-0.5">
                        {job.address_line1}, {job.city}
                      </div>
                    )}
                  </div>
                  <StatusBadge
                    status={job.status}
                    label={job.status === 'offered' ? 'Action required' : undefined}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent completed</h2>
        {!recentJobs || recentJobs.length === 0 ? (
          <EmptyState
            title="No completed jobs yet"
            subtitle="Once you wrap your first booking, it'll show up here."
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {recentJobs.map((job, i) => (
              <div
                key={job.id}
                className={`p-4 flex justify-between items-center ${
                  i !== recentJobs.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div>
                  <span className="font-semibold text-sm text-slate-900 capitalize">
                    {job.specialization_required.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-400 mx-2" aria-hidden="true">·</span>
                  <span className="text-sm text-slate-600">
                    {job.actual_duration_minutes
                      ? `${Math.round((job.actual_duration_minutes / 60) * 10) / 10} hrs`
                      : 'N/A'}
                  </span>
                </div>
                <span className="font-semibold text-emerald-700">
                  {job.interpreter_payout_cents
                    ? `+$${(job.interpreter_payout_cents / 100).toFixed(2)}`
                    : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-600">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-2 tracking-tight">{value}</div>
    </div>
  );
}

function AvailabilityBadge({ isAvailable }: { isAvailable: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
        isAvailable
          ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          : 'bg-slate-100 border border-slate-200 text-slate-700'
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
        }`}
      />
      {isAvailable ? 'Available' : 'Unavailable'}
    </div>
  );
}
