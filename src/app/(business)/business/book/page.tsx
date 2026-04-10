'use client';

import { useState, useEffect } from 'react';
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

export default function BusinessBookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [paymentOnFile, setPaymentOnFile] = useState(false);
  const [orgAddress, setOrgAddress] = useState<{
    address_line1?: string;
    city?: string;
    state?: string;
    zip?: string;
  }>({});

  const [specialization, setSpecialization] = useState<Specialization>('general');
  const [locationType, setLocationType] = useState<LocationType>('in_person');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [useOrgAddress, setUseOrgAddress] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('organization_members')
        .select(
          'org_id, organizations(id, payment_method_on_file, org_type, address_line1, city, state, zip)',
        )
        .eq('user_id', user.id)
        .single();
      if (data) {
        setOrgId(data.org_id);
        const org = data.organizations as unknown as Record<string, unknown>;
        setPaymentOnFile(!!org?.payment_method_on_file);
        setOrgAddress({
          address_line1: String(org?.address_line1 ?? ''),
          city: String(org?.city ?? ''),
          state: String(org?.state ?? ''),
          zip: String(org?.zip ?? ''),
        });
        // Default the address fields to org address
        setAddress(String(org?.address_line1 ?? ''));
        setCity(String(org?.city ?? ''));
        setState(String(org?.state ?? ''));
        setZip(String(org?.zip ?? ''));
        // Auto-suggest specialization based on org type
        const orgType = String(org?.org_type || '');
        if (['medical', 'legal', 'educational'].includes(orgType)) {
          setSpecialization(orgType as Specialization);
        }
      }
    });
  }, []);

  // Sync when toggling "use org address"
  useEffect(() => {
    if (useOrgAddress) {
      setAddress(orgAddress.address_line1 ?? '');
      setCity(orgAddress.city ?? '');
      setState(orgAddress.state ?? '');
      setZip(orgAddress.zip ?? '');
    }
  }, [useOrgAddress, orgAddress]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

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
        public_notes: notes,
        booking_context: 'business',
        organization_id: orgId,
        client_name: clientName,
        client_email: clientEmail,
        address_line1: locationType === 'in_person' ? address : null,
        city: locationType === 'in_person' ? city : null,
        state: locationType === 'in_person' ? state : null,
        zip: locationType === 'in_person' ? zip : null,
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

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-2">
        Book an Interpreter
      </h1>
      <p className="text-slate-600 mb-6">Request an ASL interpreter for your client</p>

      {!paymentOnFile && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-800 text-sm font-semibold">
            Payment method required
          </p>
          <p className="text-sm text-red-700 mt-0.5">
            Add a payment method in <a href="/business/billing" className="underline font-medium">Billing</a> before booking.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-800 px-4 py-3 rounded-xl mb-6 text-sm border border-red-200">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8"
      >
        {/* Client info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-slate-700 mb-1.5">
              Client name <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="clientName"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Deaf client's name"
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="clientEmail" className="block text-sm font-medium text-slate-700 mb-1.5">
              Client email <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              id="clientEmail"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="If they have a PAH account"
              autoComplete="email"
            />
          </div>
        </div>

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
                    : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'
                }`}
              >
                {spec.label}
              </button>
            ))}
          </div>
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
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'
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
                  : 'border-slate-200 text-slate-700 hover:border-slate-300 bg-white'
              }`}
            >
              Video Remote (VRI)
            </button>
          </div>
        </div>

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
            </select>
          </div>
        </div>

        {/* Address — in-person only */}
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
              id="address"
              type="text"
              required
              value={address}
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
            placeholder="Any details for the interpreter..."
          />
          {specialization === 'medical' && (
            <p className="text-xs text-amber-700 mt-1.5">
              Do NOT include medical details, diagnoses, or treatment information.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !paymentOnFile}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? 'Booking…' : 'Book Interpreter'}
        </button>
      </form>
    </div>
  );
}
