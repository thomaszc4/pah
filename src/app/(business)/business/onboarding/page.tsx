'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { OrgType } from '@/types';

const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: 'medical', label: 'Medical / Healthcare' },
  { value: 'legal', label: 'Legal' },
  { value: 'educational', label: 'Educational' },
  { value: 'government', label: 'Government' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'other', label: 'Other' },
];

export default function BusinessOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Organization info
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<OrgType>('medical');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [website, setWebsite] = useState('');

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    // Create org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        org_type: orgType,
        address_line1: address,
        city,
        state,
        zip,
        phone,
        email: orgEmail,
        website,
      })
      .select()
      .single();

    if (orgError) {
      setError(orgError.message);
      setLoading(false);
      return;
    }

    // Add user as org owner
    await supabase.from('organization_members').insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner',
    });

    setLoading(false);
    setStep(2);
  }

  async function handleComplete() {
    router.push('/business/billing');
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Business Setup</h1>
      <p className="text-gray-600 mb-6">Set up your organization to book interpreters</p>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[1, 2].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-red-50 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm border border-red-200"
        >
          {error}
        </div>
      )}

      {/* Step 1: Organization Info */}
      {step === 1 && (
        <form onSubmit={handleCreateOrg} className="space-y-5">
          <h2 className="text-lg font-semibold">Organization Information</h2>

          <div>
            <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <input
              id="orgName"
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              placeholder="e.g., Downtown Medical Center"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ORG_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setOrgType(type.value)}
                  className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                    orgType === type.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              id="address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input id="city" type="text" required value={city} onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input id="state" type="text" required value={state} onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" maxLength={2} />
            </div>
            <div>
              <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
              <input id="zip" type="text" required value={zip} onChange={(e) => setZip(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" maxLength={5} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label htmlFor="orgEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="orgEmail" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Next: Payment Setup'}
          </button>
        </form>
      )}

      {/* Step 2: Payment Method */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-900">Payment method</h2>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="font-semibold text-amber-900">Required by the ADA</h3>
            <p className="text-sm text-amber-800 mt-1 leading-relaxed">
              Under the Americans with Disabilities Act, your organization is required to
              provide and pay for interpreter services when requested by{' '}
              <strong>Deaf, DeafBlind, or hard-of-hearing individuals</strong>. A payment
              method on file is required before you can book.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">Add a payment method</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  We use Stripe for secure payment processing. You&apos;ll be taken to Billing to connect your card.
                </p>
              </div>
            </div>
            <button
              onClick={handleComplete}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium transition-colors shadow-sm"
            >
              Continue to Billing →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
