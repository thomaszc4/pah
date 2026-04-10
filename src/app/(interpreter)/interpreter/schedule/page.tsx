import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function SchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: interpProfile } = await supabase
    .from('interpreter_profiles')
    .select('id, is_available')
    .eq('user_id', user.id)
    .single();

  if (!interpProfile) redirect('/interpreter/onboarding');

  // Get upcoming bookings
  const { data: upcoming } = await supabase
    .from('bookings')
    .select('*')
    .eq('interpreter_id', interpProfile.id)
    .in('status', ['confirmed', 'interpreter_en_route', 'in_progress'])
    .gte('scheduled_start', new Date().toISOString())
    .order('scheduled_start', { ascending: true });

  // Get availability windows
  const { data: windows } = await supabase
    .from('availability_windows')
    .select('*')
    .eq('interpreter_id', interpProfile.id)
    .order('day_of_week', { ascending: true });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Schedule</h1>

      {/* Upcoming Jobs */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Upcoming Jobs</h2>
        {!upcoming || upcoming.length === 0 ? (
          <p className="text-gray-600 bg-white rounded-xl border p-6 text-center">No upcoming jobs</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((job) => (
              <div key={job.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">
                      {job.specialization_required.charAt(0).toUpperCase() + job.specialization_required.slice(1)}
                    </span>
                    <span className="text-gray-600 mx-2">&middot;</span>
                    <span className="text-sm text-gray-600">
                      {job.scheduled_start && new Date(job.scheduled_start).toLocaleDateString('en-US', {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {job.address_line1 && (
                    <span className="text-sm text-gray-600">{job.city}, {job.state}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Availability Windows */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Availability</h2>
          <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
            <span className="w-1 h-1 rounded-full bg-blue-500" /> Phase 2
          </span>
        </div>
        {!windows || windows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 mx-auto bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-900">Calendar sync is on the way</p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Recurring availability and Google Calendar sync are part of our next release.
              For now, you&apos;ll be offered jobs during your accepted time slots.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {windows.map((w, i) => (
              <div
                key={w.id}
                className={`p-4 flex justify-between items-center ${
                  i !== windows.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <span className="font-medium text-sm text-slate-900">{dayNames[w.day_of_week]}</span>
                <span className="text-sm text-slate-600">
                  {w.start_time} – {w.end_time}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
