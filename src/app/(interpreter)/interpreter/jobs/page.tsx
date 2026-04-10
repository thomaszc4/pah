import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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

  // Get assigned bookings
  const { data: myJobs } = await supabase
    .from('bookings')
    .select('*')
    .eq('interpreter_id', interpProfile.id)
    .in('status', ['offered', 'confirmed', 'interpreter_en_route', 'in_progress'])
    .order('scheduled_start', { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Jobs</h1>

      {!myJobs || myJobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-600 mb-2">No jobs assigned yet</p>
          <p className="text-sm text-gray-600">
            Jobs will appear here when clients book you for interpreting.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {myJobs.map((job) => (
            <Link
              key={job.id}
              href={`/interpreter/jobs/${job.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold">
                    {job.specialization_required.charAt(0).toUpperCase() +
                      job.specialization_required.slice(1)}{' '}
                    Interpreting
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {job.location_type === 'in_person' ? 'In Person' : 'Video Remote'}
                    {job.booking_type === 'urgent' && (
                      <span className="text-red-600 ml-2 font-medium">URGENT</span>
                    )}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  job.status === 'offered'
                    ? 'bg-amber-100 text-amber-800'
                    : job.status === 'in_progress'
                      ? 'bg-violet-100 text-violet-800'
                      : job.status === 'interpreter_en_route'
                        ? 'bg-violet-100 text-violet-800'
                        : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {job.status === 'offered' ? 'Action Required' :
                   job.status === 'in_progress' ? 'In Progress' :
                   job.status === 'interpreter_en_route' ? 'En Route' : 'Confirmed'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">When:</span>{' '}
                  {job.scheduled_start
                    ? new Date(job.scheduled_start).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'ASAP'}
                </div>
                {job.address_line1 && (
                  <div>
                    <span className="text-gray-600">Where:</span>{' '}
                    {job.address_line1}, {job.city}, {job.state}
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Duration:</span>{' '}
                  ~{Math.round(job.estimated_duration_minutes / 60)} hr{job.estimated_duration_minutes > 60 ? 's' : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
