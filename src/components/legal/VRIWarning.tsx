'use client';

import { useEffect, useState } from 'react';
import { CURRENT_VRI_WARNING } from '@/lib/attestation/ada';

interface VRIWarningProps {
  open: boolean;
  orgType?: string;
  deafUserPrefersInPerson?: boolean;
  onAcknowledge: () => void;
  onCancel: () => void;
}

/**
 * Modal shown before a business can select VRI for a booking.
 * Adds a 5-second countdown for healthcare orgs (soft friction — DOJ guidance
 * treats VRI as generally inadequate in clinical settings).
 */
export function VRIWarning({
  open,
  orgType,
  deafUserPrefersInPerson,
  onAcknowledge,
  onCancel,
}: VRIWarningProps) {
  const isHealthcare = orgType === 'medical';
  const [countdown, setCountdown] = useState(isHealthcare ? 5 : 0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!open) {
      setCountdown(isHealthcare ? 5 : 0);
      setChecked(false);
      return;
    }
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [open, countdown, isHealthcare]);

  if (!open) return null;

  const canProceed = checked && countdown <= 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vri-warning-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-amber-50">
          <h2 id="vri-warning-title" className="text-lg font-semibold text-amber-900">
            Before you choose VRI
          </h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {CURRENT_VRI_WARNING.text}
          </p>

          {deafUserPrefersInPerson && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              <p className="text-sm text-rose-900 font-medium">
                This Deaf client has indicated a preference for in-person interpreting.
              </p>
              <p className="text-xs text-rose-800 mt-1">
                Under the ADA &ldquo;primary consideration&rdquo; standard, their preference is
                generally determinative.
              </p>
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
              I have read this notice and confirm VRI is appropriate for this specific
              booking.
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
            onClick={onAcknowledge}
            disabled={!canProceed}
            className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition"
          >
            {countdown > 0 ? `Continue with VRI (${countdown})` : 'Continue with VRI'}
          </button>
        </div>
      </div>
    </div>
  );
}
