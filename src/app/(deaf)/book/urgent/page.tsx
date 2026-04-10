'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Specialization } from '@/types';

const SPECIALIZATIONS: { value: Specialization; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Legal' },
  { value: 'educational', label: 'Educational' },
  { value: 'mental_health', label: 'Mental Health' },
];

export default function UrgentBookingPage() {
  const router = useRouter();
  const [specialization, setSpecialization] = useState<Specialization>('general');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        scheduled_start: now.toISOString(),
        scheduled_end: end.toISOString(),
        estimated_duration_minutes: 120,
        address_line1: address,
        city,
        state,
        zip,
        public_notes: notes,
        booking_context: 'personal',
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setError(result.error || 'Failed to create booking');
      setLoading(false);
      return;
    }

    setSearching(true);
    router.push(`/bookings/${result.id}`);
  }

  if (searching) {
    return (
      <div className="max-w-md mx-auto text-center py-20 animate-fade-in">
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
        <h1 className="text-xl font-semibold text-red-900">Need an interpreter now</h1>
        <p className="text-red-700 text-sm mt-1">
          Rush fee (1.5x) applies for urgent requests. We&apos;ll find the closest available interpreter.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {/* Specialization */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            What type?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SPECIALIZATIONS.map((spec) => (
              <button
                key={spec.value}
                type="button"
                onClick={() => setSpecialization(spec.value)}
                className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                  specialization === spec.value
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                }`}
              >
                {spec.label}
              </button>
            ))}
          </div>
        </div>

        {/* Address */}
        <div className="space-y-3">
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
              Where are you?
            </label>
            <input
              id="address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
              placeholder="Address"
              autoComplete="street-address"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
              placeholder="City"
              autoComplete="address-level2"
            />
            <input
              type="text"
              required
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
              placeholder="State"
              maxLength={2}
              autoComplete="address-level1"
            />
            <input
              type="text"
              required
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white"
              placeholder="ZIP"
              maxLength={5}
              autoComplete="postal-code"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
            Quick notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none bg-white resize-none"
            placeholder="Brief context for the interpreter…"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? 'Submitting…' : 'Find interpreter now'}
        </button>

        <p className="text-center text-xs text-slate-500">
          Estimated rate: $127.50/hr (includes 1.5x rush fee). 2-hour minimum.
        </p>
      </form>
    </div>
  );
}
