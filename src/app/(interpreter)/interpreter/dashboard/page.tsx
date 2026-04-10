import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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

  const tierLabel: Record<string, string> = {
    provisional: 'Provisional',
    certified: 'Certified',
    advanced: 'Advanced',
    expert: 'Expert',
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'Interpreter';

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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total jobs" value={interpProfile.total_jobs} />
        <StatCard
          label="Earnings"
          value={`$${(interpProfile.total_earnings_cents / 100).toLocaleString()}`}
          highlight
        />
        <StatCard
          label="Avg rating"
          value={interpProfile.avg_rating > 0 ? interpProfile.avg_rating.toFixed(1) : '—'}
        />
        <StatCard label="Service radius" value={`${interpProfile.service_radius_miles} mi`} />
      </div>

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
          </ul>
        </div>
      )}

      {/* Upcoming Jobs */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Upcoming jobs</h2>
          <Link
            href="/interpreter/jobs"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 underline underline-offset-4"
          >
            View all jobs
          </Link>
        </div>
        {!upcomingJobs || upcomingJobs.length === 0 ? (
          <EmptyState
            title="No upcoming jobs"
            subtitle="Browse available jobs to pick up your next booking."
            cta="Browse available jobs"
            ctaHref="/interpreter/jobs"
          />
        ) : (
          <div className="space-y-3">
            {upcomingJobs.map((job) => (
              <Link
                key={job.id}
                href={`/interpreter/jobs/${job.id}`}
                className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {job.specialization_required.charAt(0).toUpperCase() +
                        job.specialization_required.slice(1)}{' '}
                      Interpreting
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
                      <div className="text-sm text-slate-500 mt-0.5">
                        {job.address_line1}, {job.city}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Jobs */}
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
                  <span className="font-semibold text-sm text-slate-900">
                    {job.specialization_required.charAt(0).toUpperCase() +
                      job.specialization_required.slice(1)}
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
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  if (highlight) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-sm p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-emerald-100">{label}</div>
        <div className="text-2xl font-semibold mt-2 tracking-tight">{value}</div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
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
          : 'bg-slate-100 border border-slate-200 text-slate-600'
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

function EmptyState({
  title,
  subtitle,
  cta,
  ctaHref,
}: {
  title: string;
  subtitle: string;
  cta?: string;
  ctaHref?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{subtitle}</p>
      {cta && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-block mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 underline underline-offset-4"
        >
          {cta} →
        </Link>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    offered: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-emerald-100 text-emerald-800',
    interpreter_en_route: 'bg-violet-100 text-violet-800',
    in_progress: 'bg-violet-100 text-violet-800',
  };
  const labels: Record<string, string> = {
    offered: 'Action Required',
    confirmed: 'Confirmed',
    interpreter_en_route: 'On the Way',
    in_progress: 'In Progress',
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        styles[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
