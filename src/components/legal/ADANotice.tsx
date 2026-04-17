'use client';

import { CURRENT_ADA_NOTICE } from '@/lib/attestation/ada';

interface ADANoticeProps {
  variant?: 'short' | 'full' | 'receipt' | 'footer';
  checked?: boolean;
  onCheckedChange?: (next: boolean) => void;
  orgName?: string;
}

/**
 * ADA Title III / Section 1557 liability notice.
 * Shown to businesses at booking + onboarding; to deaf users on receipts
 * for transparency (they see who's responsible).
 */
export function ADANotice({
  variant = 'short',
  checked,
  onCheckedChange,
  orgName,
}: ADANoticeProps) {
  const subjectName = orgName ?? 'The business';

  if (variant === 'footer') {
    return (
      <div className="text-xs text-slate-500 leading-relaxed">
        Under the ADA (42 U.S.C. §12182) and Section 1557 of the ACA, places of public
        accommodation and covered health programs are legally responsible for providing and
        paying for qualified sign language interpreters. PAH helps you meet that obligation.
      </div>
    );
  }

  if (variant === 'receipt') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
        <div className="font-semibold text-slate-900 mb-1">ADA responsibility</div>
        <p>
          {subjectName} is billed for this service. Under the ADA, businesses may not pass
          interpreter costs to the Deaf individual.
        </p>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-amber-900 text-sm">
          ADA &amp; Section 1557 Responsibility
        </h3>
        <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-line">
          {CURRENT_ADA_NOTICE.text}
        </p>
        {onCheckedChange && (
          <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={!!checked}
              onChange={(e) => onCheckedChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-700 focus:ring-amber-500"
            />
            <span className="text-amber-900">
              I am an authorized agent of {orgName ?? 'this business'} and I acknowledge this
              notice.
            </span>
          </label>
        )}
        <div className="text-[10px] text-amber-800/70 pt-1">
          Version {CURRENT_ADA_NOTICE.version} · {CURRENT_ADA_NOTICE.hash}
        </div>
      </div>
    );
  }

  // short (default) — inline checkbox on booking form
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-slate-800 leading-relaxed">
          <span className="font-medium">ADA acknowledgment.</span> {subjectName} is legally
          responsible under the Americans with Disabilities Act (42 U.S.C. §12182) for
          providing and paying for this interpreter service. I am authorized to book on
          behalf of the business and accept payment responsibility.
        </span>
      </label>
      <div className="text-[10px] text-slate-500 mt-2 pl-6">
        Version {CURRENT_ADA_NOTICE.version}
      </div>
    </div>
  );
}

export function ADAVersionBadge() {
  return (
    <span className="text-[10px] text-slate-500">
      ADA v{CURRENT_ADA_NOTICE.version}
    </span>
  );
}
