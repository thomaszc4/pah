'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ReviewData {
  id: string;
  organization_id: string;
  organization_name: string;
  rater_name: string;
  rater_email: string;
  overall_rating: number;
  review_text: string | null;
  is_visible: boolean;
  admin_action: string | null;
  admin_notes: string | null;
  created_at: string;
}

export default function ReviewModerationCard({ review }: { review: ReviewData }) {
  const router = useRouter();
  const [notes, setNotes] = useState(review.admin_notes ?? '');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function decide(action: 'kept' | 'hidden' | 'removed') {
    setWorking(true);
    setError('');
    const res = await fetch(`/api/admin/reviews/${review.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, admin_notes: notes || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Failed');
      setWorking(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/businesses/${review.organization_id}`}
              className="font-semibold text-slate-900 hover:text-slate-700"
            >
              {review.organization_name}
            </Link>
            <div className="text-xs text-slate-600 mt-0.5">
              by {review.rater_name} ({review.rater_email}) · {new Date(review.created_at).toLocaleDateString()}
            </div>
          </div>
          <span className="text-amber-500 font-semibold">
            {'★'.repeat(review.overall_rating)}
            <span className="text-slate-300">{'★'.repeat(5 - review.overall_rating)}</span>
          </span>
        </div>
      </div>

      <div className="p-5 text-sm text-slate-800 whitespace-pre-wrap">
        {review.review_text || <span className="text-slate-500 italic">No written review (structured attributes only).</span>}
      </div>

      <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-3">
        <label htmlFor={`notes-${review.id}`} className="block text-xs font-medium text-slate-700">
          Admin notes
        </label>
        <textarea
          id={`notes-${review.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm resize-none"
          placeholder="Why you kept/hid/removed this review…"
        />
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => decide('kept')}
            disabled={working}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
          >
            Keep (dismiss flag)
          </button>
          <button
            type="button"
            onClick={() => decide('hidden')}
            disabled={working}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
          >
            Hide (keep on record)
          </button>
          <button
            type="button"
            onClick={() => decide('removed')}
            disabled={working}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
          >
            Remove permanently
          </button>
        </div>
      </div>
    </div>
  );
}
