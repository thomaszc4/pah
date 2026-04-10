import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function BookingsListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('deaf_user_id', user.id)
    .order('scheduled_start', { ascending: false });

  const upcoming = (bookings || []).filter((b) =>
    ['confirmed', 'interpreter_en_route', 'in_progress', 'matching', 'offered', 'pending'].includes(b.status),
  );
  const past = (bookings || []).filter((b) =>
    ['completed', 'billed', 'cancelled', 'no_match', 'disputed'].includes(b.status),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <Link
          href="/book"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          New Booking
        </Link>
      </div>

      {/* Upcoming */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-gray-600 bg-white rounded-xl border border-gray-200 p-6 text-center">
            No upcoming bookings
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Past</h2>
        {past.length === 0 ? (
          <p className="text-gray-600 bg-white rounded-xl border border-gray-200 p-6 text-center">
            No past bookings
          </p>
        ) : (
          <div className="space-y-2">
            {past.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BookingRow({ booking }: { booking: Record<string, unknown> }) {
  const statusStyles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    matching: 'bg-blue-100 text-blue-800',
    no_match: 'bg-amber-100 text-amber-800',
  };

  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors"
    >
      <div className="flex justify-between items-center">
        <div>
          <span className="font-medium">
            {String(booking.specialization_required).charAt(0).toUpperCase() +
              String(booking.specialization_required).slice(1)}{' '}
            Interpreting
          </span>
          <span className="text-gray-600 mx-2">&middot;</span>
          <span className="text-sm text-gray-600">
            {booking.scheduled_start
              ? new Date(String(booking.scheduled_start)).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'TBD'}
          </span>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
            statusStyles[String(booking.status)] || 'bg-gray-100 text-gray-800'
          }`}
        >
          {String(booking.status).replace('_', ' ')}
        </span>
      </div>
    </Link>
  );
}
