'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/types';

const ROLES: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'deaf_user',
    label: 'Deaf, DeafBlind, or hard-of-hearing',
    description: 'Find and book ASL interpreters for appointments or events.',
  },
  {
    value: 'interpreter',
    label: 'ASL Interpreter',
    description: 'Accept jobs, manage your schedule, and get paid.',
  },
  {
    value: 'business_admin',
    label: 'Business / Organization',
    description: 'Book interpreters for your clients and manage billing.',
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'role' | 'details'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const smsEnabled = process.env.NEXT_PUBLIC_SMS_ENABLED !== 'false';

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole) return;

    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: selectedRole,
          phone,
        },
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    // Persist phone on the profile row (created by trigger).
    if (authData.user && phone.trim()) {
      await supabase.from('profiles').update({ phone }).eq('id', authData.user.id);
    }

    // Prime Deaf user preferences with SMS opt-in.
    if (authData.user && selectedRole === 'deaf_user' && phone.trim()) {
      await supabase
        .from('deaf_user_preferences')
        .upsert({ user_id: authData.user.id, notify_sms: smsOptIn });
    }

    const redirectMap: Record<UserRole, string> = {
      deaf_user: '/dashboard',
      interpreter: '/interpreter/onboarding',
      business_admin: '/business/onboarding',
      platform_admin: '/admin',
    };

    router.push(redirectMap[selectedRole]);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">PAH</h1>
          </Link>
          <p className="text-slate-600 mt-2">Finally, interpreting on your terms.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {step === 'role' && (
            <>
              <h2 className="text-xl font-semibold text-slate-900 mb-5">I am a…</h2>
              <div className="space-y-3">
                {ROLES.map((role) => (
                  <button
                    key={role.value}
                    onClick={() => {
                      setSelectedRole(role.value);
                      setStep('details');
                    }}
                    className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <div className="font-semibold text-slate-900">{role.label}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{role.description}</div>
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-slate-600 mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-4">
                  Log in
                </Link>
              </p>
            </>
          )}

          {step === 'details' && (
            <form onSubmit={handleSignup}>
              <button
                type="button"
                onClick={() => setStep('role')}
                className="text-sm text-slate-500 hover:text-slate-700 mb-4 font-medium"
              >
                ← Back
              </button>

              <h2 className="text-xl font-semibold text-slate-900 mb-5">Create your account</h2>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-4 text-sm"
                >
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-1">
                    Full name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                    Phone {smsEnabled ? '(for SMS confirmations)' : '(optional)'}
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    placeholder="(555) 123-4567"
                  />
                  {selectedRole === 'deaf_user' && smsEnabled && (
                    <label className="flex items-start gap-2 mt-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={smsOptIn}
                        onChange={(e) => setSmsOptIn(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Text me booking updates so I don&apos;t need an app to stay informed.</span>
                    </label>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    placeholder="At least 8 characters"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </div>

              <p className="text-center text-sm text-slate-600 mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-4">
                  Log in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
