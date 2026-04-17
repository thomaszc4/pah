import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, EmptyState, StatusBadge } from '@/components/ui';

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
    ['confirmed', 'interpreter_en_route', 'in_progress', 'matching', 'offered', 'pending', 'pending_business_approval'].includes(b.status),
  );
  const past = (bookings || []).filter((b) =>
    ['completed', 'billed', 'cancelled', 'no_match', 'disputed'].includes(b.status),
  );

  return (
    <div>
      <PageHeader
        title="My bookings"
        subtitle="Upcoming and past interpreter appointments"
        actions={
          <Link
            href="/book"
            className="inline-flex items-center justify-center rounded-xl font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm px-5 py-2.5 text-sm transition-colors"
          >
            New booking
          </Link>
        }
      />

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming bookings"
            subtitle="When you book an interpreter, it'll show up here."
            cta="Book an interpreter"
            ctaHref="/book"
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Past</h2>
        {past.length === 0 ? (
          <EmptyState
            title="No past bookings yet"
            subtitle="Completed and cancelled bookings will appear here."
          />
        ) : (
          <div className="space-y-3">
            {past.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface BookingRowProps {
  booking: {
    id: string;
    specialization_required: string;
    scheduled_start: string | null;
    status: string;
    location_type?: string;
  };
}

function BookingRow({ booking }: BookingRowProps) {
  const specLabel =
    booking.specialization_required.charAt(0).toUpperCase() +
    booking.specialization_required.slice(1).replace(/_/g, ' ');

  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 hover:shadow-md transition-all"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{specLabel} interpreting</div>
          <div className="text-sm text-slate-600 mt-1">
            {booking.scheduled_start
              ? new Date(booking.scheduled_start).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'Time to be determined'}
          </div>
        </div>
        <StatusBadge status={booking.status} />
      </div>
    </Link>
  );
}
