import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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

/**
 * POST /api/business-requests
 * Deaf user requests a business to join PAH.
 * Body: { business_name, business_type?, contact_email?, contact_phone?, address?, reason? }
 */
export async function POST(request: Request) {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    business_name,
    business_type = 'medical',
    contact_email,
    contact_phone,
    address,
    reason,
  } = body;

  if (!business_name || business_name.trim().length < 2) {
    return NextResponse.json(
      { error: 'Business name is required' },
      { status: 400 },
    );
  }

  const serviceClient = getServiceClient();

  // Check for duplicate pending requests from same user for same business
  const { data: existing } = await serviceClient
    .from('business_registration_requests')
    .select('id')
    .eq('requested_by', user.id)
    .ilike('business_name', business_name.trim())
    .eq('status', 'pending')
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'You already have a pending request for this business', existing_id: existing[0].id },
      { status: 409 },
    );
  }

  const { data: reqRecord, error } = await serviceClient
    .from('business_registration_requests')
    .insert({
      requested_by: user.id,
      business_name: business_name.trim(),
      business_type,
      contact_email: contact_email || null,
      contact_phone: contact_phone || null,
      address: address || null,
      reason: reason || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await serviceClient.from('audit_log').insert({
    user_id: user.id,
    action: 'request_business_registration',
    resource_type: 'business_registration_request',
    resource_id: reqRecord.id,
    metadata: { business_name, business_type },
  });

  return NextResponse.json(reqRecord, { status: 201 });
}

/**
 * GET /api/business-requests
 * Get the current user's business registration requests
 */
export async function GET() {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('business_registration_requests')
    .select('*')
    .eq('requested_by', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
