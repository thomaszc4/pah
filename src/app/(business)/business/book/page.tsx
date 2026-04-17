'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Specialization, LocationType } from '@/types';
import { SPECIALIZATION_LABELS } from '@/types';
import { ADANotice } from '@/components/legal/ADANotice';
import { VRIWarning } from '@/components/legal/VRIWarning';
import { CURRENT_ADA_NOTICE, CURRENT_VRI_WARNING } from '@/lib/attestation/ada';

const SPECIALIZATION_ORDER: Specialization[] = [
  'general',
  'medical',
  'legal',
  'educational',
  'mental_health',
  'deaf_interpreter',
  'trilingual',
  'deaf_blind',
  'oral_transliterator',
  'pediatric',
  'performing_arts',
  'religious',
  'cart_captioning',
  'other',
];

interface ClientPreferenceSnapshot {
  prefers_location_type?: string;
  preferred_gender?: string[];
  preferred_specializations?: string[];
}

export default function BusinessBookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>('');
  const [orgType, setOrgType] = useState<string>('');
  const [paymentOnFile, setPaymentOnFile] = useState(false);
  const [orgAddress, setOrgAddress] = useState<{
    address_line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  }>({});

  const [specialization, setSpecialization] = useState<Specialization>('general');
  const [specializationOther, setSpecializationOther] = useState('');
  const [locationType, setLocationType] = useState<LocationType>('in_person');
  const [pendingLocationChange, setPendingLocationChange] = useState<LocationType | null>(null);
  const [vriAcknowledged, setVriAcknowledged] = useState(false);
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [useOrgAddress, setUseOrgAddress] = useState(true);

  // #19 ADA acknowledgement gate
  const [adaAcknowledged, setAdaAcknowledged] = useState(false);

  // #22 Preference auto-population
  const [clientPrefs, setClientPrefs] = useState<ClientPreferenceSnapshot | null>(null);
  const [prefLookupState, setPrefLookupState] = useState<'idle' | 'loading' | 'found' | 'none'>('idle');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('organization_members')
        .select(
          'org_id, organizations(id, name, payment_method_on_file, org_type, address_line1, city, state, zip, ada_acknowledged_at)',
        )
        .eq('user_id', user.id)
        .single();
      if (data) {
        setOrgId(data.org_id);
        const org = data.organizations as unknown as Record<string, unknown>;
        setOrgName(String(org?.name ?? ''));
        setOrgType(String(org?.org_type ?? ''));
        setPaymentOnFile(!!org?.payment_method_on_file);
        setOrgAddress({
          address_line1: String(org?.address_line1 ?? ''),
          city: String(org?.city ?? ''),
          state: String(org?.state ?? ''),
          zip: String(org?.zip ?? ''),
        });
        setAddress(String(org?.address_line1 ?? ''));
        setCity(String(org?.city ?? ''));
        setState(String(org?.state ?? ''));
        setZip(String(org?.zip ?? ''));
        // If the org previously acknowledged ADA at onboarding, pre-check.
        if (org?.ada_acknowledged_at) setAdaAcknowledged(true);

        const orgTypeStr = String(org?.org_type || '');
        if (['medical', 'legal', 'educational'].includes(orgTypeStr)) {
          setSpecialization(orgTypeStr as Specialization);
        }
      }
    });
  }, []);

  // Auto-fill from org address when toggle on
  useEffect(() => {
    if (useOrgAddress) {
      setAddress(orgAddress.address_line1 ?? '');
      setCity(orgAddress.city ?? '');
      setState(orgAddress.state ?? '');
      setZip(orgAddress.zip ?? '');
    }
  }, [useOrgAddress, orgAddress]);

  // #22 debounced client preference lookup by email
  useEffect(() => {
    if (!clientEmail || !clientEmail.includes('@')) {
      setClientPrefs(null);
      setPrefLookupState('idle');
      return;
    }
    setPrefLookupState('loading');
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/deaf/preferences/lookup?email=${encodeURIComponent(clientEmail)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.preferences) {
            setClientPrefs(data.preferences);
            setPrefLookupState('found');
            // Auto-apply format preference
            if (data.preferences.prefers_location_type === 'in_person') {
              setLocationType('in_person');
            }
          } else {
            setClientPrefs(null);
            setPrefLookupState('none');
          }
        } else {
          setPrefLookupState('none');
        }
      } catch {
        setPrefLookupState('none');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [clientEmail]);

  function handleLocationTypeChange(next: LocationType) {
    if (next === 'vri' && !vriAcknowledged) {
      setPendingLocationChange('vri');
      return;
    }
    setLocationType(next);
  }

  function handleVRIAcknowledge() {
    setVriAcknowledged(true);
    setLocationType('vri');
    setPendingLocationChange(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adaAcknowledged) {
      setError('Please acknowledge the ADA notice to proceed.');
      return;
    }
    if (!clientName.trim()) {
      setError('Client name is required for all business bookings.');
      return;
    }
    if (specialization === 'other' && !specializationOther.trim()) {
      setError('Please describe the type of interpreting needed.');
      return;
    }
    setLoading(true);
    setError('');

    const scheduledStart = new Date(`${date}T${startTime}`);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specialization_required: specialization,
        specialization_other_description:
          specialization === 'other' ? specializationOther : null,
        location_type: locationType,
        booking_type: 'scheduled',
        booking_context: 'business',
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        estimated_duration_minutes: durationMinutes,
        public_notes: notes,
        organization_id: orgId,
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        client_phone: clientPhone.trim() || null,
        address_line1: locationType === 'in_person' ? address : null,
        city: locationType === 'in_person' ? city : null,
        state: locationType === 'in_person' ? state : null,
        zip: locationType === 'in_person' ? zip : null,
        ada_notice_version: CURRENT_ADA_NOTICE.version,
        vri_warning_acknowledged: locationType === 'vri' ? vriAcknowledged : false,
        vri_warning_version: locationType === 'vri' ? CURRENT_VRI_WARNING.version : null,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      setError(result.error || 'Failed to create booking');
      setLoading(false);
      return;
    }

    router.push('/business/bookings');
  }

  const deafClientPrefersInPerson = clientPrefs?.prefers_location_type === 'in_person';

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-2">
        Book an Interpreter
      </h1>
      <p className="text-slate-600 mb-6">Request an ASL interpreter for your client</p>

      {!paymentOnFile && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-800 text-sm font-semibold">Payment method required</p>
          <p className="text-sm text-red-700 mt-0.5">
            Add a payment method in{' '}
            <a href="/business/billing" className="underline font-medium">Billing</a>{' '}
            before booking.
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-red-50 text-red-800 px-4 py-3 rounded-xl mb-6 text-sm border border-red-200"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8"
      >
        {/* #21 Client info — NAME REQUIRED */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-slate-700 mb-1.5">
              Client name <span className="text-rose-600">*</span>
            </label>
            <input
              id="clientName"
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Deaf client's full name"
              autoComplete="name"
              aria-describedby="clientName-hint"
            />
            <p id="clientName-hint" className="text-xs text-slate-500 mt-1">
              Required so the interpreter knows who they&apos;re meeting.
            </p>
          </div>
          <div>
            <label htmlFor="clientEmail" className="block text-sm font-medium text-slate-700 mb-1.5">
              Client email
            </label>
            <input
              id="clientEmail"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="For notifications"
              autoComplete="email"
            />
            {prefLookupState === 'found' && (
              <p className="text-xs text-emerald-700 mt-1 font-medium">
                Preferences found ↓
              </p>
            )}
          </div>
          <div>
            <label htmlFor="clientPhone" className="block text-sm font-medium text-slate-700 mb-1.5">
              Client phone
            </label>
            <input
              id="clientPhone"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="For SMS updates"
              autoComplete="tel"
            />
          </div>
        </div>

        {/* #22 Preference snapshot */}
        {clientPrefs && prefLookupState === 'found' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-emerald-900 mb-2">
              We found {clientName || 'this client'}&apos;s preferences
            </h3>
            <ul className="text-sm text-emerald-800 space-y-1">
              {clientPrefs.prefers_location_type && clientPrefs.prefers_location_type !== 'no_preference' && (
                <li>
                  <strong>Format:</strong>{' '}
                  {clientPrefs.prefers_location_type === 'in_person' ? 'In-person preferred' : 'VRI preferred'}
                </li>
              )}
              {clientPrefs.preferred_gender && clientPrefs.preferred_gender.length > 0 && (
                <li>
                  <strong>Interpreter gender:</strong> {clientPrefs.preferred_gender.join(', ')}
                </li>
              )}
              {clientPrefs.preferred_specializations && clientPrefs.preferred_specializations.length > 0 && (
                <li>
                  <strong>Specializations:</strong>{' '}
                  {clientPrefs.preferred_specializations
                    .map((s) => SPECIALIZATION_LABELS[s as Specialization] || s)
                    .join(', ')}
                </li>
              )}
            </ul>
            <p className="text-xs text-emerald-700 mt-2">
              These preferences will help us match the right interpreter. You can still
              override them for this booking.
            </p>
          </div>
        )}

        {/* #18 Specialization — expanded list */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Type of interpreting
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
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'
                }`}
              >
                {SPECIALIZATION_LABELS[spec]}
              </button>
            ))}
          </div>
          {specialization === 'other' && (
            <div className="mt-3">
              <label htmlFor="specOther" className="block text-xs font-medium text-slate-700 mb-1">
                Please describe <span className="text-rose-600">*</span>
              </label>
              <input
                id="specOther"
                type="text"
                value={specializationOther}
                onChange={(e) => setSpecializationOther(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="E.g., Conference interpreting, Tactile ProTactile..."
              />
            </div>
          )}
        </div>

        {/* Format — with #20 VRI friction */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleLocationTypeChange('in_person')}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                locationType === 'in_person'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'
              }`}
            >
              In Person
            </button>
            <button
              type="button"
              onClick={() => handleLocationTypeChange('vri')}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                locationType === 'vri'
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'
              }`}
            >
              Video Remote (VRI)
            </button>
          </div>
          {locationType === 'vri' && vriAcknowledged && (
            <p className="text-xs text-amber-700 mt-2">
              You&apos;ve acknowledged the VRI guidance. Under DOJ rules, the Deaf person&apos;s
              preference is generally determinative.
            </p>
          )}
        </div>

        <VRIWarning
          open={pendingLocationChange === 'vri'}
          orgType={orgType}
          deafUserPrefersInPerson={deafClientPrefersInPerson}
          onAcknowledge={handleVRIAcknowledge}
          onCancel={() => setPendingLocationChange(null)}
        />

        {/* Date/Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
            <input
              id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label htmlFor="time" className="block text-sm font-medium text-slate-700 mb-1.5">Start time</label>
            <input
              id="time" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            />
          </div>
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-slate-700 mb-1.5">Duration</label>
            <select
              id="duration" value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            >
              <option value={30}>30 min</option>
              <option value={60}>1 hr</option>
              <option value={90}>1.5 hr</option>
              <option value={120}>2 hr</option>
              <option value={180}>3 hr</option>
              <option value={240}>4 hr</option>
              <option value={480}>Full day (8 hr)</option>
            </select>
          </div>
        </div>

        {/* Address (in-person only) */}
        {locationType === 'in_person' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Location</label>
              {orgAddress.address_line1 && (
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useOrgAddress}
                    onChange={(e) => setUseOrgAddress(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Use our office address
                </label>
              )}
            </div>
            <input
              type="text" required value={address}
              onChange={(e) => { setAddress(e.target.value); setUseOrgAddress(false); }}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Street address"
              autoComplete="street-address"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text" required value={city}
                onChange={(e) => { setCity(e.target.value); setUseOrgAddress(false); }}
                className="px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="City"
                autoComplete="address-level2"
              />
              <input
                type="text" required value={state}
                onChange={(e) => { setState(e.target.value); setUseOrgAddress(false); }}
                className="px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="State" maxLength={2}
                autoComplete="address-level1"
              />
              <input
                type="text" required value={zip}
                onChange={(e) => { setZip(e.target.value); setUseOrgAddress(false); }}
                className="px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="ZIP" maxLength={5}
                autoComplete="postal-code"
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea
            id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="Logistics details for the interpreter..."
          />
          {(specialization === 'medical' || specialization === 'mental_health') && (
            <p className="text-xs text-amber-700 mt-1.5">
              Do NOT include PHI or medical details. HIPAA minimum-necessary applies.
            </p>
          )}
        </div>

        {/* #19 ADA acknowledgement */}
        <ADANotice
          variant="short"
          orgName={orgName}
          checked={adaAcknowledged}
          onCheckedChange={setAdaAcknowledged}
        />

        <button
          type="submit"
          disabled={loading || !paymentOnFile || !adaAcknowledged || !clientName.trim()}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? 'Booking…' : 'Book Interpreter'}
        </button>
      </form>
    </div>
  );
}
