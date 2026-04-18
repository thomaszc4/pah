-- ============================================================
-- PAH — Migration 003: Three-party access, ratings, agency model
-- Covers features A (invitations), B (RLS for business chat — already done),
-- C (team interpreting), D (VRI hard overrides), E (org ratings),
-- F (agency accounts + staff), G (ICS/calendar), H (state licensure),
-- I (pre-booking chat via RLS).
-- Idempotent: "if not exists" / "drop constraint if exists" throughout.
-- ============================================================

-- ============================================================
-- A. BOOKING INVITATIONS (consent-first Deaf linkage)
-- ============================================================

create table if not exists public.booking_invitations (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  email text,
  phone text,
  full_name text,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','expired')),
  sent_via text[] not null default '{}',  -- {'email','sms'}
  sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  linked_user_id uuid references public.profiles(id)
);

create index if not exists idx_booking_invitations_booking on public.booking_invitations(booking_id);
create index if not exists idx_booking_invitations_email on public.booking_invitations(email) where email is not null;
create index if not exists idx_booking_invitations_phone on public.booking_invitations(phone) where phone is not null;

alter table public.booking_invitations enable row level security;

-- Only the booking owner (business admin) and service role can read/write invitations.
-- The token-verification path is handled via service role on the /invite/[token] route.
drop policy if exists "Business admins see their invitations" on public.booking_invitations;
create policy "Business admins see their invitations"
  on public.booking_invitations for select
  using (
    booking_id in (
      select id from public.bookings
      where organization_id in (
        select org_id from public.organization_members where user_id = auth.uid()
      )
    )
  );

-- notify-client flag on bookings
alter table public.bookings
  add column if not exists notify_client_of_booking boolean not null default true;

-- ============================================================
-- C. TEAM INTERPRETING
-- ============================================================

create table if not exists public.booking_interpreters (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  interpreter_id uuid not null references public.interpreter_profiles(id) on delete cascade,
  role text not null default 'primary'
    check (role in ('primary','team')),
  status text not null default 'offered'
    check (status in ('offered','confirmed','declined','cancelled','no_show','completed')),
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  payout_cents int,
  unique(booking_id, role)
);

create index if not exists idx_booking_interpreters_booking on public.booking_interpreters(booking_id);
create index if not exists idx_booking_interpreters_interp on public.booking_interpreters(interpreter_id);

alter table public.booking_interpreters enable row level security;

drop policy if exists "Booking participants see team roster" on public.booking_interpreters;
create policy "Booking participants see team roster"
  on public.booking_interpreters for select
  using (
    booking_id in (
      select id from public.bookings
      where deaf_user_id = auth.uid()
        or requested_by = auth.uid()
        or interpreter_id in (select id from public.interpreter_profiles where user_id = auth.uid())
        or organization_id in (select org_id from public.organization_members where user_id = auth.uid())
    )
    or interpreter_id in (select id from public.interpreter_profiles where user_id = auth.uid())
  );

alter table public.bookings
  add column if not exists requires_team boolean not null default false,
  add column if not exists team_override_reason text,
  add column if not exists team_override_signed_by uuid references public.profiles(id),
  add column if not exists team_override_signed_at timestamptz;

-- ============================================================
-- D. VRI HARD-OVERRIDE CAPTURE
-- ============================================================

alter table public.bookings
  add column if not exists vri_override_reason text,
  add column if not exists vri_override_signed_by uuid references public.profiles(id),
  add column if not exists vri_override_signed_at timestamptz,
  add column if not exists vri_override_version text;

-- ============================================================
-- E. ORGANIZATION RATINGS (verified-visit gated)
-- ============================================================

create table if not exists public.organization_ratings (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  rated_by uuid not null references public.profiles(id),
  overall_rating int not null check (overall_rating between 1 and 5),
  attributes jsonb not null default '{}'::jsonb,
  review_text text,
  is_visible boolean not null default true,
  flagged_for_review boolean not null default false,
  admin_action text check (admin_action in ('kept','hidden','removed') or admin_action is null),
  admin_notes text,
  business_response text,
  business_response_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, rated_by)
);

create index if not exists idx_org_ratings_org on public.organization_ratings(organization_id, is_visible, created_at desc);
create index if not exists idx_org_ratings_flagged on public.organization_ratings(flagged_for_review) where flagged_for_review = true;

alter table public.organization_ratings enable row level security;

-- Public can read visible ratings (directory is public per user decision)
drop policy if exists "Public read visible ratings" on public.organization_ratings;
create policy "Public read visible ratings"
  on public.organization_ratings for select
  to anon, authenticated
  using (is_visible = true);

-- Only the rater can insert (verified-visit gating enforced at the API layer)
drop policy if exists "Raters create their own reviews" on public.organization_ratings;
create policy "Raters create their own reviews"
  on public.organization_ratings for insert
  to authenticated
  with check (auth.uid() = rated_by);

-- Rater can update their own review text; business admins can set their response only
drop policy if exists "Raters update own reviews" on public.organization_ratings;
create policy "Raters update own reviews"
  on public.organization_ratings for update
  to authenticated
  using (auth.uid() = rated_by);

-- Admins can moderate (via service role + platform_admin policy)
drop policy if exists "Admins moderate ratings" on public.organization_ratings;
create policy "Admins moderate ratings"
  on public.organization_ratings for all
  using (public.is_platform_admin(auth.uid()));

alter table public.organizations
  add column if not exists avg_rating decimal(3,2),
  add column if not exists rating_count int not null default 0,
  add column if not exists public_slug text,
  add column if not exists accessibility_summary jsonb;

-- Slugs for public /businesses/[slug] URLs. Generated from org name on insert/update.
create or replace function public.generate_org_slug(org_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(regexp_replace(trim(org_name), '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'));
$$;

-- Backfill slugs for existing orgs (idempotent — skips orgs that already have a slug)
update public.organizations
set public_slug = public.generate_org_slug(name) || '-' || substring(id::text, 1, 6)
where public_slug is null;

create unique index if not exists idx_organizations_public_slug
  on public.organizations(public_slug)
  where public_slug is not null;

-- Public read of organizations (for the /businesses directory)
drop policy if exists "Public read organization directory" on public.organizations;
create policy "Public read organization directory"
  on public.organizations for select
  to anon, authenticated
  using (true);

-- ============================================================
-- F. AGENCY ACCOUNTS
-- ============================================================

-- Extend org_type to include 'agency'
alter table public.organizations drop constraint if exists organizations_org_type_check;
alter table public.organizations add constraint organizations_org_type_check
  check (org_type in ('medical','legal','educational','government','corporate','agency','other'));

alter table public.organizations
  add column if not exists is_agency boolean not null default false,
  add column if not exists agency_markup_basis_points int,
  add column if not exists agency_dispatch_mode text default 'supplier'
    check (agency_dispatch_mode in ('supplier','white_label'));

-- Extend org member roles to include interpreter_staff
alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check
  check (role in ('owner','admin','member','interpreter_staff'));

-- Agency-specific interpreter rate overrides (agency pays their staff these rates)
create table if not exists public.agency_interpreter_rates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interpreter_id uuid not null references public.interpreter_profiles(id) on delete cascade,
  hourly_rate_cents int not null,
  effective_date date not null default current_date,
  end_date date,
  notes text,
  created_at timestamptz not null default now(),
  unique(organization_id, interpreter_id, effective_date)
);

alter table public.agency_interpreter_rates enable row level security;

drop policy if exists "Agency members manage their rates" on public.agency_interpreter_rates;
create policy "Agency members manage their rates"
  on public.agency_interpreter_rates for all
  using (
    organization_id in (
      select org_id from public.organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );

-- ============================================================
-- H. STATE LICENSURE GEO-GATING
-- ============================================================

alter table public.certifications
  add column if not exists valid_in_states text[] not null default '{}';

-- Backfill valid_in_states for known cert types (best guesses; admins can refine).
-- Empty array = valid everywhere that doesn't require state license (nationwide certs).
-- Specific state array = license valid only in those states.
update public.certifications set valid_in_states = array['TX']
  where cert_type in ('BEI_BASIC','BEI_ADVANCED','BEI_MASTER','BEI_COURT','BEI_MEDICAL','BEI_TRILINGUAL')
    and (valid_in_states = '{}' or valid_in_states is null);

-- RID/CCHI/NBCMI etc. are national — leave empty to indicate "valid where state doesn't require license".

-- ============================================================
-- I. PRE-BOOKING CHAT (Deaf ↔ interpreter only at 'offered' stage)
-- ============================================================

-- Extend chat_messages RLS to allow reads/writes for Deaf user and offered interpreter
-- when the booking is in 'offered' status, with business excluded at that stage.
drop policy if exists "Booking participants read chat" on public.chat_messages;
create policy "Booking participants read chat"
  on public.chat_messages for select
  using (
    booking_id in (
      select id from public.bookings
      where (
        -- Full-chat phase: confirmed onward, all parties
        status in ('confirmed','interpreter_en_route','in_progress','completed','billed')
        and (
          deaf_user_id = auth.uid()
          or requested_by = auth.uid()
          or interpreter_id in (select id from public.interpreter_profiles where user_id = auth.uid())
          or organization_id in (select org_id from public.organization_members where user_id = auth.uid())
        )
      )
      or (
        -- Pre-booking phase: only deaf_user and offered interpreter (no business)
        status = 'offered'
        and (
          deaf_user_id = auth.uid()
          or interpreter_id in (select id from public.interpreter_profiles where user_id = auth.uid())
        )
      )
    )
  );

drop policy if exists "Booking participants send chat" on public.chat_messages;
create policy "Booking participants send chat"
  on public.chat_messages for insert
  with check (
    auth.uid() = sender_id
    and booking_id in (
      select id from public.bookings
      where (
        status in ('confirmed','interpreter_en_route','in_progress')
        and (
          deaf_user_id = auth.uid()
          or requested_by = auth.uid()
          or interpreter_id in (select id from public.interpreter_profiles where user_id = auth.uid())
          or organization_id in (select org_id from public.organization_members where user_id = auth.uid())
        )
      )
      or (
        status = 'offered'
        and (
          deaf_user_id = auth.uid()
          or interpreter_id in (select id from public.interpreter_profiles where user_id = auth.uid())
        )
      )
    )
  );

-- ============================================================
-- G. CALENDAR INTEGRATION — no schema changes needed for MVP.
-- Token storage uses existing google_calendar_token_enc field on interpreter_profiles;
-- extend to organization_members in a future migration if needed.
-- ============================================================

-- Webhook-ingested appointments (Phase 3G2) — prep table for clinic-side integrations
create table if not exists public.external_appointment_ingests (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_id text not null,
  external_system text not null,
  raw_payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','converted','ignored','error')),
  booking_id uuid references public.bookings(id),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (organization_id, external_system, external_id)
);

alter table public.external_appointment_ingests enable row level security;

drop policy if exists "Org admins see their ingests" on public.external_appointment_ingests;
create policy "Org admins see their ingests"
  on public.external_appointment_ingests for select
  using (
    organization_id in (
      select org_id from public.organization_members
      where user_id = auth.uid() and role in ('owner','admin')
    )
  );
