import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { computeLicensedStates } from '@/lib/licensure/stateMatrix';
import type { CertificationType } from '@/types';

async function getAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options));
          } catch { /* ignore */ }
        },
      },
    },
  );
}

/**
 * GET /api/interpreter/licensure — returns the computed set of states where
 * the signed-in interpreter is eligible to work in-person, based on their
 * verified certifications.
 */
export async function GET() {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: interp } = await supabase
    .from('interpreter_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!interp) return NextResponse.json({ error: 'Not an interpreter' }, { status: 403 });

  const { data: certs } = await supabase
    .from('certifications')
    .select('cert_type, valid_in_states, verification_status')
    .eq('interpreter_id', interp.id);

  const verified = (certs ?? []).filter((c) => c.verification_status === 'verified');
  const computed = computeLicensedStates(
    verified.map((c) => ({
      cert_type: c.cert_type as CertificationType,
      valid_in_states: (c.valid_in_states as string[] | null) ?? [],
    })),
  );

  return NextResponse.json({
    nationwide: computed.nationwide,
    licensed_states: Array.from(computed.states).sort(),
    pending_verification: (certs ?? []).filter((c) => c.verification_status === 'pending').length,
  });
}
