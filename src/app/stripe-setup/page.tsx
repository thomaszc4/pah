'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function StripeSetupPage() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'needs_setup' | 'complete' | 'redirecting' | 'error'>('checking');
  const [error, setError] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    setIsTestMode(pk.startsWith('pk_test_'));
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('error');
        setError('Please log in first.');
        return;
      }
      const { data: interp } = await supabase
        .from('interpreter_profiles')
        .select('stripe_onboarding_complete')
        .eq('user_id', user.id)
        .maybeSingle();
      if (interp?.stripe_onboarding_complete) {
        setStatus('complete');
      } else {
        setStatus('needs_setup');
      }
    })();
  }, []);

  async function handleStart() {
    setStatus('redirecting');
    setError('');
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_account' }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start Stripe onboarding.');
      }
      // Redirect to Stripe-hosted onboarding
      window.location.href = data.url;
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="w-14 h-14 mx-auto bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mb-5 shadow-sm">
          <svg
            className="w-7 h-7 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight text-center mb-2">
          Stripe Connect
        </h1>

        {isTestMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 text-xs text-amber-900 text-center font-medium">
            Test mode — no real payouts
          </div>
        )}

        {status === 'checking' && (
          <p className="text-slate-600 text-center">Checking your account…</p>
        )}

        {status === 'needs_setup' && (
          <>
            <p className="text-slate-700 leading-relaxed mb-5">
              Stripe will verify your identity, collect bank details, and set up direct
              deposit so you can be paid for your jobs. Takes about 5 minutes.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 mb-6">
              <p className="font-medium text-slate-900 mb-2">You&apos;ll provide:</p>
              <ul className="space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-blue-700">•</span>
                  <span>Legal name, DOB, and last 4 of SSN</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-700">•</span>
                  <span>A bank account for direct deposit</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-700">•</span>
                  <span>Tax info for 1099 reporting</span>
                </li>
              </ul>
            </div>
            {isTestMode && (
              <details className="mb-5 text-xs">
                <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-medium">
                  Test-mode values you can use
                </summary>
                <div className="mt-2 p-3 bg-slate-50 rounded-lg text-slate-700 space-y-1 font-mono">
                  <div>SSN: <strong>000-00-0000</strong></div>
                  <div>DOB: any date 18+ years old</div>
                  <div>Phone: <strong>000-000-0000</strong></div>
                  <div>Routing: <strong>110000000</strong></div>
                  <div>Account: <strong>000123456789</strong></div>
                </div>
              </details>
            )}
            <button
              type="button"
              onClick={handleStart}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-3 rounded-xl transition-colors shadow-sm"
            >
              Continue to Stripe →
            </button>
            <p className="text-center text-xs text-slate-500 mt-3">
              You&apos;ll leave PAH briefly and come back when done.
            </p>
          </>
        )}

        {status === 'complete' && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-2 shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-emerald-900">Stripe connected</p>
              <p className="text-sm text-emerald-800 mt-1">
                You&apos;re all set to receive payouts.
              </p>
            </div>
            <Link
              href="/interpreter/earnings"
              className="block text-center w-full bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              Go to Earnings
            </Link>
          </>
        )}

        {status === 'redirecting' && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600 mx-auto mb-3" />
            <p className="text-slate-700">Redirecting to Stripe…</p>
          </div>
        )}

        {status === 'error' && (
          <>
            <div
              role="alert"
              className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4 text-sm text-rose-800"
            >
              {error}
            </div>
            <button
              type="button"
              onClick={() => {
                setStatus('needs_setup');
                setError('');
              }}
              className="w-full border border-slate-300 hover:bg-slate-50 text-slate-900 font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
