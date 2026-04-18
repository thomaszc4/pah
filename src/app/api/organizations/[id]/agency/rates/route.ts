import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

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

async function requireOrgAdmin(orgId: string) {
  const supabase = await getAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .maybeSingle();
  return data ? user : null;
}

const rateSchema = z.object({
  interpreter_id: z.string().uuid(),
  hourly_rate_cents: z.number().int().positive().max(100_000),
  notes: z.string().max(1000).nullable().optional(),
});

/**
 * GET /api/organizations/[id]/agency/rates — list rate overrides for this agency.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;
  const user = await requireOrgAdmin(orgId);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const today = new Date().toISOString().split('T')[0];
  const { data } = await service
    .from('agency_interpreter_rates')
    .select(`
      id, interpreter_id, hourly_rate_cents, effective_date, end_date, notes, created_at,
      interpreter:interpreter_profiles(
        id, user_id,
        profile:profiles!interpreter_profiles_user_id_fkey(full_name, email)
      )
    `)
    .eq('organization_id', orgId)
    .or(`end_date.is.null,end_date.gte.${today}`)
    .order('created_at', { ascending: false });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/organizations/[id]/agency/rates — set an override rate for an interpreter.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;
  const user = await requireOrgAdmin(orgId);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const raw = await request.json();
  const parsed = rateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await service
    .from('agency_interpreter_rates')
    .insert({
      organization_id: orgId,
      interpreter_id: parsed.data.interpreter_id,
      hourly_rate_cents: parsed.data.hourly_rate_cents,
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await service.from('audit_log').insert({
    user_id: user.id,
    action: 'agency_set_rate',
    resource_type: 'agency_interpreter_rate',
    resource_id: data.id,
    metadata: { interpreter_id: parsed.data.interpreter_id, hourly_rate_cents: parsed.data.hourly_rate_cents },
  });

  return NextResponse.json(data);
}
