import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

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

  const statusStyles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
    matching: 'bg-blue-100 text-blue-800',
    no_match: 'bg-amber-100 text-amber-800',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <Link href="/business/book" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Book Interpreter
        </Link>
      </div>

      {!bookings || bookings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-600 mb-2">No bookings yet</p>
          <Link href="/business/book" className="text-blue-600 hover:underline text-sm">
            Book your first interpreter
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">
                    {b.specialization_required.charAt(0).toUpperCase() + b.specialization_required.slice(1)} Interpreting
                  </span>
                  <span className="text-gray-600 mx-2">&middot;</span>
                  <span className="text-sm text-gray-600">
                    {b.scheduled_start
                      ? new Date(b.scheduled_start).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })
                      : 'TBD'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">
                    {b.total_charge_cents ? `$${(b.total_charge_cents / 100).toFixed(2)}` : '—'}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    statusStyles[b.status] || 'bg-gray-100 text-gray-800'
                  }`}>
                    {b.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
