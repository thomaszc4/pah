'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Specialization } from '@/types';
import { SPECIALIZATION_LABELS } from '@/types';
import { CURRENT_EMERGENCY_ATTESTATION } from '@/lib/attestation/ada';

const SPECS: Specialization[] = ['general', 'medical', 'legal', 'educational', 'mental_health'];

export default function UrgentBookingPage() {
  const router = useRouter();
  const [specialization, setSpecialization] = useState<Specialization>('general');
  const [businessName, setBusinessName] = useState('');
  const [businessContact, setBusinessContact] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [attestSigned, setAttestSigned] = useState(false);
  const [attestName, setAttestName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!attestSigned) { setError('Please attest this is a genuine emergency'); return; }
    if (!attestName.trim()) { setError('Please type your full name to sign'); return; }
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be logged in');
      setLoading(false);
      return;
    }

    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialization_required: specialization,
        location_type: 'in_person',
        booking_type: 'urgent',
        booking_context: 'emergency',
        scheduled_start: now.toISOString(),
        scheduled_end: end.toISOString(),
        estimated_duration_minutes: 120,
        address_line1: address,
        city, state, zip,
        public_notes: notes,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setError(result.error || 'Failed to create booking');
      setLoading(false);
      return;
    }

    // Fire emergency attestation with business contact
    if (businessName.trim() && businessContact.trim()) {
      await fetch(`/api/bookings/${result.id}/emergency-attestation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: attestName.trim(),
          attestation_version: CURRENT_EMERGENCY_ATTESTATION.version,
          business_name: businessName.trim(),
          business_contact: businessContact.trim(),
        }),
      });
    }

    setSearching(true);
    setTimeout(() => router.push(`/bookings/${result.id}`), 800);
  }

  if (searching) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="mb-6">
          <div className="w-20 h-20 bg-red-50 rounded-full mx-auto flex items-center justify-center">
            <div className="w-10 h-10 bg-red-500 rounded-full animate-ping" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Finding an interpreter…</h2>
        <p className="text-slate-600">
          We&apos;re reaching out to available interpreters near you.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
        <h1 className="text-xl font-semibold text-red-900">Emergency interpreter request</h1>
        <p className="text-red-700 text-sm mt-1">
          Rush fee (1.5×) applies. If this is at a business, we&apos;ll ask them to confirm
          payment under the ADA.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl mb-6 text-sm"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
      >
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {SPECS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpecialization(s)}
                className={`p-2.5 rounded-xl border-2 text-sm font-medium transition ${
                  specialization === s
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {SPECIALIZATION_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Business attestation (optional) */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Are you at a business, clinic, or legal office?
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            Add their info and we&apos;ll ask them to accept ADA payment responsibility.
            If they don&apos;t respond within an hour, we&apos;ll bill you and you can seek
            reimbursement.
          </p>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Business name"
            className="w-full px-3 py-2 mb-2 border border-slate-300 rounded-xl bg-white text-sm"
          />
          <input
            type="text"
            value={businessContact}
            onChange={(e) => setBusinessContact(e.target.value)}
            placeholder="Their email or phone (for confirmation link)"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
          />
        </div>

        {/* Address */}
        <div className="space-y-3">
          <div>
            <label htmlFor="urgent-address" className="block text-sm font-medium text-slate-700 mb-1">
              Address
            </label>
            <input
              id="urgent-address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              autoComplete="street-address"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="urgent-city" className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <input id="urgent-city" type="text" required value={city} onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" autoComplete="address-level2" />
            </div>
            <div>
              <label htmlFor="urgent-state" className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <input id="urgent-state" type="text" required value={state} onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" maxLength={2} autoComplete="address-level1" />
            </div>
            <div>
              <label htmlFor="urgent-zip" className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
              <input id="urgent-zip" type="text" required value={zip} onChange={(e) => setZip(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" maxLength={5} autoComplete="postal-code" />
            </div>
          </div>
        </div>

        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-sm resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            placeholder="Brief context (no medical details)"
          />
        </div>

        {/* Attestation */}
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">E-signature attestation</h3>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            {CURRENT_EMERGENCY_ATTESTATION.text}
          </p>
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={attestSigned}
                onChange={(e) => setAttestSigned(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-400 text-red-600 focus:ring-red-500"
              />
              <span className="text-slate-800">I agree to the attestation above.</span>
            </label>
            <input
              type="text"
              value={attestName}
              onChange={(e) => setAttestName(e.target.value)}
              placeholder="Type your full legal name to sign"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-sm"
              autoComplete="name"
            />
            <p className="text-[10px] text-slate-500">
              Version {CURRENT_EMERGENCY_ATTESTATION.version} · {CURRENT_EMERGENCY_ATTESTATION.hash}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !attestSigned || !attestName.trim()}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? 'Submitting…' : 'Find interpreter now'}
        </button>

        <p className="text-center text-xs text-slate-500">
          Estimated rate: $127.50/hr (includes 1.5× rush). 2-hour minimum.
        </p>
      </form>
    </div>
  );
}
