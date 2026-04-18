'use client';

import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookingChat } from '@/components/chat/BookingChat';
import { LiveLocationMap } from '@/components/map/LiveLocationMap';
import { shouldHidePriceFromDeafUser } from '@/lib/pricing/visibility';
import { StatusBadge } from '@/components/ui';

interface BookingDetail {
  id: string;
  booking_type: string;
  booking_context: 'personal' | 'emergency' | 'business';
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
  lat: number | null;
  lng: number | null;
  public_notes: string | null;
  cancellation_fee_cents: number;
  interpreter_eta_minutes: number | null;
  rematch_count: number;
  deaf_user_id: string | null;
  organization_id: string | null;
  interpreter?: {
    id: string;
    experience_tier: string;
    specializations: string[];
    avg_rating: number;
    total_jobs: number;
    profile_photo_url: string | null;
    current_lat: number | null;
    current_lng: number | null;
    last_location_update: string | null;
    profiles: { full_name: string; avatar_url: string | null };
  } | null;
  organization?: { name: string; org_type: string } | null;
}

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [fallbackLoading, setFallbackLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchBooking();
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
    const supabase = createClient();
    const channel = supabase
      .channel(`booking-d:${id}`)
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
    if (res.ok) setBooking(await res.json());
    setLoading(false);
  }

  async function handleCancel() {
    if (!confirm('Cancel this booking?')) return;
    setCancelling(true);
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    await fetchBooking();
    setCancelling(false);
  }

  async function handleRematch() {
    if (!confirm('Request a different interpreter? The current assignment will be revoked.')) return;
    setRematching(true);
    const res = await fetch(`/api/bookings/${id}/rematch`, { method: 'POST' });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Rematch failed');
    }
    await fetchBooking();
    setRematching(false);
  }

  async function handleFallback(option: 'wait' | 'vri' | 'reschedule' | 'cancel') {
    setFallbackLoading(option);
    if (option === 'reschedule') {
      const newTime = prompt('New start time? (YYYY-MM-DDTHH:MM)');
      if (!newTime) { setFallbackLoading(null); return; }
      const start = new Date(newTime);
      const durationMs = booking?.scheduled_start && booking?.scheduled_end
        ? new Date(booking.scheduled_end).getTime() - new Date(booking.scheduled_start).getTime()
        : 2 * 60 * 60 * 1000;
      await fetch(`/api/bookings/${id}/fallback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option,
          new_scheduled_start: start.toISOString(),
          new_scheduled_end: new Date(start.getTime() + durationMs).toISOString(),
        }),
      });
    } else {
      await fetch(`/api/bookings/${id}/fallback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option }),
      });
    }
    await fetchBooking();
    setFallbackLoading(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-busy="true">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600">Booking not found</p>
        <Link href="/dashboard" className="text-blue-600 hover:underline mt-2 inline-block">Back</Link>
      </div>
    );
  }

  const canCancel = !['completed', 'billed', 'cancelled', 'no_match'].includes(booking.status);
  const canRematch = ['offered', 'confirmed'].includes(booking.status) && (booking.rematch_count ?? 0) < 3;
  const hidePrice = shouldHidePriceFromDeafUser(booking);
  const showMap = ['interpreter_en_route', 'in_progress'].includes(booking.status);
  const chatEnabled = ['confirmed', 'interpreter_en_route', 'in_progress'].includes(booking.status);
  const showFeedbackPrompt = ['completed', 'billed'].includes(booking.status);

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/bookings" className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block">
        ← All bookings
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold capitalize text-slate-900">
                {booking.specialization_required.replace(/_/g, ' ')} Interpreting
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {booking.booking_type === 'urgent' ? 'Urgent Request' : 'Scheduled'}
                {' · '}
                {booking.location_type === 'in_person' ? 'In Person' : 'Video Remote'}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
        </div>

        {/* Status banners */}
        {booking.status === 'pending_business_approval' && (
          <div className="p-6 bg-amber-50 border-b border-amber-100">
            <p className="font-medium text-amber-900">Waiting for business approval</p>
            <p className="text-sm text-amber-700 mt-1">
              {booking.organization?.name || 'The organization'} needs to approve this request.
            </p>
          </div>
        )}

        {booking.status === 'matching' && (
          <div className="p-6 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <p className="text-blue-800 font-medium">Finding an interpreter…</p>
          </div>
        )}

        {/* #10 Fallback options when no match found */}
        {booking.status === 'no_match' && (
          <div className="p-6 bg-amber-50 border-b border-amber-100">
            <p className="font-medium text-amber-900 mb-1">No interpreters available for this time</p>
            <p className="text-sm text-amber-700 mb-4">What would you like to do?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleFallback('wait')}
                disabled={fallbackLoading !== null}
                className="p-3 bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 text-left"
              >
                <div className="font-semibold text-sm">Keep looking</div>
                <div className="text-xs text-slate-500 mt-0.5">Notify me when found</div>
              </button>
              {booking.location_type === 'in_person' && (
                <button
                  onClick={() => handleFallback('vri')}
                  disabled={fallbackLoading !== null}
                  className="p-3 bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 text-left"
                >
                  <div className="font-semibold text-sm">Try VRI instead</div>
                  <div className="text-xs text-slate-500 mt-0.5">Video remote (faster)</div>
                </button>
              )}
              <button
                onClick={() => handleFallback('reschedule')}
                disabled={fallbackLoading !== null}
                className="p-3 bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 text-left"
              >
                <div className="font-semibold text-sm">Pick a new time</div>
                <div className="text-xs text-slate-500 mt-0.5">Reschedule</div>
              </button>
              <button
                onClick={() => handleFallback('cancel')}
                disabled={fallbackLoading !== null}
                className="p-3 bg-white rounded-xl border-2 border-rose-200 hover:border-rose-300 text-left"
              >
                <div className="font-semibold text-sm text-rose-700">Cancel</div>
                <div className="text-xs text-slate-500 mt-0.5">No charge</div>
              </button>
            </div>
          </div>
        )}

        {booking.status === 'offered' && (
          <div className="p-6 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <p className="text-blue-800 font-medium">
              Interpreter found — waiting for confirmation
            </p>
          </div>
        )}

        {booking.status === 'interpreter_en_route' && booking.interpreter_eta_minutes !== null && (
          <div className="p-6 bg-violet-50 border-b border-violet-100">
            <p className="font-medium text-violet-900">
              Your interpreter is on the way — ETA ~{booking.interpreter_eta_minutes} min
            </p>
          </div>
        )}

        {/* Interpreter info */}
        {booking.interpreter?.profiles && (
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-sm font-medium text-slate-500 mb-3">Your interpreter</h3>
            <div className="flex items-center gap-4">
              {booking.interpreter.profile_photo_url ? (
                <img
                  src={booking.interpreter.profile_photo_url}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                  {booking.interpreter.profiles.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-slate-900">
                  {booking.interpreter.profiles.full_name ?? 'Interpreter'}
                </p>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="capitalize">{booking.interpreter.experience_tier}</span>
                  <span>·</span>
                  <span>
                    {(booking.interpreter.avg_rating ?? 0) > 0
                      ? `${booking.interpreter.avg_rating}★`
                      : 'New'}
                  </span>
                  <span>·</span>
                  <span>{booking.interpreter.total_jobs ?? 0} jobs</span>
                </div>
                {booking.interpreter.current_lat !== null
                  && booking.interpreter.current_lng !== null
                  && booking.lat !== null
                  && booking.lng !== null && (
                  <div className="text-xs text-slate-500 mt-1">
                    {computeDistanceMiles(
                      Number(booking.interpreter.current_lat),
                      Number(booking.interpreter.current_lng),
                      Number(booking.lat),
                      Number(booking.lng),
                    ).toFixed(1)}{' '}
                    mi from the appointment
                  </div>
                )}
              </div>
              {canRematch && (
                <button
                  onClick={handleRematch}
                  disabled={rematching}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50"
                >
                  {rematching ? 'Rematching…' : 'Different one'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Details */}
        <div className="p-6 space-y-4">
          {booking.scheduled_start && (
            <div>
              <h3 className="text-sm font-medium text-slate-500">When</h3>
              <p className="mt-1">
                {new Date(booking.scheduled_start).toLocaleString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
              </p>
            </div>
          )}
          {booking.address_line1 && (
            <div>
              <h3 className="text-sm font-medium text-slate-500">Where</h3>
              <p className="mt-1">
                {booking.address_line1}
                {booking.city && `, ${booking.city}`}
                {booking.state && `, ${booking.state}`}
              </p>
            </div>
          )}
          {booking.organization && (
            <div>
              <h3 className="text-sm font-medium text-slate-500">Organization</h3>
              <p className="mt-1">
                {booking.organization.name}
                <span className="text-slate-500 text-sm ml-1">({booking.organization.org_type})</span>
              </p>
            </div>
          )}
          {booking.public_notes && (
            <div>
              <h3 className="text-sm font-medium text-slate-500">Notes</h3>
              <p className="mt-1 text-sm">{booking.public_notes}</p>
            </div>
          )}

          {/* #3 Price: hidden for business bookings */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-600 mb-1">Cost</h3>
            {hidePrice ? (
              <div>
                <div className="text-lg font-semibold text-emerald-700">No charge to you</div>
                <p className="text-xs text-slate-600 mt-1">
                  {booking.organization?.name || 'The business'} is billed under the ADA.
                </p>
              </div>
            ) : (
              <>
                <div className="text-lg font-semibold">
                  {booking.total_charge_cents ? `$${(booking.total_charge_cents / 100).toFixed(2)}` : 'TBD'}
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
              </>
            )}
          </div>
        </div>

        {/* Feedback prompt (#7) */}
        {showFeedbackPrompt && (
          <div className="p-6 border-t border-slate-100 bg-amber-50 space-y-2">
            <h3 className="font-semibold text-amber-900">How was your experience?</h3>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/bookings/${id}/feedback`}
                className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium"
              >
                Rate the interpreter
              </Link>
              {booking.organization_id && (
                <Link
                  href={`/bookings/${id}/feedback/business`}
                  className="inline-flex items-center px-4 py-2 bg-white border border-amber-400 text-amber-900 hover:bg-amber-100 rounded-xl text-sm font-medium"
                >
                  Rate {booking.organization?.name ?? 'the business'}
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Actions row */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <a
            href={`/api/bookings/${id}/ics`}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-800 transition-colors"
          >
            📅 Add to calendar
          </a>
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-rose-700 hover:text-rose-800 text-sm font-medium disabled:opacity-50"
            >
              {cancelling ? 'Cancelling…' : 'Cancel booking'}
            </button>
          )}
        </div>
      </div>

      {/* #13 Live map */}
      {showMap && (
        <div className="mt-4">
          <LiveLocationMap
            bookingId={id}
            destinationLat={booking.lat !== null ? Number(booking.lat) : null}
            destinationLng={booking.lng !== null ? Number(booking.lng) : null}
          />
        </div>
      )}

      {/* #8 Chat */}
      {userId && chatEnabled && (
        <div className="mt-6">
          <BookingChat bookingId={id} currentUserId={userId} />
        </div>
      )}
    </div>
  );
}

function computeDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

