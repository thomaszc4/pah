'use client';

import { useState } from 'react';
import { CURRENT_BUSINESS_EMERGENCY_CONFIRMATION } from '@/lib/attestation/ada';

export default function ConfirmForm({ bookingId, token }: { bookingId: string; token: string }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!agreed || !name.trim()) return;
    setSubmitting(true);
    setError('');
    const res = await fetch(`/api/confirm/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signer_name: name.trim(),
        signer_title: title.trim() || null,
        version: CURRENT_BUSINESS_EMERGENCY_CONFIRMATION.version,
        booking_id: bookingId,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Confirmation failed');
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div className="font-semibold text-emerald-900">Confirmation received.</div>
        <p className="text-sm text-emerald-800 mt-1">
          The interpreter has been notified. Thank you for meeting your ADA obligation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
          Your full name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          autoComplete="name"
        />
      </div>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
          Your role at the business (optional)
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
          placeholder="e.g., Office Manager"
        />
      </div>
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-slate-800">
          I am authorized to bind the business and agree to the attestation above.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !agreed || !name.trim()}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Confirming…' : 'Authorize &amp; notify interpreter'}
      </button>
      <p className="text-[10px] text-slate-500">
        Version {CURRENT_BUSINESS_EMERGENCY_CONFIRMATION.version} ·{' '}
        {CURRENT_BUSINESS_EMERGENCY_CONFIRMATION.hash}
      </p>
    </div>
  );
}
