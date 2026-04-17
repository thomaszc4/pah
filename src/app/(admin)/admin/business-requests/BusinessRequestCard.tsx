'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'pending' | 'contacted' | 'registered' | 'declined';

interface Request {
  id: string;
  business_name: string;
  business_type: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  reason: string | null;
  status: Status;
  admin_notes: string | null;
  created_at: string;
  requester: { full_name: string; email: string } | null;
}

const STATUS_STYLES: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  registered: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-slate-100 text-slate-700',
};

export default function BusinessRequestCard({ request }: { request: Request }) {
  const router = useRouter();
  const [notes, setNotes] = useState(request.admin_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function update(status: Status) {
    setSaving(true);
    setError('');
    const res = await fetch(`/api/admin/business-requests/${request.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_notes: notes || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Update failed');
      setSaving(false);
      return;
    }
    router.refresh();
  }

  const contactLink = request.contact_email
    ? `mailto:${request.contact_email}?subject=${encodeURIComponent(`Invitation to join PAH — for ${request.business_name}`)}`
    : request.contact_phone
    ? `tel:${request.contact_phone}`
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold text-slate-900">{request.business_name}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              {request.business_type || 'Unknown type'} · requested{' '}
              {new Date(request.created_at).toLocaleDateString()}
            </div>
            {request.requester && (
              <div className="text-xs text-slate-600 mt-0.5">
                Requested by: {request.requester.full_name} ({request.requester.email})
              </div>
            )}
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full font-semibold px-2.5 py-0.5 text-xs capitalize ${STATUS_STYLES[request.status]}`}
          >
            {request.status}
          </span>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        {(request.contact_email || request.contact_phone) && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-slate-600 mb-1">
              Business contact
            </div>
            <div className="text-slate-900">{request.contact_email || request.contact_phone}</div>
            {contactLink && (
              <a
                href={contactLink}
                className="inline-block mt-1 text-xs font-medium text-blue-700 hover:text-blue-800 underline underline-offset-4"
              >
                Reach out →
              </a>
            )}
          </div>
        )}
        {request.address && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-slate-600 mb-1">
              Address
            </div>
            <div className="text-slate-900">{request.address}</div>
          </div>
        )}
        {request.reason && (
          <div className="sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-600 mb-1">
              Reason
            </div>
            <div className="text-slate-800">{request.reason}</div>
          </div>
        )}
      </div>

      <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-3">
        <label htmlFor={`notes-${request.id}`} className="block text-xs font-medium text-slate-700">
          Internal notes
        </label>
        <textarea
          id={`notes-${request.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          placeholder="Who you spoke to, what's blocking, next step…"
        />
        {error && (
          <p role="alert" className="text-xs text-rose-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {request.status !== 'contacted' && (
            <button
              type="button"
              onClick={() => update('contacted')}
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              Mark contacted
            </button>
          )}
          {request.status !== 'registered' && (
            <button
              type="button"
              onClick={() => update('registered')}
              disabled={saving}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              Mark registered
            </button>
          )}
          {request.status !== 'declined' && (
            <button
              type="button"
              onClick={() => update('declined')}
              disabled={saving}
              className="px-3 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              Decline
            </button>
          )}
          {request.status !== 'pending' && (
            <button
              type="button"
              onClick={() => update('pending')}
              disabled={saving}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium disabled:opacity-50"
            >
              Move to pending
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
