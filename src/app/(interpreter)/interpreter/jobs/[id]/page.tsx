'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [waitMinutes, setWaitMinutes] = useState(0);
  const [interpreterNotes, setInterpreterNotes] = useState('');
  const [overageMinutes, setOverageMinutes] = useState(30);
  const [overageRequested, setOverageRequested] = useState(false);
  const [overageLoading, setOverageLoading] = useState(false);
  const [respondLoading, setRespondLoading] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);

  useEffect(() => {
    fetchBooking();
  }, [id]);

  async function fetchBooking() {
    const res = await fetch(`/api/bookings/${id}`);
    if (res.ok) {
      const data = await res.json();
      setBooking(data);
      if (data.overage_requested_at) setOverageRequested(true);
    }
    setLoading(false);
  }

  async function handleAction(action: string) {
    setActionLoading(true);
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        wait_time_minutes: waitMinutes,
        interpreter_notes: interpreterNotes,
      }),
    });
    await fetchBooking();
    setActionLoading(false);
  }

  async function handleRequestOverage() {
    setOverageLoading(true);
    try {
      const res = await fetch(`/api/bookings/${id}/overage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additional_minutes: overageMinutes }),
      });
      if (res.ok) {
        setOverageRequested(true);
      }
    } catch {
      // silently fail
    }
    setOverageLoading(false);
  }

  async function handleRespond(decision: 'accept' | 'decline') {
    setRespondLoading(true);
    try {
      const res = await fetch(`/api/bookings/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'decline' ? declineReason : undefined,
        }),
      });
      if (res.ok) {
        await fetchBooking();
      }
    } catch {
      // silently fail
    }
    setRespondLoading(false);
    setShowDeclineForm(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (!booking) {
    return <p className="text-center text-slate-600 py-20">Job not found</p>;
  }

  const status = String(booking.status);
  const hasMaxMinutes = !!booking.authorized_max_minutes;
  const maxMinutes = Number(booking.authorized_max_minutes) || 0;

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/interpreter/jobs"
        className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block font-medium"
      >
        ← Back to jobs
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {String(booking.specialization_required).charAt(0).toUpperCase() +
                  String(booking.specialization_required).slice(1)}{' '}
                Interpreting
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {booking.location_type === 'in_person' ? 'In Person' : 'Video Remote'}
              </p>
            </div>
            <StatusBadge status={status} />
          </div>
        </div>

        {/* Job Details */}
        <div className="p-6 space-y-4">
          {!!booking.scheduled_start && (
            <DetailRow label="When">
              {new Date(String(booking.scheduled_start)).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </DetailRow>
          )}

          {!!booking.address_line1 && (
            <DetailRow label="Where">
              {String(booking.address_line1)}
              {booking.city ? `, ${String(booking.city)}` : ''}
              {booking.state ? `, ${String(booking.state)}` : ''} {booking.zip ? String(booking.zip) : ''}
            </DetailRow>
          )}

          {!!booking.public_notes && (
            <DetailRow label="Client notes">
              <span className="text-sm">{String(booking.public_notes)}</span>
            </DetailRow>
          )}

          <DetailRow label="Estimated duration">
            {Math.round(Number(booking.estimated_duration_minutes) / 60)} hour(s)
            {hasMaxMinutes && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                Org cap: {maxMinutes >= 60 ? `${maxMinutes / 60}h` : `${maxMinutes}m`}
              </span>
            )}
          </DetailRow>
        </div>

        {/* Actions based on status */}
        <div className="p-6 border-t border-slate-100 space-y-4">
          {/* Offered — interpreter must accept or decline */}
          {status === 'offered' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-2">
                <h3 className="text-sm font-semibold text-blue-900">You&apos;ve been offered this job</h3>
                <p className="text-xs text-blue-700 mt-1">
                  Review the details above and accept or decline. If you decline, the job will be offered to another interpreter.
                </p>
              </div>

              {showDeclineForm ? (
                <div className="space-y-2">
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Reason for declining (optional)…"
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespond('decline')}
                      disabled={respondLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {respondLoading ? 'Declining…' : 'Confirm Decline'}
                    </button>
                    <button
                      onClick={() => setShowDeclineForm(false)}
                      className="px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
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
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-colors"
                  >
                    {respondLoading ? 'Accepting…' : 'Accept Job'}
                  </button>
                  <button
                    onClick={() => setShowDeclineForm(true)}
                    disabled={respondLoading}
                    className="px-5 py-3 border border-red-200 text-red-700 rounded-xl font-medium hover:bg-red-50 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'confirmed' && (
            <>
              <button
                onClick={() => handleAction('en_route')}
                disabled={actionLoading}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Updating…' : "I'm on my way"}
              </button>
              <button
                onClick={() => handleAction('checkin')}
                disabled={actionLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Updating…' : "I've arrived — start session"}
              </button>
            </>
          )}

          {status === 'interpreter_en_route' && (
            <button
              onClick={() => handleAction('checkin')}
              disabled={actionLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Updating…' : "I've arrived — start session"}
            </button>
          )}

          {status === 'in_progress' && (
            <div className="space-y-5">
              {/* Overage request (only show if org-capped booking) */}
              {hasMaxMinutes && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">
                    Session running long?
                  </h3>
                  <p className="text-xs text-blue-700 mb-3">
                    This booking is capped at {maxMinutes >= 60 ? `${maxMinutes / 60} hour${maxMinutes > 60 ? 's' : ''}` : `${maxMinutes} min`} by the organization.
                    Request additional time and they'll be notified for approval.
                  </p>

                  {overageRequested ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Extension requested — waiting for org approval
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={overageMinutes}
                        onChange={(e) => setOverageMinutes(Number(e.target.value))}
                        className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white"
                      >
                        <option value={15}>+15 min</option>
                        <option value={30}>+30 min</option>
                        <option value={60}>+1 hour</option>
                        <option value={90}>+1.5 hours</option>
                        <option value={120}>+2 hours</option>
                      </select>
                      <button
                        onClick={handleRequestOverage}
                        disabled={overageLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        {overageLoading ? 'Requesting…' : 'Request extra time'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="wait" className="block text-sm font-medium text-slate-700 mb-1">
                  Wait time before session started (minutes)
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
                  Session notes (optional, NO medical/legal details)
                </label>
                <textarea
                  id="notes"
                  value={interpreterNotes}
                  onChange={(e) => setInterpreterNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white resize-none"
                  placeholder="General notes about the session…"
                />
                {String(booking.specialization_required) === 'medical' && (
                  <p className="text-xs text-red-600 mt-1">
                    HIPAA: Do NOT include patient names, diagnoses, or treatment details.
                  </p>
                )}
              </div>

              <button
                onClick={() => handleAction('checkout')}
                disabled={actionLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Completing…' : 'End session'}
              </button>
            </div>
          )}

          {status === 'completed' && (
            <div className="text-center py-4">
              <p className="text-emerald-700 font-semibold">Session completed</p>
              {!!booking.interpreter_payout_cents && (
                <p className="text-2xl font-semibold text-slate-900 mt-2 tracking-tight">
                  +${(Number(booking.interpreter_payout_cents) / 100).toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    offered: 'bg-amber-100 text-amber-800',
    confirmed: 'bg-emerald-100 text-emerald-800',
    interpreter_en_route: 'bg-violet-100 text-violet-800',
    in_progress: 'bg-violet-100 text-violet-800',
    completed: 'bg-slate-100 text-slate-700',
    billed: 'bg-slate-100 text-slate-700',
    cancelled: 'bg-red-100 text-red-800',
  };
  const labels: Record<string, string> = {
    offered: 'Offer Pending',
    confirmed: 'Confirmed',
    interpreter_en_route: 'On the Way',
    in_progress: 'In Progress',
    completed: 'Completed',
    billed: 'Completed',
    cancelled: 'Cancelled',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      {labels[status] || status}
    </span>
  );
}
