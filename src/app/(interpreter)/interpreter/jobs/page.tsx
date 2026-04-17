import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, EmptyState, StatusBadge } from '@/components/ui';

export default async function InterpreterJobsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: interpProfile } = await supabase
    .from('interpreter_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!interpProfile) redirect('/interpreter/onboarding');

  const { data: myJobs } = await supabase
    .from('bookings')
    .select('*')
    .eq('interpreter_id', interpProfile.id)
    .in('status', ['offered', 'confirmed', 'interpreter_en_route', 'in_progress'])
    .order('scheduled_start', { ascending: true });

  return (
    <div>
      <PageHeader title="My jobs" subtitle="Jobs you've been offered or accepted" />

      {!myJobs || myJobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          subtitle="Jobs will appear here when clients book you or you claim one from the feed."
          cta="Browse the feed"
          ctaHref="/interpreter/feed"
        />
      ) : (
        <div className="space-y-3">
          {myJobs.map((job) => (
            <Link
              key={job.id}
              href={`/interpreter/jobs/${job.id}`}
              className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-3 gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 capitalize">
                    {job.specialization_required.replace(/_/g, ' ')} interpreting
                  </h3>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {job.location_type === 'in_person' ? 'In Person' : 'Video Remote'}
                    {job.booking_type === 'urgent' && (
                      <span className="text-rose-700 ml-2 font-semibold">URGENT</span>
                    )}
                  </p>
                </div>
                <StatusBadge
                  status={job.status}
                  label={
                    job.status === 'offered'
                      ? 'Action required'
                      : job.status === 'interpreter_en_route'
                      ? 'En route'
                      : undefined
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600">When:</span>{' '}
                  <span className="text-slate-900">
                    {job.scheduled_start
                      ? new Date(job.scheduled_start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'ASAP'}
                  </span>
                </div>
                {job.address_line1 && (
                  <div>
                    <span className="text-slate-600">Where:</span>{' '}
                    <span className="text-slate-900">
                      {job.address_line1}, {job.city}, {job.state}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-slate-600">Duration:</span>{' '}
                  <span className="text-slate-900">
                    ~{Math.round(job.estimated_duration_minutes / 60)} hr{job.estimated_duration_minutes > 60 ? 's' : ''}
                  </span>
                </div>
                {job.client_name && (
                  <div>
                    <span className="text-slate-600">Client:</span>{' '}
                    <span className="text-slate-900 font-medium">{job.client_name}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
