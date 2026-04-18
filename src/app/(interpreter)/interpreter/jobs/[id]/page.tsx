'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { BookingChat } from '@/components/chat/BookingChat';
import { LocationPusher } from './LocationPusher';
import { StatusBadge } from '@/components/ui';

interface Booking {
  id: string;
  status: string;
  specialization_required: string;
  location_type: string;
  scheduled_start: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  public_notes: string | null;
  estimated_duration_minutes: number;
  client_name: string | null;
  authorized_max_minutes: number | null;
  interpreter_payout_cents: number | null;
  booking_type: string;
}

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [waitMinutes, setWaitMinutes] = useState(0);
  const [interpreterNotes, setInterpreterNotes] = useState('');
  const [respondLoading, setRespondLoading] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [deafIntroVideo, setDeafIntroVideo] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    fetchBooking();
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
    // Realtime
    const supabase = createClient();
    const channel = supabase
      .channel(`booking:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` }, () => fetchBooking())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function fetchBooking() {
    const res = await fetch(`/api/bookings/${id}`);
    if (res.ok) {
      const data = await res.json();
      setBooking(data);
      // #6 Fetch Deaf user's intro video (shown only when offered)
      if (data.deaf_user_id && ['offered', 'confirmed', 'interpreter_en_route', 'in_progress'].includes(data.status)) {
        const supabase = createClient();
        const { data: prefs } = await supabase
          .from('deaf_user_preferences')
          .select('intro_video_url')
          .eq('user_id', data.deaf_user_id)
          .maybeSingle();
        if (prefs?.intro_video_url) setDeafIntroVideo(prefs.intro_video_url);
      }
    }
    setLoading(false);
  }

  async function handleRespond(decision: 'accept' | 'decline') {
    setRespondLoading(true);
    await fetch(`/api/bookings/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason: decision === 'decline' ? declineReason : undefined }),
    });
    await fetchBooking();
    setRespondLoading(false);
    setShowDeclineForm(false);
  }

  async function handleEnRoute() {
    setActionLoading(true);
    await fetch(`/api/bookings/${id}/en-route`, { method: 'POST' });
    await fetchBooking();
    setActionLoading(false);
  }

  async function handleArrived() {
    setActionLoading(true);
    await fetch(`/api/bookings/${id}/arrived`, { method: 'POST' });
    await fetchBooking();
    setActionLoading(false);
  }

  async function handleComplete() {
    setActionLoading(true);
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'checkout',
        wait_time_minutes: waitMinutes,
        interpreter_notes: interpreterNotes,
      }),
    });
    await fetchBooking();
    setActionLoading(false);
  }

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading…</div>;
  }
  if (!booking) {
    return <p className="text-center text-slate-600 py-20">Job not found</p>;
  }

  const status = booking.status;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/interpreter/jobs" className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block font-medium">
        ← Back to jobs
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 capitalize">
                {booking.specialization_required.replace(/_/g, ' ')} Interpreting
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {booking.location_type === 'in_person' ? 'In Person' : 'Video Remote'}
                {booking.booking_type === 'urgent' && (
                  <span className="ml-2 text-rose-600 font-semibold">URGENT</span>
                )}
              </p>
            </div>
            <StatusBadge
              status={status}
              label={status === 'offered' ? 'Offer pending' : undefined}
            />
          </div>
        </div>

        {/* #21 Client name prominently displayed */}
        {booking.client_name && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <div className="text-xs font-medium uppercase tracking-wider text-blue-700">Client</div>
            <div className="text-lg font-semibold text-blue-900 mt-0.5">{booking.client_name}</div>
          </div>
        )}

        {/* #6 Deaf intro video */}
        {deafIntroVideo && ['offered', 'confirmed'].includes(status) && (
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Client introduction video
            </div>
            <video controls src={deafIntroVideo} className="w-full rounded-xl border border-slate-200" />
          </div>
        )}

        <div className="p-6 space-y-4">
          {booking.scheduled_start && (
            <DetailRow label="When">
              {new Date(booking.scheduled_start).toLocaleString()}
            </DetailRow>
          )}
          {booking.address_line1 && (
            <DetailRow label="Where">
              {booking.address_line1}
              {booking.city && `, ${booking.city}`}
              {booking.state && `, ${booking.state}`} {booking.zip || ''}
            </DetailRow>
          )}
          <DetailRow label="Duration">
            ~{Math.round(booking.estimated_duration_minutes / 60)} hour(s)
            {booking.authorized_max_minutes && (
              <span className="ml-2 text-xs font-medium text-blue-700 bg-blue-100 rounded-full px-2 py-0.5">
                capped at {Math.round(booking.authorized_max_minutes / 60)}h
              </span>
            )}
          </DetailRow>
          {booking.public_notes && (
            <DetailRow label="Client notes">
              <span className="text-sm">{booking.public_notes}</span>
            </DetailRow>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-slate-100 space-y-4">
          {status === 'offered' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-blue-900">You&apos;ve been offered this job</h3>
                <p className="text-xs text-blue-700 mt-1">
                  Review the details above and accept or decline. If you decline, the job moves on.
                </p>
              </div>
              {showDeclineForm ? (
                <div className="space-y-2">
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Reason for declining (optional)"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond('decline')}
                      disabled={respondLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {respondLoading ? 'Declining…' : 'Confirm Decline'}
                    </button>
                    <button
                      onClick={() => setShowDeclineForm(false)}
                      className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond('accept')}
                    disabled={respondLoading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium disabled:opacity-50"
                  >
                    {respondLoading ? 'Accepting…' : 'Accept Job'}
                  </button>
                  <button
                    onClick={() => setShowDeclineForm(true)}
                    disabled={respondLoading}
                    className="px-5 py-3 border border-red-200 text-red-700 rounded-xl font-medium hover:bg-red-50"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'confirmed' && (
            <button
              onClick={handleEnRoute}
              disabled={actionLoading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl font-medium disabled:opacity-50"
            >
              {actionLoading ? 'Updating…' : "I'm on my way"}
            </button>
          )}

          {status === 'interpreter_en_route' && (
            <button
              onClick={handleArrived}
              disabled={actionLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium disabled:opacity-50"
            >
              {actionLoading ? 'Updating…' : "I've arrived — start session"}
            </button>
          )}

          {status === 'in_progress' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="wait" className="block text-sm font-medium text-slate-700 mb-1">
                  Wait time before session started (min)
                </label>
                <input
                  id="wait"
                  type="number"
                  min={0}
                  value={waitMinutes}
                  onChange={(e) => setWaitMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white"
                />
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                  Session notes (NO medical details)
                </label>
                <textarea
                  id="notes"
                  value={interpreterNotes}
                  onChange={(e) => setInterpreterNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white resize-none"
                />
              </div>
              <button
                onClick={handleComplete}
                disabled={actionLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Completing…' : 'End session'}
              </button>
            </div>
          )}

          {status === 'completed' && (
            <div className="text-center py-4">
              <p className="text-emerald-700 font-semibold">Session completed</p>
              {booking.interpreter_payout_cents && (
                <p className="text-2xl font-semibold text-slate-900 mt-2 tracking-tight">
                  +${(booking.interpreter_payout_cents / 100).toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* ICS download — available at any point after scheduling */}
          {booking.scheduled_start && (
            <a
              href={`/api/bookings/${id}/ics`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-800 transition-colors"
            >
              📅 Add to calendar
            </a>
          )}
        </div>
      </div>

      {/* #13 Location pusher — runs only when en-route */}
      {status === 'interpreter_en_route' && (
        <div className="mt-4">
          <LocationPusher bookingId={id} />
        </div>
      )}

      {/* #8/#12 Chat */}
      {userId && ['confirmed', 'interpreter_en_route', 'in_progress'].includes(status) && (
        <div className="mt-6">
          <BookingChat bookingId={id} currentUserId={userId} />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</h3>
      <p className="mt-1 text-slate-900">{children}</p>
    </div>
  );
}

