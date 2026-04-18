import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import InviteActions from './InviteActions';

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hash = createHash('sha256').update(token).digest('hex');
  const supabase = svc();

  const { data: invitation } = await supabase
    .from('booking_invitations')
    .select(`
      id, status, expires_at, email, full_name,
      bookings(
        id, scheduled_start, scheduled_end, location_type,
        address_line1, city, state, specialization_required,
        organization:organizations(name, org_type)
      )
    `)
    .eq('token_hash', hash)
    .maybeSingle();

  if (!invitation) return notFound();

  const booking = invitation.bookings as unknown as {
    id: string;
    scheduled_start: string | null;
    scheduled_end: string | null;
    location_type: 'in_person' | 'vri';
    address_line1: string | null;
    city: string | null;
    state: string | null;
    specialization_required: string;
    organization: { name: string; org_type: string } | null;
  };

  const expired = new Date(invitation.expires_at).getTime() < Date.now();
  const orgName = booking.organization?.name ?? 'A business';

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              PAH
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              {orgName} booked an interpreter for you
            </h1>
          </div>

          {invitation.status === 'accepted' ? (
            <div className="px-6 py-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-900">
                You accepted this invitation. You can see the booking anytime in{' '}
                <Link href={`/bookings/${booking.id}`} className="font-semibold underline underline-offset-4">
                  your bookings
                </Link>
                .
              </div>
            </div>
          ) : invitation.status === 'declined' ? (
            <div className="px-6 py-6">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
                You declined this invitation. {orgName} still has an interpreter booked for
                your appointment; you just won&apos;t get updates from PAH.
              </div>
            </div>
          ) : expired ? (
            <div className="px-6 py-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                This invitation has expired.
              </div>
            </div>
          ) : (
            <>
              <div className="px-6 py-5 space-y-3 text-sm text-slate-700">
                <p>
                  {invitation.full_name ? `${invitation.full_name}, ` : 'Hi — '}
                  {orgName} has scheduled an ASL interpreter for your upcoming
                  appointment. Under the Americans with Disabilities Act, the business
                  is covering the cost — you don&apos;t owe anything.
                </p>
                <div className="bg-slate-50 rounded-xl p-4 space-y-1">
                  {booking.scheduled_start && (
                    <div>
                      <span className="font-medium text-slate-900">When:</span>{' '}
                      {new Date(booking.scheduled_start).toLocaleString()}
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-slate-900">Format:</span>{' '}
                    {booking.location_type === 'in_person' ? 'In person' : 'Video remote (VRI)'}
                  </div>
                  {booking.address_line1 && (
                    <div>
                      <span className="font-medium text-slate-900">Where:</span>{' '}
                      {booking.address_line1}, {booking.city}, {booking.state}
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-slate-900">Type:</span>{' '}
                    <span className="capitalize">
                      {booking.specialization_required.replace(/_/g, ' ')} interpreting
                    </span>
                  </div>
                </div>
                <p>
                  If you accept, you&apos;ll be able to see the interpreter&apos;s profile,
                  message them before the appointment, and track their arrival on the day.
                </p>
              </div>

              <InviteActions token={token} prefilEmail={invitation.email ?? ''} prefilName={invitation.full_name ?? ''} />
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          PAH · Finally, interpreting on your terms.
        </p>
      </div>
    </div>
  );
}
