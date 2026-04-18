'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { RATING_ATTRIBUTES } from '@/types';

interface BookingInfo {
  organization_id: string | null;
  organization: { name: string } | null;
  status: string;
}

export default function BusinessReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [overallRating, setOverallRating] = useState(0);
  const [attributes, setAttributes] = useState<Record<string, boolean>>({});
  const [reviewText, setReviewText] = useState('');

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('bookings')
        .select('organization_id, status, organization:organizations(name)')
        .eq('id', id)
        .maybeSingle();
      setBooking(data as unknown as BookingInfo | null);
      setLoading(false);
    })();
  }, [id]);

  function toggleAttr(key: string, value: boolean) {
    setAttributes((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    if (!booking?.organization_id) {
      setError('This booking has no associated business to review.');
      return;
    }
    if (overallRating === 0) {
      setError('Please select a star rating.');
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await fetch(`/api/organizations/${booking.organization_id}/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: id,
        overall_rating: overallRating,
        attributes,
        review_text: reviewText.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to submit review');
      setSubmitting(false);
      return;
    }
    router.push(`/bookings/${id}?business_feedback=thanks`);
  }

  if (loading) return <div className="py-12 text-slate-500">Loading…</div>;
  if (!booking?.organization_id) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <p className="text-slate-700 font-medium">This booking wasn&apos;t at a business, so there&apos;s nothing to review here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-2">
        Rate {booking.organization?.name ?? 'this business'}
      </h1>
      <p className="text-slate-600 mb-6">
        Your review helps other Deaf clients decide where to go — and it holds businesses
        accountable to the standard they&apos;re legally required to meet.
      </p>

      {error && (
        <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Stars */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Overall experience</label>
          <div className="flex gap-2" role="radiogroup" aria-label="Overall rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={overallRating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                onClick={() => setOverallRating(n)}
                className={`w-14 h-14 rounded-xl text-3xl transition ${
                  overallRating >= n
                    ? 'bg-amber-100 text-amber-500'
                    : 'bg-slate-50 text-slate-300 hover:text-slate-400'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* Structured attributes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">
            Check any that apply
          </label>
          <div className="space-y-2">
            {RATING_ATTRIBUTES.map((a) => (
              <label
                key={a.key}
                className="flex items-start gap-2.5 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={attributes[a.key] === true}
                  onChange={(e) => toggleAttr(a.key, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-800">
                  {a.label}
                  {!a.positive && (
                    <span className="ml-2 inline-block text-[10px] font-semibold uppercase text-rose-700">
                      Warning sign
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Written review */}
        <div>
          <label htmlFor="text" className="block text-sm font-medium text-slate-700 mb-2">
            Written feedback (optional)
          </label>
          <textarea
            id="text"
            rows={4}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            maxLength={2000}
            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            placeholder="Tell the Deaf community what happened at your appointment. No names of individual staff — rate the place, not people."
          />
          <p className="text-xs text-slate-600 mt-1">
            Keep it constructive and stick to your own experience. Reviews can be flagged
            and moderated by PAH admins.
          </p>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={submitting || overallRating === 0}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {submitting ? 'Submitting…' : 'Post review'}
        </button>
      </div>
    </div>
  );
}
