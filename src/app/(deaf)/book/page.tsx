'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Specialization, LocationType } from '@/types';

const SPECIALIZATIONS: { value: Specialization; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Legal' },
  { value: 'educational', label: 'Educational' },
  { value: 'mental_health', label: 'Mental Health' },
];

interface OrgResult {
  id: string;
  name: string;
  org_type: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  payment_method_on_file: boolean;
  default_session_minutes: number;
}

export default function BookInterpreterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [specialization, setSpecialization] = useState<Specialization>('general');
  const [locationType, setLocationType] = useState<LocationType>('in_person');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingContext, setBookingContext] = useState<'business' | 'personal'>('business');

  // Org lookup state
  const [orgQuery, setOrgQuery] = useState('');
  const [orgResults, setOrgResults] = useState<OrgResult[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgResult | null>(null);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [orgSearching, setOrgSearching] = useState(false);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const orgInputRef = useRef<HTMLInputElement>(null);

  // Business request state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestContact, setRequestContact] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Duration cap from selected org
  const maxMinutes = selectedOrg ? selectedOrg.default_session_minutes : null;

  // Debounced org search
  useEffect(() => {
    if (orgQuery.length < 2 || selectedOrg) {
      setOrgResults([]);
      setShowOrgDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setOrgSearching(true);
      try {
        const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(orgQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setOrgResults(data);
          setShowOrgDropdown(data.length > 0);
        }
      } catch {
        // Silently fail — user can still type manually
      }
      setOrgSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [orgQuery, selectedOrg]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setShowOrgDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelectOrg(org: OrgResult) {
    setSelectedOrg(org);
    setOrgQuery(org.name);
    setShowOrgDropdown(false);

    // Auto-fill address from org
    if (org.address_line1 && locationType === 'in_person') {
      setAddress(org.address_line1);
      if (org.city) setCity(org.city);
      if (org.state) setState(org.state);
    }

    // Cap duration to org default
    if (org.default_session_minutes && durationMinutes > org.default_session_minutes) {
      setDurationMinutes(org.default_session_minutes);
    }
  }

  function handleClearOrg() {
    setSelectedOrg(null);
    setOrgQuery('');
    setOrgResults([]);
    orgInputRef.current?.focus();
  }

  async function handleRequestBusiness() {
    if (!orgQuery.trim() || orgQuery.trim().length < 2) return;
    setRequestSubmitting(true);
    try {
      const res = await fetch('/api/business-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: orgQuery.trim(),
          business_type: specialization === 'legal' ? 'legal' : specialization === 'educational' ? 'educational' : 'medical',
          contact_email: requestContact || null,
          reason: requestReason || null,
        }),
      });
      if (res.ok || res.status === 409) {
        setRequestSent(true);
        setShowRequestForm(false);
      }
    } catch {
      // fail silently
    }
    setRequestSubmitting(false);
  }

  // Filter duration options based on org cap
  const DURATION_OPTIONS = [
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 90, label: '1.5 hours' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 240, label: '4 hours' },
    { value: 480, label: 'Full day (8 hours)' },
  ];

  const availableDurations = maxMinutes
    ? DURATION_OPTIONS.filter((d) => d.value <= maxMinutes)
    : DURATION_OPTIONS;

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
        location_type: locationType,
        booking_type: 'scheduled',
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        estimated_duration_minutes: durationMinutes,
        address_line1: address,
        city,
        state,
        zip,
        public_notes: notes,
        organization_id: selectedOrg?.id || null,
        organization_name: bookingContext === 'business' ? orgQuery : null,
        booking_context: bookingContext,
        authorized_max_minutes: maxMinutes,
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
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-2">Book an interpreter</h1>
      <p className="text-slate-600 mb-6">Schedule an ASL interpreter for your appointment or event</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {/* Context: Business or Personal */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            What is this for?
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setBookingContext('business'); handleClearOrg(); }}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                bookingContext === 'business'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}
            >
              Business / Clinic / Legal
              <span className="block text-xs font-normal mt-0.5 opacity-75">Business pays</span>
            </button>
            <button
              type="button"
              onClick={() => { setBookingContext('personal'); handleClearOrg(); }}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                bookingContext === 'personal'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
              }`}
            >
              Personal Event
              <span className="block text-xs font-normal mt-0.5 opacity-75">You pay</span>
            </button>
          </div>
        </div>

        {/* Organization lookup (if business) */}
        {bookingContext === 'business' && (
          <div ref={orgDropdownRef} className="relative">
            <label htmlFor="org" className="block text-sm font-medium text-slate-700 mb-1">
              Business / Organization
            </label>

            {selectedOrg ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{selectedOrg.name}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {selectedOrg.org_type.charAt(0).toUpperCase() + selectedOrg.org_type.slice(1)}
                    {selectedOrg.city && ` · ${selectedOrg.city}, ${selectedOrg.state}`}
                    {selectedOrg.payment_method_on_file && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                        Payment on file
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearOrg}
                  className="text-slate-400 hover:text-slate-600 text-sm font-medium"
                  aria-label="Clear selection"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  ref={orgInputRef}
                  id="org"
                  type="text"
                  value={orgQuery}
                  onChange={(e) => { setOrgQuery(e.target.value); setSelectedOrg(null); }}
                  onFocus={() => orgResults.length > 0 && setShowOrgDropdown(true)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  placeholder="Start typing to search organizations…"
                  autoComplete="off"
                />
                {orgSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-blue-500" />
                  </div>
                )}
              </div>
            )}

            {/* Dropdown results */}
            {showOrgDropdown && !selectedOrg && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {orgResults.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => handleSelectOrg(org)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
                  >
                    <div className="font-medium text-slate-900">{org.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {org.org_type.charAt(0).toUpperCase() + org.org_type.slice(1)}
                      {org.city && ` · ${org.city}, ${org.state}`}
                      {org.payment_method_on_file ? (
                        <span className="ml-2 text-emerald-600 font-medium">Payment on file</span>
                      ) : (
                        <span className="ml-2 text-amber-600 font-medium">No payment method</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-500 mt-1">
              {selectedOrg
                ? 'This organization will be billed under the ADA.'
                : 'Search for a registered business, or type a new name to request one.'}
            </p>

            {selectedOrg && !selectedOrg.payment_method_on_file && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-800">
                  This organization hasn&apos;t added a payment method yet. They&apos;ll be prompted to set one
                  up before the booking is confirmed.
                </p>
              </div>
            )}

            {/* "Request this business" — shown when user typed 2+ chars, no org selected, no results, not searching */}
            {!selectedOrg && orgQuery.length >= 2 && !orgSearching && orgResults.length === 0 && !showOrgDropdown && (
              <div className="mt-2">
                {requestSent ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Request sent! We&apos;ll reach out to &ldquo;{orgQuery}&rdquo; about joining PAH.
                    </div>
                    <p className="text-xs text-emerald-600 mt-1">
                      You can still book this interpreter for a personal appointment, or wait until they register.
                    </p>
                  </div>
                ) : showRequestForm ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-blue-900">
                      Request &ldquo;{orgQuery}&rdquo; to join PAH
                    </h4>
                    <p className="text-xs text-blue-700">
                      We&apos;ll reach out to this business about adopting PAH for interpreter services.
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Their email or phone (optional)
                      </label>
                      <input
                        type="text"
                        value={requestContact}
                        onChange={(e) => setRequestContact(e.target.value)}
                        placeholder="reception@clinic.com or (555) 123-4567"
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Why? (optional)
                      </label>
                      <input
                        type="text"
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                        placeholder="e.g., I have an appointment there next month"
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleRequestBusiness}
                        disabled={requestSubmitting}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                      >
                        {requestSubmitting ? 'Sending…' : 'Send Request'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRequestForm(false)}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(true)}
                    className="w-full text-left px-3 py-2.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-100 hover:border-slate-400 transition-colors"
                  >
                    <span className="font-medium text-blue-600">
                      Not finding &ldquo;{orgQuery}&rdquo;?
                    </span>{' '}
                    Request them to join PAH →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Specialization */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Type of interpreting
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SPECIALIZATIONS.map((spec) => (
              <button
                key={spec.value}
                type="button"
                onClick={() => setSpecialization(spec.value)}
                className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                  specialization === spec.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                }`}
              >
                {spec.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Format
          </label>
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
              id="date"
              type="date"
              required
              value={date}
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
              id="time"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            />
          </div>
        </div>

        {/* Duration (capped if org selected) */}
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-1">
            Estimated duration
          </label>
          <select
            id="duration"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
          >
            {availableDurations.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {maxMinutes ? (
            <p className="text-xs text-blue-600 mt-1">
              {selectedOrg?.name} sessions are capped at {maxMinutes >= 60 ? `${maxMinutes / 60} hour${maxMinutes > 60 ? 's' : ''}` : `${maxMinutes} min`}.
              If the appointment runs long, the interpreter can request additional time.
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-1">
              In-person bookings have a 2-hour minimum. You&apos;ll only be charged for actual time.
            </p>
          )}
        </div>

        {/* Address (in-person only) */}
        {locationType === 'in_person' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
                Address
              </label>
              <input
                id="address"
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                placeholder="123 Main St"
                autoComplete="street-address"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  autoComplete="address-level2"
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-slate-700 mb-1">
                  State
                </label>
                <input
                  id="state"
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  maxLength={2}
                  placeholder="TX"
                  autoComplete="address-level1"
                />
              </div>
              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-slate-700 mb-1">
                  ZIP
                </label>
                <input
                  id="zip"
                  type="text"
                  required
                  value={zip}
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
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white resize-none"
            placeholder="Any details that would help the interpreter prepare…"
          />
          {specialization === 'medical' && (
            <p className="text-xs text-amber-600 mt-1">
              Do NOT include medical details, diagnoses, or treatment information here.
            </p>
          )}
        </div>

        {/* Price Estimate */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-2">Estimated cost</h3>
          <PriceEstimate
            locationType={locationType}
            durationMinutes={durationMinutes}
            date={date}
            startTime={startTime}
            bookingContext={bookingContext}
            orgName={selectedOrg?.name}
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
  bookingContext,
  orgName,
}: {
  locationType: LocationType;
  durationMinutes: number;
  date: string;
  startTime: string;
  bookingContext: 'business' | 'personal';
  orgName?: string;
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
          ${hourlyRate}/hr x {billedHours} hr{billedHours > 1 ? 's' : ''}
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
      {bookingContext === 'business' && orgName && (
        <p className="text-xs text-emerald-700 pt-1 font-medium">
          {orgName} will be billed for this amount.
        </p>
      )}
      {bookingContext === 'business' && !orgName && (
        <p className="text-xs text-slate-500 pt-1">
          The business/organization will be billed for this amount.
        </p>
      )}
      {bookingContext === 'personal' && (
        <p className="text-xs text-slate-500 pt-1">
          You will be billed for this amount.
        </p>
      )}
    </div>
  );
}
