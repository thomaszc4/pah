-- ============================================================
-- PAH — Feature Rollout Migration 002
-- Covers 22 features from prioritization CSV (April 2026)
-- Idempotent: uses "if not exists" where possible
-- ============================================================

-- ============================================================
-- 1. BOOKINGS: new columns for ADA, emergency, VRI, geo, fallbacks, rematch
-- ============================================================

alter table public.bookings
  add column if not exists client_name text,
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists authorized_max_minutes int,
  add column if not exists booking_context text default 'personal',
  add column if not exists emergency_attestation_signed_at timestamptz,
  add column if not exists emergency_attestation_ip inet,
  add column if not exists emergency_attestation_name text,
  add column if not exists emergency_attestation_token text,
  add column if not exists emergency_attestation_version text,
  add column if not exists emergency_fallback_charged boolean not null default false,
  add column if not exists ada_notice_acknowledged_at timestamptz,
  add column if not exists ada_notice_version text,
  add column if not exists vri_warning_acknowledged boolean not null default false,
  add column if not exists interpreter_eta_minutes int,
  add column if not exists interpreter_en_route_at timestamptz,
  add column if not exists interpreter_arrived_at timestamptz,
  add column if not exists interpreter_accepted_at timestamptz,
  add column if not exists interpreter_declined_at timestamptz,
  add column if not exists interpreter_decline_reason text,
  add column if not exists interpreter_preferences_snapshot jsonb,
  add column if not exists specialization_other_description text,
  add column if not exists rematch_count int not null default 0,
  add column if not exists fallback_option_chosen text;

do $$ begin
  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'bookings_booking_context_check'
  ) then
    alter table public.bookings add constraint bookings_booking_context_check
      check (booking_context in ('personal', 'emergency', 'business'));
  end if;

  if not exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'bookings_fallback_option_check'
  ) then
    alter table public.bookings add constraint bookings_fallback_option_check
      check (fallback_option_chosen is null or fallback_option_chosen in ('wait', 'vri', 'reschedule', 'cancel'));
  end if;
end $$;

-- Expand status check to include pending_business_approval
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in (
    'pending', 'pending_business_approval', 'matching', 'offered', 'confirmed',
    'interpreter_en_route', 'in_progress', 'completed', 'billed',
    'cancelled', 'no_match', 'disputed'
  ));

-- ============================================================
-- 2. INTERPRETER PROFILES: profile fields, preferences, payout, priority
-- ============================================================

alter table public.interpreter_profiles
  add column if not exists profile_photo_url text,
  add column if not exists intro_video_url text,
  add column if not exists intro_video_caption_url text,
  add column if not exists intro_video_transcript text,
  add column if not exists headline text,
  add column if not exists gender text,
  add column if not exists pronouns text,
  add column if not exists skills text[] not null default '{}',
  add column if not exists languages text[] not null default '{asl}',
  add column if not exists priority_score decimal(6,2) not null default 0,
  add column if not exists payout_frequency text default 'per_job',
  add column if not exists current_pay_period_cents bigint not null default 0,
  add column if not exists current_pay_period_start date,
  add column if not exists is_accepting_offers boolean not null default true,
  add column if not exists no_show_count int not null default 0,
  add column if not exists completion_rate decimal(5,4) not null default 1.0;

do $$ begin
  if not exists (select 1 from information_schema.check_constraints where constraint_name = 'interp_gender_check') then
    alter table public.interpreter_profiles add constraint interp_gender_check
      check (gender is null or gender in ('female', 'male', 'non_binary', 'prefer_not_to_say'));
  end if;

  if not exists (select 1 from information_schema.check_constraints where constraint_name = 'interp_payout_freq_check') then
    alter table public.interpreter_profiles add constraint interp_payout_freq_check
      check (payout_frequency in ('per_job', 'weekly', 'biweekly'));
  end if;
end $$;

-- ============================================================
-- 3. CERTIFICATIONS: expanded categories, "Other" description
-- ============================================================

alter table public.certifications
  add column if not exists cert_category text,
  add column if not exists cert_other_description text;

do $$ begin
  if not exists (select 1 from information_schema.check_constraints where constraint_name = 'cert_category_check') then
    alter table public.certifications add constraint cert_category_check
      check (cert_category is null or cert_category in (
        'general', 'medical', 'legal', 'educational', 'mental_health',
        'deaf_interpreter', 'trilingual', 'deaf_blind', 'oral_transliterator',
        'religious', 'performing_arts', 'cart_captioning', 'pediatric', 'other'
      ));
  end if;
end $$;

-- ============================================================
-- 4. DEAF USER PREFERENCES
-- ============================================================

create table if not exists public.deaf_user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_gender text[] not null default '{}',
  preferred_specializations text[] not null default '{}',
  preferred_interpreter_ids uuid[] not null default '{}',
  blocked_interpreter_ids uuid[] not null default '{}',
  prefers_location_type text default 'no_preference'
    check (prefers_location_type in ('in_person', 'vri', 'no_preference')),
  notify_email boolean not null default true,
  notify_sms boolean not null default false,
  notify_push boolean not null default true,
  intro_video_url text,
  intro_video_caption_url text,
  intro_video_transcript text,
  hide_pricing_for_business boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.deaf_user_preferences enable row level security;

drop policy if exists "Users manage own preferences" on public.deaf_user_preferences;
create policy "Users manage own preferences"
  on public.deaf_user_preferences for all
  using (auth.uid() = user_id);

drop policy if exists "Interpreters read preferences for matching" on public.deaf_user_preferences;
create policy "Interpreters read preferences for matching"
  on public.deaf_user_preferences for select
  using (auth.uid() is not null);

-- ============================================================
-- 5. CHAT MESSAGES
-- ============================================================

create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_booking on public.chat_messages(booking_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Booking participants read chat" on public.chat_messages;
create policy "Booking participants read chat"
  on public.chat_messages for select
  using (
    booking_id in (
      select id from public.bookings
      where deaf_user_id = auth.uid()
         or requested_by = auth.uid()
         or interpreter_id in (select id from public.interpreter_profiles where user_id = auth.uid())
         or organization_id in (select org_id from public.organization_members where user_id = auth.uid())
    )
  );

drop policy if exists "Booking participants send chat" on public.chat_messages;
create policy "Booking participants send chat"
  on public.chat_messages for insert
  with check (
    auth.uid() = sender_id
    and booking_id in (
      select id from public.bookings
      where deaf_user_id = auth.uid()
         or requested_by = auth.uid()
         or interpreter_id in (select id from public.interpreter_profiles where user_id = auth.uid())
         or organization_id in (select org_id from public.organization_members where user_id = auth.uid())
    )
  );

-- ============================================================
-- 6. INTERPRETER LIVE LOCATIONS (geo-locator, #13)
-- ============================================================

create table if not exists public.interpreter_locations (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  interpreter_id uuid not null references public.interpreter_profiles(id) on delete cascade,
  lat decimal(10,7) not null,
  lng decimal(10,7) not null,
  eta_minutes int,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_interpreter_loc_booking on public.interpreter_locations(booking_id, recorded_at desc);

alter table public.interpreter_locations enable row level security;

drop policy if exists "Deaf user sees live location" on public.interpreter_locations;
create policy "Deaf user sees live location"
  on public.interpreter_locations for select
  using (
    booking_id in (select id from public.bookings where deaf_user_id = auth.uid())
  );

drop policy if exists "Interpreter pushes own location" on public.interpreter_locations;
create policy "Interpreter pushes own location"
  on public.interpreter_locations for insert
  with check (
    interpreter_id in (select id from public.interpreter_profiles where user_id = auth.uid())
  );

-- ============================================================
-- 7. RATINGS: add tags, video feedback, would_rebook
-- ============================================================

alter table public.ratings
  add column if not exists video_feedback_url text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists would_rebook boolean;

-- ============================================================
-- 8. NOTIFICATION DELIVERIES (audit + webhook receipts)
-- ============================================================

create table if not exists public.notification_deliveries (
  id uuid primary key default uuid_generate_v4(),
  notification_id uuid references public.notifications(id) on delete cascade,
  user_id uuid references public.profiles(id),
  channel text not null check (channel in ('email', 'sms', 'push', 'in_app')),
  provider text,
  provider_message_id text,
  status text not null check (status in ('queued', 'sent', 'delivered', 'failed', 'bounced')),
  error text,
  sent_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_notif_delivery_notif on public.notification_deliveries(notification_id);
create index if not exists idx_notif_delivery_provider_msg on public.notification_deliveries(provider_message_id);

alter table public.notification_deliveries enable row level security;

-- ============================================================
-- 9. BUSINESS REGISTRATION REQUESTS
-- Referenced in /api/business-requests route; ensure table exists.
-- ============================================================

create table if not exists public.business_registration_requests (
  id uuid primary key default uuid_generate_v4(),
  requested_by uuid not null references public.profiles(id),
  business_name text not null,
  business_type text,
  contact_email text,
  contact_phone text,
  address text,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'contacted', 'registered', 'declined')),
  admin_notes text,
  created_at timestamptz not null default now()
);

alter table public.business_registration_requests
  add column if not exists address text;

alter table public.business_registration_requests enable row level security;

drop policy if exists "Users see own requests" on public.business_registration_requests;
create policy "Users see own requests"
  on public.business_registration_requests for select
  using (auth.uid() = requested_by);

drop policy if exists "Users create requests" on public.business_registration_requests;
create policy "Users create requests"
  on public.business_registration_requests for insert
  with check (auth.uid() = requested_by);

-- ============================================================
-- 10. ORGANIZATIONS: default_session_minutes, ada_acknowledged_at
-- Referenced in book page (default_session_minutes) and ADA flow
-- ============================================================

alter table public.organizations
  add column if not exists default_session_minutes int default 120,
  add column if not exists ada_acknowledged_at timestamptz,
  add column if not exists ada_acknowledged_by uuid references public.profiles(id),
  add column if not exists ada_acknowledged_version text;

-- ============================================================
-- 11. PROFILES: phone already exists; ensure
-- ============================================================

alter table public.profiles
  add column if not exists phone text;

-- ============================================================
-- 12. REALTIME PUBLICATIONS (enable for chat + location)
-- ============================================================

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'interpreter_locations'
  ) then
    alter publication supabase_realtime add table public.interpreter_locations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when others then null;  -- publication may not exist in non-Supabase environments
end $$;

-- ============================================================
-- 13. UPDATED_AT TRIGGERS for new tables
-- ============================================================

drop trigger if exists deaf_user_preferences_updated_at on public.deaf_user_preferences;
create trigger deaf_user_preferences_updated_at
  before update on public.deaf_user_preferences
  for each row execute function public.update_updated_at();
