import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ApprovalActions from './ApprovalActions';
import { StatusBadge } from '@/components/ui';

export default async function BusinessDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id, role, organizations(*)')
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/business/onboarding');

  const org = membership.organizations as unknown as Record<string, unknown>;

  // Bookings needing business approval
  const { data: pendingApprovals } = await supabase
    .from('bookings')
    .select('*')
    .eq('organization_id', membership.org_id)
    .eq('status', 'pending_business_approval')
    .order('scheduled_start', { ascending: true });

  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('organization_id', membership.org_id)
    .in('status', ['confirmed', 'interpreter_en_route', 'in_progress', 'matching', 'offered'])
    .order('scheduled_start', { ascending: true });

  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('organization_id', membership.org_id)
    .in('status', ['completed', 'billed', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(10);

  const totalSpent = (recentBookings || []).reduce(
    (sum, b) => sum + (b.total_charge_cents || 0),
    0,
  );

  return (
    <div>
      <div className="flex items-start sm:items-center justify-between mb-8 flex-col sm:flex-row gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">{String(org.name)}</h1>
          <p className="text-slate-600 mt-1 capitalize">{String(org.org_type)} organization</p>
        </div>
        <Link
          href="/business/book"
          className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
        >
          Book Interpreter
        </Link>
      </div>

      {/* Payment warning */}
      {!org.payment_method_on_file && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8">
          <h3 className="font-semibold text-red-900">Payment method required</h3>
          <p className="text-sm text-red-700 mt-1">
            You must add a payment method before you can book interpreters.
            Under the ADA, your organization is responsible for interpreter costs.
          </p>
          <Link
            href="/business/billing"
            className="inline-block mt-3 text-sm font-medium text-red-800 underline underline-offset-4 hover:text-red-900"
          >
            Add payment method →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Active</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2 tracking-tight">{activeBookings?.length || 0}</div>
          <div className="text-xs text-slate-500 mt-0.5">bookings</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Completed</div>
          <div className="text-3xl font-semibold text-slate-900 mt-2 tracking-tight">{recentBookings?.length || 0}</div>
          <div className="text-xs text-slate-500 mt-0.5">this period</div>
        </div>
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-300">Total spent</div>
          <div className="text-3xl font-semibold mt-2 tracking-tight">${(totalSpent / 100).toLocaleString()}</div>
          <div className="text-xs text-slate-300 mt-0.5">this period</div>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals && pendingApprovals.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Requests awaiting your approval
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {pendingApprovals.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pendingApprovals.map((booking) => (
              <div
                key={booking.id}
                className="bg-amber-50 border border-amber-200 rounded-2xl p-5"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold text-slate-900">
                      {booking.specialization_required.charAt(0).toUpperCase() +
                        booking.specialization_required.slice(1)}{' '}
                      Interpreting Request
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {booking.scheduled_start &&
                        new Date(booking.scheduled_start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      {' · '}
                      {booking.estimated_duration_minutes >= 60
                        ? `${booking.estimated_duration_minutes / 60} hour${booking.estimated_duration_minutes > 60 ? 's' : ''}`
                        : `${booking.estimated_duration_minutes} min`}
                    </div>
                    {booking.location_type === 'in_person' && booking.address_line1 && (
                      <div className="text-sm text-slate-500 mt-0.5">
                        {booking.address_line1}{booking.city ? `, ${booking.city}` : ''}
                      </div>
                    )}
                    {booking.public_notes && (
                      <div className="text-sm text-slate-500 mt-1 italic">
                        &ldquo;{booking.public_notes}&rdquo;
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-slate-900">
                      ${((booking.total_charge_cents || 0) / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">estimated</div>
                  </div>
                </div>
                <ApprovalActions bookingId={booking.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Bookings */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Active bookings</h2>
        {!activeBookings || activeBookings.length === 0 ? (
          <EmptyState
            title="No active bookings"
            subtitle="Schedule an interpreter for your next appointment, meeting, or event."
            cta="Book an interpreter"
            ctaHref="/business/book"
          />
        ) : (
          <div className="space-y-3">
            {activeBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/business/bookings`}
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
                      {booking.scheduled_start &&
                        new Date(booking.scheduled_start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                    </div>
                  </div>
                  <StatusBadge
                    status={booking.status}
                    label={
                      booking.status === 'offered' ? 'Offered to Interpreter' :
                      booking.status === 'pending_business_approval' ? 'Awaiting Approval' :
                      booking.status === 'no_match' ? 'No Interpreter Yet' :
                      undefined
                    }
                  />
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
            subtitle="Once your organization completes a booking, it'll show up here."
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {recentBookings.map((booking, i) => (
              <div
                key={booking.id}
                className={`p-4 flex justify-between items-center ${
                  i !== recentBookings.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="text-sm">
                  <span className="font-semibold text-slate-900">
                    {booking.specialization_required.charAt(0).toUpperCase() +
                      booking.specialization_required.slice(1)}
                  </span>
                  <span className="text-slate-400 mx-2" aria-hidden="true">·</span>
                  <span className="text-slate-600">
                    {booking.scheduled_start &&
                      new Date(booking.scheduled_start).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                  </span>
                </div>
                <span className="font-semibold text-slate-900">
                  {booking.total_charge_cents
                    ? `$${(booking.total_charge_cents / 100).toFixed(2)}`
                    : '—'}
                </span>
              </div>
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

