import type { BookingStatus } from '@/types';

/**
 * Single source of truth for booking status pills.
 * Map covers all 12 statuses from BookingStatus enum; falls back safely.
 *
 * Audience: generic (same colors/labels everywhere, but callers can override
 * labels if they want a role-specific phrasing).
 */

type StatusLike = BookingStatus | string;

const STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  pending_business_approval: 'bg-amber-100 text-amber-800',
  matching: 'bg-blue-100 text-blue-800',
  offered: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  interpreter_en_route: 'bg-violet-100 text-violet-800',
  in_progress: 'bg-violet-100 text-violet-800',
  completed: 'bg-slate-100 text-slate-700',
  billed: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-rose-100 text-rose-800',
  no_match: 'bg-amber-100 text-amber-800',
  disputed: 'bg-orange-100 text-orange-800',
};

const LABELS: Record<string, string> = {
  pending: 'Pending',
  pending_business_approval: 'Awaiting Business',
  matching: 'Finding Interpreter',
  offered: 'Finding Interpreter',
  confirmed: 'Confirmed',
  interpreter_en_route: 'On the Way',
  in_progress: 'In Progress',
  completed: 'Completed',
  billed: 'Completed',
  cancelled: 'Cancelled',
  no_match: 'No Match',
  disputed: 'Disputed',
};

export function StatusBadge({
  status,
  label,
  size = 'md',
}: {
  status: StatusLike;
  /** Override the default human-readable label. */
  label?: string;
  size?: 'sm' | 'md';
}) {
  const cls = STYLES[status] ?? 'bg-slate-100 text-slate-700';
  const text = label ?? LABELS[status] ?? toTitle(status);
  const sizeCls = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeCls} ${cls}`}>
      {text}
    </span>
  );
}

function toTitle(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
