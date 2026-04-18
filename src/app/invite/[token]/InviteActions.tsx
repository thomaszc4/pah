'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function InviteActions({
  token,
  prefilEmail,
  prefilName,
}: {
  token: string;
  prefilEmail: string;
  prefilName: string;
}) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user));
  }, []);

  async function act(decision: 'accept' | 'decline') {
    setSubmitting(true);
    setError('');
    const res = await fetch(`/api/invite/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      setSubmitting(false);
      return;
    }
    if (decision === 'accept' && data.booking_id) {
      router.push(`/bookings/${data.booking_id}`);
    } else {
      router.refresh();
    }
  }

  if (isLoggedIn === null) {
    return <div className="px-6 py-4 text-slate-600 text-sm">Loading…</div>;
  }

  return (
    <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 space-y-3">
      {error && (
        <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isLoggedIn ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => act('accept')}
            disabled={submitting}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium disabled:opacity-50 shadow-sm transition-colors"
          >
            {submitting ? 'Working…' : 'Accept & see booking'}
          </button>
          <button
            type="button"
            onClick={() => act('decline')}
            disabled={submitting}
            className="px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            No thanks
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Sign up (free) to accept this invitation and see the booking details.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href={`/signup?invitation=${token}&email=${encodeURIComponent(prefilEmail)}&name=${encodeURIComponent(prefilName)}`}
              className="flex-1 text-center bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors"
            >
              Sign up & accept
            </Link>
            <Link
              href={`/login?invitation=${token}`}
              className="flex-1 text-center border border-slate-300 text-slate-700 hover:bg-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              I already have an account
            </Link>
          </div>
          <button
            type="button"
            onClick={() => act('decline')}
            disabled={submitting}
            className="w-full text-xs text-slate-600 hover:text-slate-800 underline underline-offset-4"
          >
            Decline without creating an account
          </button>
        </div>
      )}
    </div>
  );
}
