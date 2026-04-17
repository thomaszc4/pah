import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { PageHeader } from '@/components/ui';

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: pendingCerts },
    { count: pendingBusinessRequests },
    { count: disputedBookings },
    { count: unverifiedInterpreters },
  ] = await Promise.all([
    supabase
      .from('certifications')
      .select('id', { count: 'exact', head: true })
      .eq('verification_status', 'pending'),
    supabase
      .from('business_registration_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'disputed'),
    supabase
      .from('interpreter_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('certifications_verified', false),
  ]);

  return (
    <div>
      <PageHeader title="Admin overview" subtitle="Review queues and platform health" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <QueueCard
          label="Pending certifications"
          count={pendingCerts ?? 0}
          href="/admin/certifications"
          accent="amber"
        />
        <QueueCard
          label="Business requests"
          count={pendingBusinessRequests ?? 0}
          href="/admin/business-requests"
          accent="blue"
        />
        <QueueCard
          label="Disputed bookings"
          count={disputedBookings ?? 0}
          href="/admin"
          accent="rose"
        />
        <QueueCard
          label="Unverified interpreters"
          count={unverifiedInterpreters ?? 0}
          href="/admin/certifications"
          accent="slate"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Notes</h2>
        <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
          <li>Verify a certification by checking the document against the cert body&apos;s
            public registry (RID, BEI, CCHI, state license lookup). Typical time: ~1 min.</li>
          <li>When you approve a cert, the interpreter&apos;s tier is recalculated and they
            get a notification. They can start accepting jobs immediately.</li>
          <li>Business requests are from Deaf users asking PAH to onboard a business (e.g.
            their clinic). Contact the business, walk them through signup, mark status.</li>
        </ul>
      </div>
    </div>
  );
}

function QueueCard({
  label,
  count,
  href,
  accent,
}: {
  label: string;
  count: number;
  href: string;
  accent: 'amber' | 'blue' | 'rose' | 'slate';
}) {
  const accents: Record<typeof accent, string> = {
    amber: 'from-amber-500 to-orange-600',
    blue: 'from-blue-500 to-indigo-600',
    rose: 'from-rose-500 to-pink-600',
    slate: 'from-slate-700 to-slate-900',
  };
  const hasItems = count > 0;
  return (
    <Link
      href={href}
      className={`block p-5 rounded-2xl shadow-sm transition hover:shadow-md ${
        hasItems
          ? `bg-gradient-to-br ${accents[accent]} text-white`
          : 'bg-white border border-slate-200 text-slate-900'
      }`}
    >
      <div className={`text-xs font-medium uppercase tracking-wider ${hasItems ? 'text-white/80' : 'text-slate-600'}`}>
        {label}
      </div>
      <div className="text-3xl font-semibold mt-2 tracking-tight">{count}</div>
      <div className={`text-xs mt-2 ${hasItems ? 'text-white/80' : 'text-slate-600'}`}>
        {hasItems ? 'Review →' : 'All clear'}
      </div>
    </Link>
  );
}
