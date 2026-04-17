import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { notFound } from 'next/navigation';
import ConfirmForm from './ConfirmForm';
import { CURRENT_BUSINESS_EMERGENCY_CONFIRMATION } from '@/lib/attestation/ada';

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export default async function ConfirmAttestationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const hash = createHash('sha256').update(token).digest('hex');

  const supabase = svc();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, client_name, scheduled_start, address_line1, city, state, booking_type, emergency_attestation_name, status, ada_notice_acknowledged_at')
    .eq('emergency_attestation_token', hash)
    .maybeSingle();

  if (!booking) return notFound();

  const alreadyConfirmed = !!booking.ada_notice_acknowledged_at;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            PAH
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-3">
            ADA interpreter authorization
          </h1>

          {alreadyConfirmed ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-emerald-900 font-semibold">Already confirmed.</p>
              <p className="text-sm text-emerald-800 mt-1">
                Thank you. The interpreter has been notified.
              </p>
            </div>
          ) : (
            <>
              <p className="text-slate-700 leading-relaxed mb-4">
                A Deaf client named{' '}
                <strong>{booking.emergency_attestation_name ?? 'a client'}</strong> has
                requested an urgent interpreter at your business. Under the ADA and
                Section 1557, the business is legally responsible for providing and
                paying for qualified interpreter services.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 text-sm">
                {booking.scheduled_start && (
                  <div>
                    <span className="text-slate-500">When:</span>{' '}
                    <strong>
                      {new Date(booking.scheduled_start).toLocaleString()}
                    </strong>
                  </div>
                )}
                {booking.address_line1 && (
                  <div className="mt-1">
                    <span className="text-slate-500">Where:</span>{' '}
                    <strong>
                      {booking.address_line1}, {booking.city}, {booking.state}
                    </strong>
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-900 leading-relaxed whitespace-pre-line">
                {CURRENT_BUSINESS_EMERGENCY_CONFIRMATION.text}
              </div>

              <ConfirmForm bookingId={booking.id} token={token} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
