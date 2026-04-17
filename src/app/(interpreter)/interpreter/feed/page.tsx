'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeedJob } from '@/lib/feed/generate';

export default function InterpreterFeedPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState<'7d' | '14d' | '30d'>('14d');
  const [claiming, setClaiming] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/interpreter/feed?window=${window}`);
    if (res.ok) {
      setJobs(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [window]);

  async function handleClaim(id: string) {
    setClaiming(id);
    setErrorMsg('');
    const res = await fetch('/api/interpreter/feed/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: id }),
    });
    if (res.ok) {
      router.push(`/interpreter/jobs/${id}`);
      return;
    }
    const data = await res.json();
    setErrorMsg(data.error || 'Could not claim this job.');
    await load();
    setClaiming(null);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Available jobs</h1>
        <div className="flex gap-2">
          {(['7d', '14d', '30d'] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                window === w
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {w === '7d' ? '1 week' : w === '14d' ? '2 weeks' : '1 month'}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl mb-4 text-sm"
        >
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm py-12 text-center">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-600 font-medium">No open jobs in your area right now</p>
          <p className="text-sm text-slate-500 mt-2">
            Jobs appear here when clients book in your specializations within your service
            radius. Check back soon, or expand your radius in your profile.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900 capitalize">
                      {job.specialization_required.replace(/_/g, ' ')} interpreting
                    </h3>
                    {job.is_rush && (
                      <span className="text-[10px] font-semibold uppercase bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                        Rush
                      </span>
                    )}
                    {job.booking_type === 'urgent' && (
                      <span className="text-[10px] font-semibold uppercase bg-rose-600 text-white px-1.5 py-0.5 rounded">
                        Urgent
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {job.location_type === 'in_person' ? 'In person' : 'Video remote'}
                    {job.distance_miles !== null && ` · ${job.distance_miles} mi`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleClaim(job.id)}
                  disabled={claiming === job.id}
                  className="shrink-0 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                >
                  {claiming === job.id ? 'Claiming…' : 'Claim'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">When:</span>{' '}
                  <span className="text-slate-800">
                    {job.scheduled_start
                      ? new Date(job.scheduled_start).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'ASAP'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Duration:</span>{' '}
                  <span className="text-slate-800">
                    ~{Math.round(job.estimated_duration_minutes / 60)} hr
                    {job.estimated_duration_minutes > 60 ? 's' : ''}
                  </span>
                </div>
                {job.address_line1 && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Where:</span>{' '}
                    <span className="text-slate-800">
                      {job.address_line1}, {job.city}, {job.state}
                    </span>
                  </div>
                )}
                {job.client_name && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Client:</span>{' '}
                    <span className="text-slate-800 font-medium">{job.client_name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
