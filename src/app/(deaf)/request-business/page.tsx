'use client';

import { useState } from 'react';

export default function RequestBusinessPage() {
  const [name, setName] = useState('');
  const [type, setType] = useState('medical');
  const [contact, setContact] = useState('');
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/business-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_name: name.trim(),
        business_type: type,
        contact_email: contact.includes('@') ? contact : null,
        contact_phone: !contact.includes('@') ? contact : null,
        reason: reason.trim() || null,
      }),
    });
    if (res.ok || res.status === 409) {
      setSent(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to submit request');
    }
    setSubmitting(false);
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-2">
        Request a business to join PAH
      </h1>
      <p className="text-slate-600 mb-6">
        Under the Americans with Disabilities Act, businesses (medical offices, law firms,
        schools, government) are legally required to provide and pay for qualified ASL
        interpreters. We&apos;ll reach out and walk them through joining.
      </p>

      {sent ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-emerald-900">Request sent</h2>
          <p className="text-sm text-emerald-800 mt-2">
            We&apos;ll reach out to {name} about joining PAH. You&apos;ll hear back as soon
            as they register.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
              Business name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-1">
              Type
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white"
            >
              <option value="medical">Medical / Healthcare</option>
              <option value="legal">Legal</option>
              <option value="educational">Educational</option>
              <option value="government">Government</option>
              <option value="corporate">Corporate</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="contact" className="block text-sm font-medium text-slate-700 mb-1">
              Their contact (email or phone)
            </label>
            <input
              id="contact"
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="reception@example.com or (555) 123-4567"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white"
            />
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-slate-700 mb-1">
              Why? (optional)
            </label>
            <textarea
              id="reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., I have an appointment there next month"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || name.trim().length < 2}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {submitting ? 'Sending…' : 'Send request'}
          </button>
        </form>
      )}
    </div>
  );
}
