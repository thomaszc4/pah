import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function DeafDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, roles')
    .eq('id', user.id)
    .single();

  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select('*, interpreter_profiles(user_id, profiles:user_id(full_name))')
    .eq('deaf_user_id', user.id)
    .in('status', ['confirmed', 'interpreter_en_route', 'in_progress', 'matching', 'offered'])
    .order('scheduled_start', { ascending: true })
    .limit(5);

  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('deaf_user_id', user.id)
    .in('status', ['completed', 'billed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div>
      <div className="flex items-start sm:items-center justify-between mb-8 flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-slate-600 mt-1">Manage your interpreter bookings</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/book"
            className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
          >
            Book Interpreter
          </Link>
          <Link
            href="/book/urgent"
            className="bg-white border border-red-200 text-red-700 hover:bg-red-50 px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            Need one now
          </Link>
        </div>
      </div>

      {/* Upcoming Bookings */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Upcoming bookings</h2>
        {!upcomingBookings || upcomingBookings.length === 0 ? (
          <EmptyState
            title="No upcoming bookings"
            subtitle="Schedule an interpreter for your next appointment or event."
            cta="Book an interpreter"
            ctaHref="/book"
          />
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {booking.specialization_required.charAt(0).toUpperCase() +
                        booking.specialization_required.slice(1)}{' '}
                      Interpreting
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {booking.scheduled_start
                        ? new Date(booking.scheduled_start).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : 'Time TBD'}
                    </div>
                    {booking.address_line1 && (
                      <div className="text-sm text-slate-500 mt-0.5">
                        {booking.address_line1}, {booking.city}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent bookings</h2>
        {!recentBookings || recentBookings.length === 0 ? (
          <EmptyState
            title="No past bookings yet"
            subtitle="Once you complete a booking, it'll show up here."
          />
        ) : (
          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {booking.specialization_required.charAt(0).toUpperCase() +
                        booking.specialization_required.slice(1)}{' '}
                      Interpreting
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {booking.scheduled_start
                        ? new Date(booking.scheduled_start).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Completed'}
                    </div>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
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
    pending: 'bg-amber-100 text-amber-800',
    matching: 'bg-blue-100 text-blue-800',
    offered: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-emerald-100 text-emerald-800',
    interpreter_en_route: 'bg-violet-100 text-violet-800',
    in_progress: 'bg-violet-100 text-violet-800',
    completed: 'bg-slate-100 text-slate-700',
    billed: 'bg-slate-100 text-slate-700',
    cancelled: 'bg-red-100 text-red-800',
    no_match: 'bg-red-100 text-red-800',
    disputed: 'bg-orange-100 text-orange-800',
  };

  const labels: Record<string, string> = {
    pending: 'Pending',
    matching: 'Finding Interpreter',
    offered: 'Finding Interpreter',
    confirmed: 'Confirmed',
    interpreter_en_route: 'On the Way',
    in_progress: 'In Progress',
    completed: 'Completed',
    billed: 'Completed',
    cancelled: 'Cancelled',
    no_match: 'No Match',
    disputed: 'Disputed',
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
