'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ApprovalActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);

  async function handleDecision(decision: 'approve' | 'reject') {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'reject' ? rejectReason : undefined,
        }),
      });

      if (res.ok) {
        setDone(decision === 'approve' ? 'approved' : 'rejected');
        // Refresh server data after a moment
        setTimeout(() => router.refresh(), 1000);
      }
    } catch {
      // fail silently
    }
    setLoading(false);
  }

  if (done === 'approved') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium py-2">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Approved — finding an interpreter now
      </div>
    );
  }

  if (done === 'rejected') {
    return (
      <div className="text-sm text-red-700 font-medium py-2">
        Request declined
      </div>
    );
  }

  return (
    <div>
      {showRejectForm ? (
        <div className="space-y-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for declining (optional)…"
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleDecision('reject')}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Declining…' : 'Confirm Decline'}
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => handleDecision('approve')}
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? 'Approving…' : 'Approve Request'}
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={loading}
            className="px-4 py-2.5 border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
