import Link from 'next/link';

export default function StripeSetupPlaceholder() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
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
        <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full mb-4">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
          Demo mode
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight mb-2">
          Stripe Connect
        </h1>
        <p className="text-slate-600 leading-relaxed mb-6">
          In production, this would launch Stripe&apos;s hosted onboarding flow to verify
          identity, collect bank details, and enable payouts or payment methods. For this
          preview, that step is simulated.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-sm text-slate-600 mb-6">
          <p className="font-medium text-slate-900 mb-2">What happens here in production:</p>
          <ul className="space-y-1.5">
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Stripe-hosted KYC identity verification</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Bank account connection for direct deposit</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Tax form collection (1099 reporting)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Return to PAH with account activated</span>
            </li>
          </ul>
        </div>
        <Link
          href="/dashboard"
          className="inline-block w-full bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
