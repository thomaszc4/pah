import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/ui';
import BusinessRequestCard from './BusinessRequestCard';

export default async function AdminBusinessRequestsPage() {
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from('business_registration_requests')
    .select(`
      id, business_name, business_type, contact_email, contact_phone,
      address, reason, status, admin_notes, created_at,
      requester:profiles!business_registration_requests_requested_by_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false });

  const items = (requests || []) as unknown as Array<{
    id: string;
    business_name: string;
    business_type: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    address: string | null;
    reason: string | null;
    status: 'pending' | 'contacted' | 'registered' | 'declined';
    admin_notes: string | null;
    created_at: string;
    requester: { full_name: string; email: string } | null;
  }>;

  const grouped = {
    pending: items.filter((r) => r.status === 'pending'),
    contacted: items.filter((r) => r.status === 'contacted'),
    registered: items.filter((r) => r.status === 'registered'),
    declined: items.filter((r) => r.status === 'declined'),
  };

  return (
    <div>
      <PageHeader
        title="Business requests"
        subtitle="Deaf users asking PAH to onboard their business"
      />

      {items.length === 0 ? (
        <EmptyState
          title="No business requests yet"
          subtitle="When a Deaf user asks PAH to invite a business, it'll appear here."
        />
      ) : (
        <div className="space-y-8">
          {(['pending', 'contacted', 'registered', 'declined'] as const).map((status) => {
            const list = grouped[status];
            if (list.length === 0) return null;
            return (
              <section key={status}>
                <h2 className="text-lg font-semibold text-slate-900 mb-3 capitalize">
                  {status} ({list.length})
                </h2>
                <div className="space-y-3">
                  {list.map((item) => (
                    <BusinessRequestCard key={item.id} request={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
