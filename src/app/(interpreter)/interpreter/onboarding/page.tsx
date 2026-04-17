'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Specialization, CertificationType } from '@/types';

const CERT_OPTIONS: { value: CertificationType; label: string }[] = [
  { value: 'RID_NIC', label: 'RID - NIC (National Interpreter Certification)' },
  { value: 'RID_NIC_ADVANCED', label: 'RID - NIC Advanced' },
  { value: 'RID_NIC_MASTER', label: 'RID - NIC Master' },
  { value: 'RID_CDI', label: 'RID - CDI (Certified Deaf Interpreter)' },
  { value: 'BEI_BASIC', label: 'BEI - Basic' },
  { value: 'BEI_ADVANCED', label: 'BEI - Advanced' },
  { value: 'BEI_MASTER', label: 'BEI - Master' },
  { value: 'CCHI_CORE', label: 'CCHI - CoreCHI (Healthcare)' },
  { value: 'CCHI_PERFORMANCE', label: 'CCHI - CHI Performance (Healthcare)' },
  { value: 'NBCMI_CMI', label: 'NBCMI - CMI (Medical Interpreter)' },
  { value: 'STATE_LICENSE', label: 'State License' },
  { value: 'OTHER', label: 'Other Certification' },
];

const SPECIALIZATION_OPTIONS: { value: Specialization; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'medical', label: 'Medical' },
  { value: 'legal', label: 'Legal' },
  { value: 'educational', label: 'Educational' },
  { value: 'mental_health', label: 'Mental Health' },
];

export default function InterpreterOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Profile
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState(0);
  const [serviceRadius, setServiceRadius] = useState(25);
  const [specializations, setSpecializations] = useState<Specialization[]>(['general']);

  // Step 2: Certifications
  const [certType, setCertType] = useState<CertificationType>('RID_NIC');
  const [certNumber, setCertNumber] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certs, setCerts] = useState<{ type: CertificationType; number: string; file: File | null }[]>([]);

  function toggleSpecialization(spec: Specialization) {
    setSpecializations((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec],
    );
  }

  function addCert() {
    if (!certType) return;
    setCerts([...certs, { type: certType, number: certNumber, file: certFile }]);
    setCertNumber('');
    setCertFile(null);
  }

  async function handleComplete() {
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    // Create interpreter profile
    const { data: interpProfile, error: profileError } = await supabase
      .from('interpreter_profiles')
      .insert({
        user_id: user.id,
        bio,
        years_experience: yearsExperience,
        specializations,
        service_radius_miles: serviceRadius,
      })
      .select()
      .single();

    if (profileError) {
      // Profile might already exist, try update
      const { error: updateError } = await supabase
        .from('interpreter_profiles')
        .update({
          bio,
          years_experience: yearsExperience,
          specializations,
          service_radius_miles: serviceRadius,
        })
        .eq('user_id', user.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
    }

    const interpreterId = interpProfile?.id;

    // Upload certifications
    if (interpreterId) {
      for (const cert of certs) {
        let documentUrl = null;

        if (cert.file) {
          const filePath = `certs/${user.id}/${Date.now()}_${cert.file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('certifications')
            .upload(filePath, cert.file);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('certifications')
              .getPublicUrl(filePath);
            documentUrl = urlData.publicUrl;
          }
        }

        await supabase.from('certifications').insert({
          interpreter_id: interpreterId,
          cert_type: cert.type,
          cert_number: cert.number || null,
          document_url: documentUrl,
          verification_status: 'pending',
        });
      }

      // Recalculate tier based on certs and experience
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate_tier' }),
      });

      if (!res.ok) {
        console.error('Tier calculation failed');
      }
    }

    router.push('/interpreter/dashboard');
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Interpreter Setup</h1>
      <p className="text-gray-600 mb-6">Complete your profile to start receiving jobs</p>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
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

      {/* Step 1: Profile */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Your Profile</h2>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              placeholder="Tell clients about yourself and your interpreting experience..."
            />
          </div>

          <div>
            <label htmlFor="years" className="block text-sm font-medium text-gray-700 mb-1">
              Years of Interpreting Experience
            </label>
            <input
              id="years"
              type="number"
              min={0}
              max={50}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <p className="text-xs text-gray-600 mt-1">
              This helps us determine your experience tier and rate.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specializations
            </label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATION_OPTIONS.map((spec) => (
                <button
                  key={spec.value}
                  type="button"
                  onClick={() => toggleSpecialization(spec.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    specializations.includes(spec.value)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {spec.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="radius" className="block text-sm font-medium text-gray-700 mb-1">
              Service Radius: {serviceRadius} miles
            </label>
            <input
              id="radius"
              type="range"
              min={5}
              max={100}
              step={5}
              value={serviceRadius}
              onChange={(e) => setServiceRadius(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <button
            onClick={() => setStep(2)}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700"
          >
            Next: Certifications
          </button>
        </div>
      )}

      {/* Step 2: Certifications */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Certifications</h2>
          <p className="text-sm text-gray-600">
            Upload your interpreter certifications. These will be reviewed by our team.
          </p>

          {/* Existing certs */}
          {certs.length > 0 && (
            <div className="space-y-2">
              {certs.map((cert, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div>
                    <span className="font-medium text-sm">
                      {CERT_OPTIONS.find((c) => c.value === cert.type)?.label}
                    </span>
                    {cert.number && (
                      <span className="text-gray-600 text-sm ml-2">#{cert.number}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setCerts(certs.filter((_, idx) => idx !== i))}
                    className="text-red-500 text-sm hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add cert form */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div>
              <label htmlFor="certType" className="block text-sm font-medium text-gray-700 mb-1">
                Certification Type
              </label>
              <select
                id="certType"
                value={certType}
                onChange={(e) => setCertType(e.target.value as CertificationType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                {CERT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="certNum" className="block text-sm font-medium text-gray-700 mb-1">
                Certificate Number (optional)
              </label>
              <input
                id="certNum"
                type="text"
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="e.g., NIC-12345"
              />
            </div>

            <div>
              <label htmlFor="certDoc" className="block text-sm font-medium text-gray-700 mb-1">
                Upload Certificate Document
              </label>
              <input
                id="certDoc"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setCertFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <button
              type="button"
              onClick={addCert}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              + Add Certification
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700"
            >
              Next: Payment Setup
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Stripe Connect */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-slate-900">Payment setup</h2>
          <p className="text-sm text-slate-600">
            Set up your payout account so you can receive payments for your interpreting work.
            We use Stripe for secure payments.
          </p>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-1">Your estimated rate</h3>
            <p className="text-sm text-blue-800">
              Based on your {yearsExperience} years of experience and {certs.length} certification(s),
              your rate will be calculated after our team reviews your profile.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 space-y-2">
            <p className="font-medium text-slate-900">Stripe will ask you for:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your identity verification</li>
              <li>Your bank account for direct deposits</li>
              <li>Tax information (for 1099 reporting)</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">
              You can complete Stripe setup later, but you won&apos;t receive payouts until it&apos;s done.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Setting up…' : 'Connect Stripe'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleComplete}
            className="w-full text-slate-500 hover:text-slate-700 text-sm font-medium py-2 underline underline-offset-4"
          >
            I&apos;ll do this later — finish without Stripe
          </button>
        </div>
      )}
    </div>
  );
}
