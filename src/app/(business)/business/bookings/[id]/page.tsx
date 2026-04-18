'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { BookingChat } from '@/components/chat/BookingChat';
import { StatusBadge } from '@/components/ui';

interface BookingDetail {
  id: string;
  status: string;
  booking_context: string;
  specialization_required: string;
  specialization_other_description: string | null;
  location_type: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  public_notes: string | null;
  estimated_duration_minutes: number;
  total_charge_cents: number | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  requires_team: boolean;
  team_override_reason: string | null;
  vri_override_reason: string | null;
  deaf_user_id: string | null;
  interpreter_en_route_at: string | null;
  interpreter_arrived_at: string | null;
  interpreter_eta_minutes: number | null;
  interpreter?: {
    id: string;
    experience_tier: string;
    avg_rating: number;
    total_jobs: number;
    profile_photo_url: string | null;
    profiles: { full_name: string; email: string } | null;
  } | null;
  organization?: { name: string } | null;
}

export default function BusinessBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchBooking();
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
    const supabase = createClient();
    const channel = supabase
      .channel(`booking-b:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` }, () => fetchBooking())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function fetchBooking() {
    const res = await fetch(`/api/bookings/${id}`);
    if (res.ok) {
      const data = await res.json();
      setBooking(data);
      // Invitation status (best-effort)
      const supabase = createClient();
      const { data: inv } = await supabase
        .from('booking_invitations')
        .select('status')
        .eq('booking_id', id)
        .maybeSingle();
      if (inv) setInviteStatus(inv.status);
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading…</div>;
  }
  if (!booking) {
    return <p className="text-center text-slate-600 py-20">Booking not found</p>;
  }

  const chatEnabled = ['confirmed', 'interpreter_en_route', 'in_progress'].includes(booking.status);
  const interpName = booking.interpreter?.profiles?.full_name ?? null;

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/business/bookings" className="text-sm text-slate-600 hover:text-slate-900 mb-4 inline-block">
        ← All bookings
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 capitalize">
                {booking.specialization_required.replace(/_/g, ' ')} interpreting
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">
                {booking.location_type === 'in_person' ? 'In Person' : 'Video Remote'}
                {' · '}
                For {booking.client_name ?? 'client'}
              </p>
            </div>
            <StatusBadge
              status={booking.status}
              label={
                booking.status === 'pending_business_approval' ? 'Awaiting Approval' :
                booking.status === 'offered' ? 'Offered to Interpreter' :
                booking.status === 'no_match' ? 'No Interpreter Yet' :
                undefined
              }
            />
          </div>
        </div>

        {/* Invitation status */}
        {booking.client_email && inviteStatus && (
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 text-xs">
            <span className="text-slate-600">Client invitation:</span>{' '}
            <strong
              className={`capitalize ${
                inviteStatus === 'accepted'
                  ? 'text-emerald-700'
                  : inviteStatus === 'declined'
                  ? 'text-slate-700'
                  : 'text-amber-700'
              }`}
            >
              {inviteStatus}
            </strong>
            {inviteStatus === 'accepted' && ' — they can see this booking and message the interpreter.'}
            {inviteStatus === 'pending' && ' — they haven\'t opened the link yet.'}
          </div>
        )}

        {/* Team notice */}
        {booking.requires_team && !booking.team_override_reason && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-sm">
            <strong className="text-amber-900">Team of 2 required.</strong>{' '}
            <span className="text-amber-800">Both interpreter slots are being matched.</span>
          </div>
        )}

        {/* Interpreter info */}
        {booking.interpreter && (
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-sm font-medium text-slate-600 mb-3">Assigned interpreter</h3>
            <div className="flex items-center gap-4">
              {booking.interpreter.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={booking.interpreter.profile_photo_url}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                  {interpName?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900">{interpName ?? 'Interpreter'}</p>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="capitalize">{booking.interpreter.experience_tier}</span>
                  <span>·</span>
                  <span>{booking.interpreter.avg_rating > 0 ? `${booking.interpreter.avg_rating}★` : 'New'}</span>
                  <span>·</span>
                  <span>{booking.interpreter.total_jobs} jobs</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Details */}
        <div className="p-6 space-y-4 text-sm">
          {booking.scheduled_start && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-600">When</div>
              <div className="text-slate-900 mt-1">
                {new Date(booking.scheduled_start).toLocaleString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                  hour: 'numeric', minute: '2-digit',
                })}
                {' '}·{' '}
                {Math.round(booking.estimated_duration_minutes / 60)}h
              </div>
            </div>
          )}

          {booking.address_line1 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-600">Where</div>
              <div className="text-slate-900 mt-1">
                {booking.address_line1}
                {booking.city && `, ${booking.city}`}
                {booking.state && `, ${booking.state} `}
                {booking.zip}
              </div>
            </div>
          )}

          {booking.client_name && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-600">Client</div>
              <div className="text-slate-900 mt-1">{booking.client_name}</div>
              {booking.client_email && (
                <div className="text-xs text-slate-600">{booking.client_email}</div>
              )}
            </div>
          )}

          {booking.public_notes && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-600">Notes</div>
              <div className="text-slate-900 mt-1 whitespace-pre-wrap">{booking.public_notes}</div>
            </div>
          )}

          {booking.total_charge_cents != null && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-slate-600">Estimated charge</div>
              <div className="text-slate-900 mt-1 font-semibold">
                ${(booking.total_charge_cents / 100).toFixed(2)}
                {booking.requires_team && !booking.team_override_reason && ' × 2 interpreters'}
              </div>
            </div>
          )}

          {booking.vri_override_reason && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <div className="text-xs font-semibold text-rose-900">VRI override documented</div>
              <div className="text-xs text-rose-800 mt-0.5 whitespace-pre-wrap">{booking.vri_override_reason}</div>
            </div>
          )}

          {booking.team_override_reason && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <div className="text-xs font-semibold text-rose-900">Team-of-2 opt-out documented</div>
              <div className="text-xs text-rose-800 mt-0.5 whitespace-pre-wrap">{booking.team_override_reason}</div>
            </div>
          )}
        </div>

        {/* Calendar + actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2">
          <a
            href={`/api/bookings/${id}/ics`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-sm font-medium text-slate-800 transition-colors"
          >
            📅 Download .ics
          </a>
        </div>
      </div>

      {/* Chat — three-way */}
      {userId && chatEnabled && (
        <div className="mt-6">
          <BookingChat bookingId={id} currentUserId={userId} />
        </div>
      )}
    </div>
  );
}
