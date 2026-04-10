import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import Stripe from 'stripe';
import { calculateTier } from '@/lib/utils/tier';
import type { CertificationType } from '@/types';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-03-31.basil',
  });
}

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
          } catch { /* Server Component */ }
        },
      },
    },
  );
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  const serviceClient = getServiceClient();

  const stripe = getStripe();

  switch (action) {
    case 'create_account': {
      // Create Stripe Connect Express account for interpreter
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { user_id: user.id },
      });

      // Save account ID
      await serviceClient
        .from('interpreter_profiles')
        .update({ stripe_connect_account_id: account.id })
        .eq('user_id', user.id);

      // Create account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/interpreter/earnings`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/interpreter/earnings`,
        type: 'account_onboarding',
      });

      return NextResponse.json({ url: accountLink.url });
    }

    case 'calculate_tier': {
      // Recalculate interpreter's tier based on certs and experience
      const { data: interpProfile } = await serviceClient
        .from('interpreter_profiles')
        .select('id, years_experience, specializations')
        .eq('user_id', user.id)
        .single();

      if (!interpProfile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }

      const { data: certs } = await serviceClient
        .from('certifications')
        .select('cert_type')
        .eq('interpreter_id', interpProfile.id);

      const certTypes = (certs || []).map((c) => c.cert_type as CertificationType);
      const { tier, hourlyRateCents, compositeScore } = calculateTier(
        certTypes,
        interpProfile.years_experience,
        interpProfile.specializations?.length || 1,
      );

      await serviceClient
        .from('interpreter_profiles')
        .update({
          experience_tier: tier,
          hourly_rate_cents: hourlyRateCents,
        })
        .eq('id', interpProfile.id);

      return NextResponse.json({ tier, hourlyRateCents, compositeScore });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
