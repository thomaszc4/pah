'use client';

import { useState } from 'react';
import type { PayoutFrequency } from '@/types';

const OPTIONS: { value: PayoutFrequency; label: string; description: string }[] = [
  { value: 'per_job', label: 'Per job', description: 'Paid after each completed job.' },
  { value: 'weekly', label: 'Weekly', description: 'Paid every Friday for the prior week.' },
  { value: 'biweekly', label: 'Every 2 weeks', description: 'Paid every other Friday.' },
];

export default function PayoutFrequencySelector({
  initialFrequency,
}: {
  initialFrequency: PayoutFrequency;
}) {
  const [current, setCurrent] = useState<PayoutFrequency>(initialFrequency);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function pick(value: PayoutFrequency) {
    if (value === current) return;
    setCurrent(value);
    setSaving(true);
    setSaved(false);
    const res = await fetch('/api/interpreter/payout-frequency', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payout_frequency: value }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900">Payout frequency</h2>
        {saving && <span className="text-xs text-slate-500">Saving…</span>}
        {saved && <span className="text-xs text-emerald-600 font-medium">Saved</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => pick(opt.value)}
            className={`p-3 rounded-xl border-2 text-left transition ${
              current === opt.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="font-semibold text-sm text-slate-900">{opt.label}</div>
            <div className="text-xs text-slate-600 mt-0.5">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
