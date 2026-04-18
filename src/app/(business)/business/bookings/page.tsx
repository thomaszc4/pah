import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, EmptyState, StatusBadge } from '@/components/ui';

export default async function BusinessBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/business/onboarding');

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('organization_id', membership.org_id)
    .order('scheduled_start', { ascending: false });

  return (
    <div>
      <PageHeader
        title="Bookings"
        subtitle="All interpreter requests from your organization"
        actions={
          <Link
            href="/business/book"
            className="inline-flex items-center justify-center rounded-xl font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm px-5 py-2.5 text-sm transition-colors"
          >
            Book Interpreter
          </Link>
        }
      />

      {!bookings || bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          subtitle="Book an interpreter for a Deaf client to get started."
          cta="Book interpreter"
          ctaHref="/business/book"
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Link
              key={b.id}
              href={`/business/bookings/${b.id}`}
              className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 capitalize">
                    {b.specialization_required.replace(/_/g, ' ')} interpreting
                    {b.requires_team && !b.team_override_reason && (
                      <span className="ml-2 text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5 align-middle">
                        Team
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    {b.scheduled_start
                      ? new Date(b.scheduled_start).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })
                      : 'Time TBD'}
                    {b.client_name && ` · ${b.client_name}`}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-medium text-sm text-slate-700">
                    {b.total_charge_cents ? `$${(b.total_charge_cents / 100).toFixed(2)}` : '—'}
                  </span>
                  <StatusBadge
                    status={b.status}
                    label={
                      b.status === 'offered' ? 'Offered to Interpreter' :
                      b.status === 'pending_business_approval' ? 'Awaiting Approval' :
                      b.status === 'no_match' ? 'No Interpreter Yet' :
                      undefined
                    }
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
