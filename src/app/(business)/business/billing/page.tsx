import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id, organizations(*)')
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/business/onboarding');
  const org = membership.organizations as unknown as Record<string, unknown>;

  // Recent billed bookings
  const { data: invoices } = await supabase
    .from('bookings')
    .select('id, scheduled_start, created_at, specialization_required, total_charge_cents, payment_status')
    .eq('organization_id', membership.org_id)
    .in('status', ['completed', 'billed'])
    .order('created_at', { ascending: false })
    .limit(20);

  const totalSpent = (invoices || []).reduce(
    (sum, i) => sum + (i.total_charge_cents || 0),
    0,
  );

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">Billing</h1>

      {/* Payment Method */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Payment method</h2>
        {org.payment_method_on_file ? (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-emerald-900">Payment method on file</p>
                <p className="text-sm text-emerald-700">Visa ending in •••• 4242</p>
              </div>
            </div>
            <Link
              href="/stripe-setup"
              className="text-sm font-medium text-emerald-800 hover:text-emerald-900 underline"
            >
              Update
            </Link>
          </div>
        ) : (
          <div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-800 text-sm font-semibold">
                No payment method on file
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                You must add one before you can book interpreters.
              </p>
            </div>
            <Link
              href="/stripe-setup"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              Add Payment Method
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        )}
      </div>

      {/* Spend Summary */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="text-sm text-slate-300">Total spent this period</div>
        <div className="text-4xl font-semibold mt-1 tracking-tight">
          ${(totalSpent / 100).toLocaleString()}
        </div>
        <div className="text-xs text-slate-400 mt-1">{(invoices || []).length} bookings</div>
      </div>

      {/* Invoice History */}
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Invoice history</h2>
      {!invoices || invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <p className="text-slate-500 font-medium">No invoices yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Your past bookings will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {invoices.map((inv, i) => (
            <div
              key={inv.id}
              className={`p-4 flex justify-between items-center ${
                i !== invoices.length - 1 ? 'border-b border-slate-100' : ''
              }`}
            >
              <div className="text-sm">
                <span className="font-semibold text-slate-900">
                  {inv.specialization_required.charAt(0).toUpperCase() +
                    inv.specialization_required.slice(1)}
                </span>
                <span className="text-slate-400 mx-2" aria-hidden="true">·</span>
                <span className="text-slate-600">
                  {inv.scheduled_start &&
                    new Date(inv.scheduled_start).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                </span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900">
                  ${((inv.total_charge_cents || 0) / 100).toFixed(2)}
                </div>
                <div
                  className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${
                    inv.payment_status === 'transferred'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {inv.payment_status === 'transferred' ? 'Paid' : inv.payment_status}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
