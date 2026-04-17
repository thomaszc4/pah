'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Specialization, LocationType } from '@/types';
import { SPECIALIZATION_LABELS } from '@/types';

const SPECIALIZATION_ORDER: Specialization[] = [
  'general',
  'educational',
  'performing_arts',
  'religious',
  'mental_health',
  'other',
];

// Intentionally omit medical/legal/educational professional — those are business contexts.

export default function BookInterpreterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [specialization, setSpecialization] = useState<Specialization>('general');
  const [specializationOther, setSpecializationOther] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('in_person');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');

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

    const scheduledStart = new Date(`${date}T${startTime}`);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialization_required: specialization,
        specialization_other_description: specialization === 'other' ? specializationOther : null,
        location_type: locationType,
        booking_type: 'scheduled',
        booking_context: 'personal',
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        estimated_duration_minutes: durationMinutes,
        address_line1: address,
        city,
        state,
        zip,
        public_notes: notes,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setError(result.error || 'Failed to create booking');
      setLoading(false);
      return;
    }

    router.push(`/bookings/${result.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-2">
        Book a personal interpreter
      </h1>
      <p className="text-slate-600 mb-6">
        For personal events — family gatherings, weddings, community meetings, and more.
      </p>

      {/* #1 Restricted Booking — education callout (aside, not heading) */}
      <aside
        role="note"
        aria-label="ADA responsibility notice"
        className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6"
      >
        <p className="text-sm font-semibold text-blue-900 mb-1">
          Going to a business, clinic, or legal visit?
        </p>
        <p className="text-sm text-blue-900 leading-relaxed">
          Under the Americans with Disabilities Act, the business is legally required to
          provide and pay for an interpreter. Don&apos;t pay out of pocket for something
          they owe you.
        </p>
        <Link
          href="/request-business"
          className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-blue-800 hover:text-blue-900 underline underline-offset-2"
        >
          Request a business to join PAH →
        </Link>
      </aside>

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
        className="space-y-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
      >
        {/* Specialization (personal-appropriate options only) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Type of event
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SPECIALIZATION_ORDER.map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => setSpecialization(spec)}
                className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-colors text-left ${
                  specialization === spec
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                }`}
              >
                {SPECIALIZATION_LABELS[spec]}
              </button>
            ))}
          </div>
          {specialization === 'other' && (
            <input
              type="text"
              value={specializationOther}
              onChange={(e) => setSpecializationOther(e.target.value)}
              required
              placeholder="Describe the event..."
              className="w-full mt-3 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          )}
        </div>

        {/* Location Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setLocationType('in_person')}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                locationType === 'in_person'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}
            >
              In Person
            </button>
            <button
              type="button"
              onClick={() => setLocationType('vri')}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                locationType === 'vri'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}
            >
              Video Remote (VRI)
            </button>
          </div>
        </div>

        {/* Date and Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1">
              Date
            </label>
            <input
              id="date" type="date" required value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            />
          </div>
          <div>
            <label htmlFor="time" className="block text-sm font-medium text-slate-700 mb-1">
              Start time
            </label>
            <input
              id="time" type="time" required value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-1">
            Estimated duration
          </label>
          <select
            id="duration" value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          >
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>1.5 hours</option>
            <option value={120}>2 hours</option>
            <option value={180}>3 hours</option>
            <option value={240}>4 hours</option>
            <option value={480}>Full day (8 hours)</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">
            In-person bookings have a 2-hour minimum.
          </p>
        </div>

        {/* Address */}
        {locationType === 'in_person' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
                Address
              </label>
              <input
                id="address" type="text" required value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                placeholder="123 Main St"
                autoComplete="street-address"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input
                  id="city"
                  type="text" required value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  autoComplete="address-level2"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <input
                  id="state"
                  type="text" required value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  maxLength={2}
                  placeholder="TX"
                  autoComplete="address-level1"
                />
              </div>
              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
                <input
                  id="zip"
                  type="text" required value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  maxLength={5}
                  autoComplete="postal-code"
                />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
            Notes for the interpreter (optional)
          </label>
          <textarea
            id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white resize-none"
            placeholder="Any details that would help the interpreter prepare…"
          />
        </div>

        {/* #3 Price Estimate — visible for personal bookings */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Estimated cost</h3>
          <PriceEstimate
            locationType={locationType}
            durationMinutes={durationMinutes}
            date={date}
            startTime={startTime}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? 'Creating booking…' : 'Book interpreter'}
        </button>
      </form>
    </div>
  );
}

function PriceEstimate({
  locationType,
  durationMinutes,
  date,
  startTime,
}: {
  locationType: LocationType;
  durationMinutes: number;
  date: string;
  startTime: string;
}) {
  const hourlyRate = locationType === 'in_person' ? 85 : 55;
  const minHours = locationType === 'in_person' ? 2 : 1;
  const actualHours = durationMinutes / 60;
  const billedHours = Math.max(Math.ceil(actualHours), minHours);

  let isRush = false;
  if (date && startTime) {
    const scheduledStart = new Date(`${date}T${startTime}`);
    const hoursUntil = (scheduledStart.getTime() - Date.now()) / (1000 * 60 * 60);
    isRush = hoursUntil < 24;
  }

  const baseTotal = billedHours * hourlyRate;
  const rushExtra = isRush ? baseTotal * 0.5 : 0;
  const total = baseTotal + rushExtra;

  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-slate-600">
          ${hourlyRate}/hr × {billedHours} hr{billedHours > 1 ? 's' : ''}
          {billedHours > actualHours ? ` (${minHours}-hr minimum)` : ''}
        </span>
        <span>${baseTotal}</span>
      </div>
      {isRush && (
        <div className="flex justify-between text-amber-600">
          <span>Rush fee (under 24hr notice)</span>
          <span>+${rushExtra}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold pt-1 border-t border-slate-200">
        <span>Estimated total</span>
        <span>${total}</span>
      </div>
      <p className="text-xs text-slate-500 pt-1">
        You&apos;ll be billed for this amount since this is a personal event.
      </p>
    </div>
  );
}
