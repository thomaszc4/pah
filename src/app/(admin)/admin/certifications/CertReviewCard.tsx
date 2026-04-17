'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CertData {
  id: string;
  cert_type: string;
  cert_type_label: string;
  cert_number: string | null;
  cert_other_description: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  submitted_at: string;
  interpreter_name: string;
  interpreter_email: string;
  interpreter_years: number;
  interpreter_headline: string | null;
  interpreter_photo: string | null;
}

export default function CertReviewCard({ cert }: { cert: CertData }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  async function decide(decision: 'verify' | 'reject' | 'expire') {
    setWorking(true);
    setError('');
    const res = await fetch(`/api/admin/certifications/${cert.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        reason: decision === 'reject' ? reason : null,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Failed');
      setWorking(false);
      return;
    }
    router.refresh();
  }

  const lookupHint = getLookupHint(cert.cert_type);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start gap-4">
          {cert.interpreter_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cert.interpreter_photo}
              alt=""
              className="w-12 h-12 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shrink-0">
              {cert.interpreter_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900">{cert.interpreter_name}</div>
            <div className="text-xs text-slate-600">{cert.interpreter_email}</div>
            {cert.interpreter_headline && (
              <div className="text-xs text-slate-600 mt-0.5 italic">{cert.interpreter_headline}</div>
            )}
            <div className="text-xs text-slate-600 mt-0.5">
              {cert.interpreter_years} years of experience · submitted{' '}
              {new Date(cert.submitted_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-600 mb-1">
            Certification
          </div>
          <div className="font-semibold text-slate-900">{cert.cert_type_label}</div>
          {cert.cert_number && (
            <div className="text-sm text-slate-700 mt-0.5">#{cert.cert_number}</div>
          )}
          {cert.cert_other_description && (
            <div className="text-sm text-slate-700 mt-0.5">{cert.cert_other_description}</div>
          )}
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-600 mb-1">
            Validity
          </div>
          <div className="text-sm text-slate-900">
            {cert.issued_date ? `Issued ${new Date(cert.issued_date).toLocaleDateString()}` : 'Issue date not provided'}
          </div>
          <div className="text-sm text-slate-700">
            {cert.expiry_date
              ? `Expires ${new Date(cert.expiry_date).toLocaleDateString()}`
              : 'No expiry provided'}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-3">
        {cert.document_url ? (
          <a
            href={cert.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 underline underline-offset-4"
          >
            View uploaded document →
          </a>
        ) : (
          <span className="text-sm text-amber-700 font-medium">No document uploaded</span>
        )}
        {lookupHint && (
          <a
            href={lookupHint.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4 ml-auto"
          >
            {lookupHint.label} ↗
          </a>
        )}
      </div>

      {error && (
        <div role="alert" className="px-5 py-3 bg-rose-50 border-t border-rose-200 text-sm text-rose-800">
          {error}
        </div>
      )}

      {showReject ? (
        <div className="p-5 border-t border-slate-100 bg-rose-50 space-y-3">
          <label htmlFor={`reason-${cert.id}`} className="block text-sm font-medium text-rose-900">
            Reason for rejection (sent to interpreter)
          </label>
          <textarea
            id={`reason-${cert.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g., Document is illegible; please upload a clearer scan."
            className="w-full px-3 py-2 border border-rose-200 rounded-xl text-sm bg-white resize-none focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => decide('reject')}
              disabled={working || !reason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5 border-t border-slate-100 flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={working}
            className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => decide('verify')}
            disabled={working}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm"
          >
            {working ? 'Working…' : 'Verify ✓'}
          </button>
        </div>
      )}
    </div>
  );
}

function getLookupHint(certType: string): { label: string; url: string } | null {
  if (certType.startsWith('RID_')) {
    return { label: 'RID public directory', url: 'https://myaccount.rid.org/public/search/member' };
  }
  if (certType.startsWith('BEI_')) {
    return { label: 'Texas BEI lookup', url: 'https://hhs.texas.gov/providers/health-services-providers/deaf-hard-hearing/board-evaluation-interpreters' };
  }
  if (certType.startsWith('CCHI_')) {
    return { label: 'CCHI verify', url: 'https://cchicertification.org/verify-certification/' };
  }
  if (certType === 'NBCMI_CMI') {
    return { label: 'NBCMI verify', url: 'https://www.certifiedmedicalinterpreters.org/cmi-directory' };
  }
  return null;
}
