'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface BookingDetail {
  id: string;
  booking_type: string;
  specialization_required: string;
  location_type: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  base_rate_cents: number;
  rush_multiplier: number;
  total_charge_cents: number | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  public_notes: string | null;
  cancellation_fee_cents: number;
  interpreter?: {
    id: string;
    experience_tier: string;
    specializations: string[];
    avg_rating: number;
    total_jobs: number;
    profiles: { full_name: string; avatar_url: string | null };
  } | null;
  organization?: { name: string; org_type: string } | null;
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchBooking();
    // Subscribe to realtime updates
    const supabase = createClient();
    const channel = supabase
      .channel(`booking:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` },
        () => fetchBooking(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function fetchBooking() {
    const res = await fetch(`/api/bookings/${id}`);
    if (res.ok) {
      setBooking(await res.json());
    }
    setLoading(false);
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setCancelling(true);
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    await fetchBooking();
    setCancelling(false);
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"
          aria-label="Loading booking details"
        />
        <span className="sr-only">Loading booking details…</span>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600">Booking not found</p>
        <Link href="/dashboard" className="text-blue-600 hover:underline mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const canCancel = !['completed', 'billed', 'cancelled', 'no_match'].includes(booking.status);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/bookings" className="text-sm text-gray-600 hover:text-gray-700 mb-4 inline-block">
        &larr; All bookings
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">
                {booking.specialization_required.charAt(0).toUpperCase() +
                  booking.specialization_required.slice(1)}{' '}
                Interpreting
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {booking.booking_type === 'urgent' ? 'Urgent Request' : 'Scheduled'}
                {' '}&middot;{' '}
                {booking.location_type === 'in_person' ? 'In Person' : 'Video Remote'}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
        </div>

        {/* Status Banners */}
        {booking.status === 'pending_business_approval' && (
          <div className="p-6 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-5 h-5 text-amber-600">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-amber-800">Waiting for business approval</p>
                <p className="text-sm text-amber-600">
                  {booking.organization?.name || 'The organization'} needs to approve this request before we find an interpreter.
                  You&apos;ll be notified once they respond.
                </p>
              </div>
            </div>
          </div>
        )}

        {booking.status === 'matching' && (
          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <div>
                <p className="font-medium text-blue-800">Finding an interpreter...</p>
                <p className="text-sm text-blue-600">We&apos;re searching for available interpreters.</p>
              </div>
            </div>
          </div>
        )}

        {booking.status === 'offered' && (
          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
              <div>
                <p className="font-medium text-blue-800">Interpreter found — waiting for confirmation</p>
                <p className="text-sm text-blue-600">
                  An interpreter has been offered this job. You&apos;ll be notified once they confirm.
                </p>
              </div>
            </div>
          </div>
        )}

        {booking.status === 'no_match' && (
          <div className="p-6 bg-amber-50 border-b border-amber-100">
            <p className="font-medium text-amber-800">No interpreters available right now</p>
            <p className="text-sm text-amber-600 mt-1">
              We couldn&apos;t find an available interpreter for this time. We&apos;ll keep trying and notify you when one becomes available.
            </p>
          </div>
        )}

        {/* Interpreter Info */}
        {booking.interpreter && booking.interpreter.profiles && (
          <div className="p-6 border-b border-slate-100 animate-fade-in">
            <h3 className="text-sm font-medium text-slate-500 mb-3">Your Interpreter</h3>
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-sm"
                aria-label={booking.interpreter.profiles.full_name ?? 'Interpreter'}
              >
                {booking.interpreter.profiles.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  {booking.interpreter.profiles.full_name ?? 'Interpreter'}
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="capitalize">{booking.interpreter.experience_tier}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>
                    {(booking.interpreter.avg_rating ?? 0) > 0
                      ? `${booking.interpreter.avg_rating} stars`
                      : 'New'}
                  </span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{booking.interpreter.total_jobs ?? 0} jobs</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="p-6 space-y-4">
          {booking.scheduled_start && (
            <div>
              <h3 className="text-sm font-medium text-gray-600">When</h3>
              <p className="mt-1">
                {new Date(booking.scheduled_start).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {' at '}
                {new Date(booking.scheduled_start).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {booking.scheduled_end && (
                  <>
                    {' - '}
                    {new Date(booking.scheduled_end).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </>
                )}
              </p>
            </div>
          )}

          {booking.address_line1 && (
            <div>
              <h3 className="text-sm font-medium text-gray-600">Where</h3>
              <p className="mt-1">
                {booking.address_line1}
                {booking.city && `, ${booking.city}`}
                {booking.state && `, ${booking.state}`}
              </p>
            </div>
          )}

          {booking.organization && (
            <div>
              <h3 className="text-sm font-medium text-gray-600">Organization</h3>
              <p className="mt-1">
                {booking.organization.name}
                <span className="text-gray-600 text-sm ml-1">
                  ({booking.organization.org_type})
                </span>
              </p>
            </div>
          )}

          {booking.public_notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-600">Notes</h3>
              <p className="mt-1 text-sm">{booking.public_notes}</p>
            </div>
          )}

          {/* Pricing */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Cost</h3>
            <div className="text-lg font-semibold">
              {booking.total_charge_cents
                ? `$${(booking.total_charge_cents / 100).toFixed(2)}`
                : 'TBD'}
            </div>
            {booking.rush_multiplier > 1 && (
              <p className="text-xs text-amber-600 mt-1">
                Includes {((booking.rush_multiplier - 1) * 100).toFixed(0)}% rush fee
              </p>
            )}
            {booking.cancellation_fee_cents > 0 && (
              <p className="text-xs text-red-600 mt-1">
                Cancellation fee: ${(booking.cancellation_fee_cents / 100).toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {canCancel && (
          <div className="p-6 border-t border-gray-100">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Booking'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    pending_business_approval: 'bg-amber-100 text-amber-800',
    matching: 'bg-blue-100 text-blue-800',
    offered: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-emerald-100 text-emerald-800',
    interpreter_en_route: 'bg-violet-100 text-violet-800',
    in_progress: 'bg-violet-100 text-violet-800',
    completed: 'bg-slate-100 text-slate-700',
    billed: 'bg-slate-100 text-slate-700',
    cancelled: 'bg-red-100 text-red-800',
    no_match: 'bg-amber-100 text-amber-800',
    disputed: 'bg-orange-100 text-orange-800',
  };

  const labels: Record<string, string> = {
    pending: 'Pending',
    pending_business_approval: 'Awaiting Business Approval',
    matching: 'Finding Interpreter',
    offered: 'Interpreter Found',
    confirmed: 'Confirmed',
    interpreter_en_route: 'On the Way',
    in_progress: 'In Progress',
    completed: 'Completed',
    billed: 'Billed',
    cancelled: 'Cancelled',
    no_match: 'No Match Found',
    disputed: 'Disputed',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  );
}
