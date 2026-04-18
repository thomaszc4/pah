'use client';

import { useEffect, useState } from 'react';
import { CURRENT_VRI_WARNING } from '@/lib/attestation/ada';
import type { Specialization } from '@/types';

interface VRIWarningProps {
  open: boolean;
  orgType?: string;
  specialization?: Specialization;
  deafUserPrefersInPerson?: boolean;
  onAcknowledge: (overrideReason?: string) => void;
  onCancel: () => void;
}

/**
 * Specializations where VRI is treated as presumptively inadequate per DOJ guidance
 * + settlement record. Selecting VRI for these is *hard-blocked*; the business must
 * provide a documented override reason and e-signature to proceed.
 */
const VRI_INADEQUATE_SPECS: Specialization[] = [
  'mental_health',
  'pediatric',
  'deaf_blind',
];

function isHardBlocked(spec?: Specialization): boolean {
  return !!spec && VRI_INADEQUATE_SPECS.includes(spec);
}

export function VRIWarning({
  open,
  orgType,
  specialization,
  deafUserPrefersInPerson,
  onAcknowledge,
  onCancel,
}: VRIWarningProps) {
  const isHealthcare = orgType === 'medical';
  const hardBlocked = isHardBlocked(specialization);
  const [countdown, setCountdown] = useState(isHealthcare || hardBlocked ? 5 : 0);
  const [checked, setChecked] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    if (!open) {
      setCountdown(isHealthcare || hardBlocked ? 5 : 0);
      setChecked(false);
      setOverrideReason('');
      return;
    }
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [open, countdown, isHealthcare, hardBlocked]);

  if (!open) return null;

  const overrideValid = !hardBlocked || overrideReason.trim().length >= 20;
  const canProceed = checked && countdown <= 0 && overrideValid;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vri-warning-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div
          className={`px-6 py-4 border-b ${
            hardBlocked ? 'border-rose-100 bg-rose-50' : 'border-slate-100 bg-amber-50'
          }`}
        >
          <h2
            id="vri-warning-title"
            className={`text-lg font-semibold ${hardBlocked ? 'text-rose-900' : 'text-amber-900'}`}
          >
            {hardBlocked ? 'VRI is generally inadequate for this setting' : 'Before you choose VRI'}
          </h2>
        </div>

        <div className="px-6 py-5 space-y-4">
          {hardBlocked && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-rose-900">
                DOJ guidance treats VRI as inadequate in this context.
              </p>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                {specialization === 'mental_health' &&
                  'Mental-health interactions often involve trauma, dissociation, or inability to attend to a screen. A patient may lose visual contact during a distressing moment.'}
                {specialization === 'pediatric' &&
                  'Young Deaf children cannot reliably attend to a 2D screen. Effective communication requires an in-person interpreter they can engage with naturally.'}
                {specialization === 'deaf_blind' &&
                  'Deaf-Blind communication typically requires tactile / ProTactile interpretation, which cannot be done over VRI.'}
              </p>
              <p className="text-xs text-rose-800 mt-2">
                To proceed with VRI anyway, document an overriding reason below. This is saved
                to the audit record and the Deaf client will see it on their booking.
              </p>
            </div>
          )}

          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {CURRENT_VRI_WARNING.text}
          </p>

          {deafUserPrefersInPerson && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              <p className="text-sm text-rose-900 font-medium">
                This Deaf client has indicated a preference for in-person interpreting.
              </p>
              <p className="text-xs text-rose-800 mt-1">
                Under the ADA &ldquo;primary consideration&rdquo; standard, their preference
                is generally determinative.
              </p>
            </div>
          )}

          {hardBlocked && (
            <div>
              <label
                htmlFor="vri-override-reason"
                className="block text-sm font-medium text-rose-900 mb-1"
              >
                Override reason (required — min 20 characters)
              </label>
              <textarea
                id="vri-override-reason"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full px-3 py-2 border border-rose-200 rounded-xl bg-white text-sm resize-none focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none"
                placeholder="E.g., Patient is 200 miles from the nearest in-person interpreter and needs this appointment today to avoid a treatment delay."
              />
            </div>
          )}

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-400 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-slate-800 leading-relaxed">
              I have read this notice, acknowledge the Deaf client&apos;s preference must
              receive primary consideration, and confirm VRI is appropriate for this booking.
            </span>
          </label>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            Switch to in-person
          </button>
          <button
            type="button"
            onClick={() => onAcknowledge(hardBlocked ? overrideReason.trim() : undefined)}
            disabled={!canProceed}
            className={`px-4 py-2 text-sm font-medium disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition ${
              hardBlocked
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {countdown > 0
              ? `Continue with VRI (${countdown})`
              : hardBlocked
              ? 'Override and continue'
              : 'Continue with VRI'}
          </button>
        </div>
      </div>
    </div>
  );
}
