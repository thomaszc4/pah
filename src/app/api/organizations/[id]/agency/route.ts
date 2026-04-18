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

function getService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

const patchSchema = z.object({
  is_agency: z.boolean().optional(),
  agency_dispatch_mode: z.enum(['supplier', 'white_label']).optional(),
  agency_markup_basis_points: z.number().int().min(0).max(10000).nullable().optional(),
});

/**
 * PATCH /api/organizations/[id]/agency — toggle agency mode + dispatch mode.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;
  const user = await requireOrgAdmin(orgId);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const raw = await request.json();
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const updates: Record<string, unknown> = { ...parsed.data };
  // If toggling is_agency on, also mark org_type
  if (parsed.data.is_agency === true) {
    updates.org_type = 'agency';
  }

  const service = getService();
  const { data, error } = await service
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await service.from('audit_log').insert({
    user_id: user.id,
    action: 'update_agency_settings',
    resource_type: 'organization',
    resource_id: orgId,
    metadata: updates,
  });

  return NextResponse.json(data);
}

const invitationSchema = z.object({
  action: z.literal('invite_interpreter'),
  interpreter_email: z.string().email(),
});

/**
 * POST /api/organizations/[id]/agency — invite an interpreter as staff.
 * If the interpreter already has a PAH account, immediately add to
 * organization_members with role='interpreter_staff'. Otherwise, the
 * invitation is pending (out of scope for MVP — returns "not found" error).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orgId } = await params;
  const user = await requireOrgAdmin(orgId);
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const raw = await request.json();
  const parsed = invitationSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const service = getService();

  // Look up the interpreter by email
  const { data: profile } = await service
    .from('profiles')
    .select('id, roles')
    .eq('email', parsed.data.interpreter_email.toLowerCase())
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { error: 'No PAH account with that email. They need to sign up as an interpreter first.' },
      { status: 404 },
    );
  }

  if (!Array.isArray(profile.roles) || !profile.roles.includes('interpreter')) {
    return NextResponse.json(
      { error: 'That account is not an interpreter. Only interpreters can be added as agency staff.' },
      { status: 400 },
    );
  }

  // Check interpreter_profiles exists for them (they completed onboarding)
  const { data: interp } = await service
    .from('interpreter_profiles')
    .select('id')
    .eq('user_id', profile.id)
    .maybeSingle();
  if (!interp) {
    return NextResponse.json(
      { error: 'That interpreter has not completed onboarding yet.' },
      { status: 400 },
    );
  }

  // Upsert membership
  const { error: memErr } = await service
    .from('organization_members')
    .upsert(
      { org_id: orgId, user_id: profile.id, role: 'interpreter_staff' },
      { onConflict: 'org_id,user_id' },
    );

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  await service.from('audit_log').insert({
    user_id: user.id,
    action: 'agency_add_interpreter_staff',
    resource_type: 'organization_member',
    resource_id: orgId,
    metadata: { interpreter_user_id: profile.id, email: parsed.data.interpreter_email },
  });

  return NextResponse.json({ ok: true, interpreter_user_id: profile.id });
}
