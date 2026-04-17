'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const POSITIVE_TAGS = [
  'Punctual',
  'Clear signing',
  'Professional',
  'Prepared',
  'Kind',
  'Understood me',
];

const NEGATIVE_TAGS = [
  'Late',
  'Unclear',
  'Unprofessional',
  'Rushed',
  'Did not understand context',
];

export default function FeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [wouldRebook, setWouldRebook] = useState<boolean | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableTags = rating >= 4 ? POSITIVE_TAGS : rating > 0 && rating <= 3 ? NEGATIVE_TAGS : [...POSITIVE_TAGS, ...NEGATIVE_TAGS];

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const path = `${user.id}/${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { error: uploadErr } = await supabase.storage
        .from('feedback-videos')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('feedback-videos').getPublicUrl(path);
      setVideoUrl(urlData.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setVideoUploading(false);
  }

  async function submit() {
    if (rating === 0) {
      setError('Please select a star rating');
      return;
    }
    setLoading(true);
    setError('');
    const res = await fetch(`/api/bookings/${id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating,
        tags,
        review_text: reviewText.trim() || null,
        would_rebook: wouldRebook,
        video_feedback_url: videoUrl,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to submit feedback');
      setLoading(false);
      return;
    }
    router.push(`/bookings/${id}?feedback=thanks`);
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-2">
        How was your interpreter?
      </h1>
      <p className="text-slate-600 mb-6">
        Your feedback helps other Deaf users and improves the service.
      </p>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 text-sm"
        >
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Stars */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Rating</label>
          <div className="flex gap-2" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                onClick={() => setRating(n)}
                className={`w-14 h-14 rounded-xl text-3xl transition ${
                  rating >= n
                    ? 'bg-amber-100 text-amber-500'
                    : 'bg-slate-50 text-slate-300 hover:text-slate-400'
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        {rating > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">What stood out?</label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition ${
                    tags.includes(t)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Would rebook */}
        {rating > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Would you book this interpreter again?
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setWouldRebook(true)}
                className={`flex-1 p-2.5 rounded-xl border-2 text-sm font-medium transition ${
                  wouldRebook === true
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setWouldRebook(false)}
                className={`flex-1 p-2.5 rounded-xl border-2 text-sm font-medium transition ${
                  wouldRebook === false
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                No
              </button>
            </div>
          </div>
        )}

        {/* Written feedback */}
        <div>
          <label htmlFor="text" className="block text-sm font-medium text-slate-700 mb-2">
            Written feedback (optional)
          </label>
          <textarea
            id="text"
            rows={3}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="Tell us more about your experience..."
          />
        </div>

        {/* Signed (video) feedback */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Signed feedback (optional)
          </label>
          {videoUrl ? (
            <div className="space-y-2">
              <video controls src={videoUrl} className="w-full rounded-xl border border-slate-200" />
              <button
                type="button"
                onClick={() => setVideoUrl(null)}
                className="text-xs text-rose-600 font-medium"
              >
                Remove
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="video/*"
              onChange={handleVideo}
              disabled={videoUploading}
              className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white file:cursor-pointer hover:file:bg-slate-800"
            />
          )}
          {videoUploading && <p className="text-xs text-blue-600 mt-1">Uploading…</p>}
          <p className="text-xs text-slate-500 mt-1">Only the rated interpreter will see this.</p>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={loading || rating === 0}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? 'Submitting…' : 'Submit feedback'}
        </button>
      </div>
    </div>
  );
}
