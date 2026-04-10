-- ============================================================
-- PAH — Initial Database Schema
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  avatar_url text,
  roles text[] not null default '{}',
  preferred_language text not null default 'asl',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, roles)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when new.raw_user_meta_data->>'role' is not null
        then array[new.raw_user_meta_data->>'role']
      else '{}'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- INTERPRETER PROFILES
-- ============================================================
create table public.interpreter_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_connect_account_id text,
  stripe_onboarding_complete boolean not null default false,
  bio text,
  years_experience int not null default 0,
  experience_tier text not null default 'provisional'
    check (experience_tier in ('provisional', 'certified', 'advanced', 'expert')),
  hourly_rate_cents int not null default 4200,
  specializations text[] not null default '{general}',
  certifications_verified boolean not null default false,
  service_radius_miles int not null default 25,
  is_available boolean not null default false,
  current_lat decimal(10,7),
  current_lng decimal(10,7),
  last_location_update timestamptz,
  avg_rating decimal(3,2) not null default 0,
  total_jobs int not null default 0,
  total_earnings_cents bigint not null default 0,
  round_robin_score decimal(10,4) not null default 0,
  google_calendar_token_enc text,
  google_calendar_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CERTIFICATIONS
-- ============================================================
create table public.certifications (
  id uuid primary key default uuid_generate_v4(),
  interpreter_id uuid not null references public.interpreter_profiles(id) on delete cascade,
  cert_type text not null,
  cert_number text,
  issued_date date,
  expiry_date date,
  document_url text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'expired')),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  org_type text not null default 'other'
    check (org_type in ('medical', 'legal', 'educational', 'government', 'corporate', 'other')),
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  lat decimal(10,7),
  lng decimal(10,7),
  phone text,
  email text,
  website text,
  stripe_customer_id text,
  payment_method_on_file boolean not null default false,
  hipaa_baa_signed boolean not null default false,
  hipaa_baa_signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- ============================================================
-- BOOKINGS
-- ============================================================
create table public.bookings (
  id uuid primary key default uuid_generate_v4(),

  -- Participants
  deaf_user_id uuid references public.profiles(id),
  interpreter_id uuid references public.interpreter_profiles(id),
  organization_id uuid references public.organizations(id),
  requested_by uuid not null references public.profiles(id),

  -- Type
  booking_type text not null default 'scheduled'
    check (booking_type in ('scheduled', 'urgent', 'on_demand')),
  specialization_required text not null default 'general',

  -- When
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,

  -- Where
  location_type text not null default 'in_person'
    check (location_type in ('in_person', 'vri')),
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  lat decimal(10,7),
  lng decimal(10,7),

  -- Status
  status text not null default 'pending'
    check (status in (
      'pending', 'matching', 'offered', 'confirmed',
      'interpreter_en_route', 'in_progress',
      'completed', 'billed', 'cancelled', 'no_match', 'disputed'
    )),

  -- Pricing (all in cents)
  base_rate_cents int not null default 8500,
  rush_multiplier decimal(3,2) not null default 1.0,
  estimated_duration_minutes int not null default 120,
  actual_duration_minutes int,
  wait_time_minutes int not null default 0,
  total_charge_cents int,
  interpreter_payout_cents int,
  platform_fee_cents int,

  -- Payment
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'authorized', 'captured', 'transferred', 'refunded', 'failed')),

  -- Cancellation
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  cancellation_fee_cents int not null default 0,

  -- Dedup
  dedup_key text,
  merged_from_booking_id uuid references public.bookings(id),

  -- Notes (HIPAA: NO medical details allowed)
  public_notes text,
  interpreter_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bookings_dedup on public.bookings(dedup_key) where dedup_key is not null;
create index idx_bookings_status on public.bookings(status);
create index idx_bookings_scheduled_start on public.bookings(scheduled_start);
create index idx_bookings_interpreter on public.bookings(interpreter_id);
create index idx_bookings_deaf_user on public.bookings(deaf_user_id);
create index idx_bookings_org on public.bookings(organization_id);

-- ============================================================
-- BOOKING OFFERS (matching trail)
-- ============================================================
create table public.booking_offers (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  interpreter_id uuid not null references public.interpreter_profiles(id),
  offer_order int not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  offered_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null,
  decline_reason text,
  match_score decimal(5,2) not null default 0,
  distance_miles decimal(6,2) not null default 0
);

-- ============================================================
-- RATINGS
-- ============================================================
create table public.ratings (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  rated_by uuid not null references public.profiles(id),
  rated_user uuid not null references public.profiles(id),
  rating int not null check (rating >= 1 and rating <= 5),
  review_text text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (booking_id, rated_by)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, read, created_at desc);

-- ============================================================
-- AUDIT LOG (HIPAA: append-only)
-- ============================================================
create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_user on public.audit_log(user_id, created_at desc);
create index idx_audit_resource on public.audit_log(resource_type, resource_id);

-- ============================================================
-- AVAILABILITY WINDOWS
-- ============================================================
create table public.availability_windows (
  id uuid primary key default uuid_generate_v4(),
  interpreter_id uuid not null references public.interpreter_profiles(id) on delete cascade,
  day_of_week int not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null,
  is_recurring boolean not null default true,
  specific_date date,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PLATFORM CONFIG
-- ============================================================
create table public.platform_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed default config
insert into public.platform_config (key, value) values
  ('in_person_hourly_cents', '8500'),
  ('vri_hourly_cents', '5500'),
  ('rush_threshold_hours', '24'),
  ('rush_multiplier', '1.5'),
  ('minimum_hours_in_person', '2'),
  ('minimum_hours_vri', '1');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.interpreter_profiles enable row level security;
alter table public.certifications enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_offers enable row level security;
alter table public.ratings enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;
alter table public.availability_windows enable row level security;
alter table public.platform_config enable row level security;

-- PROFILES: users can read/update own profile; public fields visible to all authenticated
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can view other profiles (limited)"
  on public.profiles for select
  using (auth.uid() is not null);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- INTERPRETER PROFILES: owner full access; authenticated users can view public fields
create policy "Interpreter can manage own profile"
  on public.interpreter_profiles for all
  using (user_id = auth.uid());

create policy "Authenticated users can view interpreter profiles"
  on public.interpreter_profiles for select
  using (auth.uid() is not null);

-- CERTIFICATIONS: owner can manage; admin can verify
create policy "Interpreter can manage own certs"
  on public.certifications for all
  using (
    interpreter_id in (
      select id from public.interpreter_profiles where user_id = auth.uid()
    )
  );

create policy "Authenticated users can view verified certs"
  on public.certifications for select
  using (auth.uid() is not null and verification_status = 'verified');

-- ORGANIZATIONS: members can view/manage
create policy "Org members can view their org"
  on public.organizations for select
  using (
    id in (select org_id from public.organization_members where user_id = auth.uid())
  );

create policy "Org owners/admins can update"
  on public.organizations for update
  using (
    id in (
      select org_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Authenticated users can create orgs"
  on public.organizations for insert
  with check (auth.uid() is not null);

-- ORGANIZATION MEMBERS
create policy "Members can view their org members"
  on public.organization_members for select
  using (
    org_id in (select org_id from public.organization_members where user_id = auth.uid())
  );

create policy "Org owners can manage members"
  on public.organization_members for all
  using (
    org_id in (
      select org_id from public.organization_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- BOOKINGS: involved parties can view/update
create policy "Users can view their bookings"
  on public.bookings for select
  using (
    auth.uid() = deaf_user_id
    or auth.uid() = requested_by
    or interpreter_id in (
      select id from public.interpreter_profiles where user_id = auth.uid()
    )
    or organization_id in (
      select org_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "Authenticated users can create bookings"
  on public.bookings for insert
  with check (auth.uid() is not null);

create policy "Involved parties can update bookings"
  on public.bookings for update
  using (
    auth.uid() = deaf_user_id
    or auth.uid() = requested_by
    or interpreter_id in (
      select id from public.interpreter_profiles where user_id = auth.uid()
    )
    or organization_id in (
      select org_id from public.organization_members where user_id = auth.uid()
    )
  );

-- BOOKING OFFERS: interpreter can view/respond to their offers
create policy "Interpreters can view their offers"
  on public.booking_offers for select
  using (
    interpreter_id in (
      select id from public.interpreter_profiles where user_id = auth.uid()
    )
  );

create policy "System can manage offers"
  on public.booking_offers for all
  using (auth.uid() is not null);

-- RATINGS: public read, creator write
create policy "Anyone can view visible ratings"
  on public.ratings for select
  using (is_visible = true);

create policy "Users can create ratings"
  on public.ratings for insert
  with check (auth.uid() = rated_by);

-- NOTIFICATIONS: user sees own only
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- AUDIT LOG: no user access (service role only)
-- No policies = no access through client

-- AVAILABILITY WINDOWS: interpreter manages own
create policy "Interpreters manage own availability"
  on public.availability_windows for all
  using (
    interpreter_id in (
      select id from public.interpreter_profiles where user_id = auth.uid()
    )
  );

create policy "Authenticated can view availability"
  on public.availability_windows for select
  using (auth.uid() is not null);

-- PLATFORM CONFIG: readable by all authenticated
create policy "Anyone can read config"
  on public.platform_config for select
  using (auth.uid() is not null);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger interpreter_profiles_updated_at
  before update on public.interpreter_profiles
  for each row execute function public.update_updated_at();

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.update_updated_at();

create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.update_updated_at();
