-- ============================================================
-- PAH — Demo seed data
-- ============================================================
-- Populates ~20 interpreters, 8 organizations, 5 Deaf users,
-- plus sample certifications and bookings in various states.
--
-- All demo accounts use password: "password123"
-- Run AFTER 001_initial_schema.sql.
--
-- This file is idempotent-ish: it skips rows whose UUID already
-- exists (via ON CONFLICT), so it's safe to re-run during the
-- demo cycle. Do NOT run in production.
-- ============================================================

-- Temporarily disable the handle_new_user trigger so we can
-- insert profiles manually with deterministic UUIDs + extra fields.
alter table auth.users disable trigger on_auth_user_created;

-- ------------------------------------------------------------
-- Helper: shared bcrypt hash for "password123"
-- ------------------------------------------------------------
-- Generated once: crypt('password123', gen_salt('bf'))
-- Using a fixed hash keeps the seed deterministic.
do $$
declare
  pw_hash text := crypt('password123', gen_salt('bf'));
begin
  perform set_config('seed.pw_hash', pw_hash, false);
end $$;

-- ============================================================
-- 1. AUTH USERS + PROFILES
-- ============================================================
-- We insert into auth.users first (needed for FK), then profiles.
-- The auth.users INSERT uses raw_user_meta_data so that if you
-- ever re-enable the trigger, it still works.

-- ---- Deaf users ----
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maya.deaf@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Maya Rodriguez","role":"deaf_user"}', now(), now(), '', '', '', ''),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jordan.deaf@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jordan Park","role":"deaf_user"}', now(), now(), '', '', '', ''),
  ('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya.deaf@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Priya Shah","role":"deaf_user"}', now(), now(), '', '', '', ''),
  ('11111111-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'andre.deaf@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Andre Williams","role":"deaf_user"}', now(), now(), '', '', '', ''),
  ('11111111-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam.deaf@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sam Nguyen","role":"deaf_user"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- ---- Interpreter users (20) ----
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah.chen@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah Chen","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marcus.johnson@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcus Johnson","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'elena.ramirez@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Elena Ramirez","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'david.kim@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"David Kim","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rachel.oconnor@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rachel O''Connor","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'james.thompson@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"James Thompson","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aisha.patel@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Aisha Patel","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'brian.mitchell@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Brian Mitchell","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'natalie.brooks@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Natalie Brooks","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carlos.vega@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Carlos Vega","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hannah.wells@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Hannah Wells","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'derek.washington@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Derek Washington","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'olivia.martinez@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Olivia Martinez","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tyler.bennett@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tyler Bennett","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'grace.liu@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Grace Liu","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marcus.olson@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcus Olson","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jasmine.wright@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jasmine Wright","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ethan.carter@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ethan Carter","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sophia.reyes@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sophia Reyes","role":"interpreter"}', now(), now(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'miguel.santos@pah.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Miguel Santos","role":"interpreter"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- ---- Business admin users (one per org) ----
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@riverside-medical.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lisa Chen","role":"business_admin"}', now(), now(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@cedar-legal.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Michael Harris","role":"business_admin"}', now(), now(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@summit-university.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jennifer Adams","role":"business_admin"}', now(), now(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@harbor-mental.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Robert Foster","role":"business_admin"}', now(), now(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@metro-courts.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Angela Davis","role":"business_admin"}', now(), now(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@childrens-hospital.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Thomas Reed","role":"business_admin"}', now(), now(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@oakwood-school.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Patricia Lee","role":"business_admin"}', now(), now(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@northside-clinic.demo', current_setting('seed.pw_hash'), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Kevin Wong","role":"business_admin"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- ============================================================
-- 2. PROFILES (manually, since we disabled the trigger)
-- ============================================================
insert into public.profiles (id, email, full_name, roles, phone)
select u.id, u.email, u.raw_user_meta_data->>'full_name',
  array[u.raw_user_meta_data->>'role'],
  '555-' || lpad((row_number() over (order by u.id))::text, 4, '0')
from auth.users u
where u.email like '%@pah.demo' or u.email like '%.demo'
on conflict (id) do nothing;

-- ============================================================
-- 3. INTERPRETER PROFILES
-- ============================================================
insert into public.interpreter_profiles (id, user_id, bio, years_experience, experience_tier, hourly_rate_cents, specializations, certifications_verified, service_radius_miles, is_available, avg_rating, total_jobs, total_earnings_cents, stripe_onboarding_complete)
values
  ('a0000000-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'RID NIC-certified interpreter with 12 years of medical and legal experience. Specializing in complex medical appointments.', 12, 'expert', 7200, '{medical,legal,general}', true, 30, true, 4.9, 247, 18420000, true),
  ('a0000000-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'CDI with deep roots in the Deaf community. 8 years of experience in educational and mental health settings.', 8, 'advanced', 6200, '{educational,mental_health,general}', true, 25, true, 4.8, 183, 11200000, true),
  ('a0000000-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003', 'Bilingual (Spanish/English/ASL) trilingual interpreter. NIC Advanced, focused on legal proceedings.', 15, 'expert', 7200, '{legal,general}', true, 40, true, 5.0, 312, 22500000, true),
  ('a0000000-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000004', 'Medical specialist with CCHI certification. Former hospital staff interpreter, now independent.', 10, 'advanced', 6200, '{medical,general}', true, 20, true, 4.7, 156, 9650000, true),
  ('a0000000-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000005', 'K-12 and university interpreter. EIPA 4.5. Passionate about accessible education.', 6, 'certified', 5200, '{educational,general}', true, 35, true, 4.6, 98, 5100000, true),
  ('a0000000-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000006', 'NIC Master with 20+ years in legal interpreting. Available for courtroom, depositions, and attorney meetings.', 22, 'expert', 7200, '{legal,general}', true, 50, true, 5.0, 421, 31800000, true),
  ('a0000000-0000-0000-0000-000000000007', '22222222-0000-0000-0000-000000000007', 'Medical interpreter with strong mental health background. Gentle, patient-centered approach.', 7, 'certified', 5200, '{medical,mental_health,general}', true, 25, true, 4.8, 134, 6980000, true),
  ('a0000000-0000-0000-0000-000000000008', '22222222-0000-0000-0000-000000000008', 'Generalist interpreter for community events, conferences, and business meetings. BEI Advanced.', 5, 'certified', 5200, '{general}', true, 40, true, 4.5, 87, 4200000, true),
  ('a0000000-0000-0000-0000-000000000009', '22222222-0000-0000-0000-000000000009', 'New to the platform but 4 years of freelance experience in Texas. NIC certified.', 4, 'certified', 5200, '{general,educational}', true, 20, true, 4.4, 42, 2100000, false),
  ('a0000000-0000-0000-0000-000000000010', '22222222-0000-0000-0000-000000000010', 'Legal and medical interpreter, NIC Master. Former federal courtroom interpreter.', 18, 'expert', 7200, '{legal,medical,general}', true, 60, true, 4.9, 289, 20300000, true),
  ('a0000000-0000-0000-0000-000000000011', '22222222-0000-0000-0000-000000000011', 'Community interpreter specializing in mental health and social services. LMSW+ASL dual credential.', 9, 'advanced', 6200, '{mental_health,general}', true, 25, true, 4.7, 165, 10100000, true),
  ('a0000000-0000-0000-0000-000000000012', '22222222-0000-0000-0000-000000000012', 'DI (Deaf Interpreter) + CDI certified. Specializing in complex linguistic situations and Deaf-Blind work.', 11, 'expert', 7200, '{general,legal,medical}', true, 30, true, 5.0, 198, 14200000, true),
  ('a0000000-0000-0000-0000-000000000013', '22222222-0000-0000-0000-000000000013', 'Recent graduate of interpreter training program. NIC certified last year. Eager and professional.', 2, 'provisional', 4200, '{general}', true, 15, true, 4.6, 28, 1100000, false),
  ('a0000000-0000-0000-0000-000000000014', '22222222-0000-0000-0000-000000000014', 'Medical interpreter with 13 years at a major teaching hospital. RID CDI and NIC Advanced.', 13, 'advanced', 6200, '{medical,general}', true, 25, true, 4.8, 221, 13800000, true),
  ('a0000000-0000-0000-0000-000000000015', '22222222-0000-0000-0000-000000000015', 'Conference and corporate interpreter. Comfortable with technical and business vocabulary.', 8, 'advanced', 6200, '{general}', true, 35, true, 4.7, 142, 8900000, true),
  ('a0000000-0000-0000-0000-000000000016', '22222222-0000-0000-0000-000000000016', 'Educational interpreter for deaf university students. Deep content knowledge in STEM fields.', 7, 'certified', 5200, '{educational,general}', true, 20, true, 4.5, 112, 5600000, true),
  ('a0000000-0000-0000-0000-000000000017', '22222222-0000-0000-0000-000000000017', 'Faith-based and community interpreter. Also skilled in medical and legal settings. NIC NIC.', 9, 'advanced', 6200, '{general,medical}', true, 25, true, 4.8, 176, 10900000, true),
  ('a0000000-0000-0000-0000-000000000018', '22222222-0000-0000-0000-000000000018', 'BEI Master. 14 years of courtroom and attorney-client privilege work.', 14, 'expert', 7200, '{legal,general}', true, 40, true, 4.9, 234, 16700000, true),
  ('a0000000-0000-0000-0000-000000000019', '22222222-0000-0000-0000-000000000019', 'Bilingual ASL/Spanish interpreter. Community, medical, and educational settings.', 6, 'certified', 5200, '{medical,educational,general}', true, 20, true, 4.6, 103, 5300000, true),
  ('a0000000-0000-0000-0000-000000000020', '22222222-0000-0000-0000-000000000020', 'New interpreter, 3 years experience. NIC certified. Building specialization in medical.', 3, 'provisional', 4200, '{medical,general}', true, 15, true, 4.3, 51, 2200000, false)
on conflict (id) do nothing;

-- ============================================================
-- 4. CERTIFICATIONS (representative sample)
-- ============================================================
insert into public.certifications (interpreter_id, cert_type, cert_number, verification_status, verified_at)
values
  ('a0000000-0000-0000-0000-000000000001', 'RID_NIC_ADVANCED', 'NIC-10234', 'verified', now() - interval '60 days'),
  ('a0000000-0000-0000-0000-000000000001', 'CCHI_CORE', 'CCHI-5581', 'verified', now() - interval '60 days'),
  ('a0000000-0000-0000-0000-000000000002', 'RID_CDI', 'CDI-2201', 'verified', now() - interval '90 days'),
  ('a0000000-0000-0000-0000-000000000003', 'RID_NIC_MASTER', 'NIC-M-0912', 'verified', now() - interval '45 days'),
  ('a0000000-0000-0000-0000-000000000004', 'CCHI_PERFORMANCE', 'CCHI-P-4401', 'verified', now() - interval '30 days'),
  ('a0000000-0000-0000-0000-000000000004', 'NBCMI_CMI', 'NBCMI-7711', 'verified', now() - interval '30 days'),
  ('a0000000-0000-0000-0000-000000000005', 'RID_NIC', 'NIC-8823', 'verified', now() - interval '100 days'),
  ('a0000000-0000-0000-0000-000000000006', 'RID_NIC_MASTER', 'NIC-M-0081', 'verified', now() - interval '180 days'),
  ('a0000000-0000-0000-0000-000000000007', 'RID_NIC', 'NIC-6612', 'verified', now() - interval '75 days'),
  ('a0000000-0000-0000-0000-000000000008', 'BEI_ADVANCED', 'BEI-A-3301', 'verified', now() - interval '50 days'),
  ('a0000000-0000-0000-0000-000000000009', 'RID_NIC', 'NIC-9912', 'verified', now() - interval '20 days'),
  ('a0000000-0000-0000-0000-000000000010', 'RID_NIC_MASTER', 'NIC-M-0451', 'verified', now() - interval '150 days'),
  ('a0000000-0000-0000-0000-000000000011', 'RID_NIC_ADVANCED', 'NIC-A-5532', 'verified', now() - interval '85 days'),
  ('a0000000-0000-0000-0000-000000000012', 'RID_CDI', 'CDI-1109', 'verified', now() - interval '120 days'),
  ('a0000000-0000-0000-0000-000000000013', 'RID_NIC', 'NIC-1201', 'verified', now() - interval '15 days'),
  ('a0000000-0000-0000-0000-000000000014', 'RID_NIC_ADVANCED', 'NIC-A-2233', 'verified', now() - interval '95 days'),
  ('a0000000-0000-0000-0000-000000000015', 'RID_NIC_ADVANCED', 'NIC-A-7789', 'verified', now() - interval '70 days'),
  ('a0000000-0000-0000-0000-000000000018', 'BEI_MASTER', 'BEI-M-0912', 'verified', now() - interval '110 days'),
  ('a0000000-0000-0000-0000-000000000020', 'RID_NIC', 'NIC-4412', 'verified', now() - interval '25 days')
on conflict do nothing;

-- ============================================================
-- 5. ORGANIZATIONS
-- ============================================================
insert into public.organizations (id, name, org_type, address_line1, city, state, zip, phone, email, payment_method_on_file, hipaa_baa_signed)
values
  ('b0000000-0000-0000-0000-000000000001', 'Riverside Medical Group', 'medical', '1245 Riverside Dr', 'Austin', 'TX', '78703', '(512) 555-0101', 'admin@riverside-medical.demo', true, true),
  ('b0000000-0000-0000-0000-000000000002', 'Cedar & Associates Legal', 'legal', '880 Congress Ave', 'Austin', 'TX', '78701', '(512) 555-0102', 'admin@cedar-legal.demo', true, false),
  ('b0000000-0000-0000-0000-000000000003', 'Summit University — Disability Services', 'educational', '2200 University Blvd', 'Austin', 'TX', '78712', '(512) 555-0103', 'admin@summit-university.demo', true, false),
  ('b0000000-0000-0000-0000-000000000004', 'Harbor Mental Health Clinic', 'medical', '455 Lake Austin Blvd', 'Austin', 'TX', '78703', '(512) 555-0104', 'admin@harbor-mental.demo', true, true),
  ('b0000000-0000-0000-0000-000000000005', 'Metro District Courts', 'government', '509 W 11th St', 'Austin', 'TX', '78701', '(512) 555-0105', 'admin@metro-courts.demo', false, false),
  ('b0000000-0000-0000-0000-000000000006', 'Austin Children''s Hospital', 'medical', '4900 Mueller Blvd', 'Austin', 'TX', '78723', '(512) 555-0106', 'admin@childrens-hospital.demo', true, true),
  ('b0000000-0000-0000-0000-000000000007', 'Oakwood Elementary School', 'educational', '1301 Oakwood Dr', 'Austin', 'TX', '78745', '(512) 555-0107', 'admin@oakwood-school.demo', true, false),
  ('b0000000-0000-0000-0000-000000000008', 'Northside Community Clinic', 'medical', '7501 N Lamar Blvd', 'Austin', 'TX', '78752', '(512) 555-0108', 'admin@northside-clinic.demo', false, true)
on conflict (id) do nothing;

-- ============================================================
-- 6. ORGANIZATION MEMBERS
-- ============================================================
insert into public.organization_members (org_id, user_id, role)
values
  ('b0000000-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', 'owner'),
  ('b0000000-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000003', 'owner'),
  ('b0000000-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000004', 'owner'),
  ('b0000000-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000005', 'owner'),
  ('b0000000-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000006', 'owner'),
  ('b0000000-0000-0000-0000-000000000007', '33333333-0000-0000-0000-000000000007', 'owner'),
  ('b0000000-0000-0000-0000-000000000008', '33333333-0000-0000-0000-000000000008', 'owner')
on conflict (org_id, user_id) do nothing;

-- ============================================================
-- 7. BOOKINGS (variety of states for realistic demo)
-- ============================================================
-- Confirmed upcoming bookings
insert into public.bookings (id, deaf_user_id, interpreter_id, organization_id, requested_by, booking_type, specialization_required, scheduled_start, scheduled_end, location_type, address_line1, city, state, zip, status, base_rate_cents, estimated_duration_minutes, public_notes)
values
  ('c0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'scheduled', 'medical', now() + interval '2 days', now() + interval '2 days 2 hours', 'in_person', '1245 Riverside Dr', 'Austin', 'TX', '78703', 'confirmed', 8500, 120, 'Annual physical at Dr. Martin''s office.'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'scheduled', 'legal', now() + interval '5 days', now() + interval '5 days 3 hours', 'in_person', '880 Congress Ave', 'Austin', 'TX', '78701', 'confirmed', 8500, 180, 'Deposition prep meeting with attorney.'),
  ('c0000000-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', 'scheduled', 'educational', now() + interval '1 day', now() + interval '1 day 2 hours', 'in_person', '2200 University Blvd', 'Austin', 'TX', '78712', 'confirmed', 8500, 120, 'Graduate seminar, topic: cognitive neuroscience.'),
  ('c0000000-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000004', 'scheduled', 'mental_health', now() + interval '3 days', now() + interval '3 days 1 hour', 'in_person', '455 Lake Austin Blvd', 'Austin', 'TX', '78703', 'confirmed', 8500, 60, 'Therapy session, recurring weekly.'),
  -- Matching (awaiting interpreter)
  ('c0000000-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000005', null, null, '11111111-0000-0000-0000-000000000005', 'scheduled', 'general', now() + interval '7 days', now() + interval '7 days 2 hours', 'in_person', '100 Community Center Dr', 'Austin', 'TX', '78704', 'matching', 8500, 120, 'Community meeting.'),
  -- In progress
  ('c0000000-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000001', 'scheduled', 'medical', now() - interval '30 minutes', now() + interval '90 minutes', 'in_person', '4900 Mueller Blvd', 'Austin', 'TX', '78723', 'in_progress', 8500, 120, 'Pediatric specialist appointment.'),
  -- Completed/billed with payouts
  ('c0000000-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'scheduled', 'medical', now() - interval '7 days', now() - interval '7 days' + interval '2 hours', 'in_person', '1245 Riverside Dr', 'Austin', 'TX', '78703', 'completed', 8500, 120, ''),
  ('c0000000-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'scheduled', 'legal', now() - interval '14 days', now() - interval '14 days' + interval '4 hours', 'in_person', '880 Congress Ave', 'Austin', 'TX', '78701', 'billed', 8500, 240, ''),
  ('c0000000-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000004', 'scheduled', 'mental_health', now() - interval '10 days', now() - interval '10 days' + interval '1 hour', 'in_person', '455 Lake Austin Blvd', 'Austin', 'TX', '78703', 'completed', 8500, 60, ''),
  ('c0000000-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000008', null, '11111111-0000-0000-0000-000000000005', 'scheduled', 'general', now() - interval '21 days', now() - interval '21 days' + interval '2 hours', 'vri', null, null, null, null, 'completed', 5500, 120, ''),
  -- Cancelled
  ('c0000000-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000001', null, 'b0000000-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', 'scheduled', 'legal', now() - interval '4 days', now() - interval '4 days' + interval '2 hours', 'in_person', '509 W 11th St', 'Austin', 'TX', '78701', 'cancelled', 8500, 120, 'Rescheduled by court.')
on conflict (id) do nothing;

-- Update completed bookings with actual durations + payouts
update public.bookings set
  actual_start = scheduled_start,
  actual_end = scheduled_end,
  actual_duration_minutes = estimated_duration_minutes,
  total_charge_cents = (estimated_duration_minutes * base_rate_cents / 60),
  interpreter_payout_cents = (estimated_duration_minutes * base_rate_cents / 60) * 70 / 100,
  platform_fee_cents = (estimated_duration_minutes * base_rate_cents / 60) * 30 / 100,
  payment_status = 'transferred'
where status in ('completed', 'billed')
  and actual_duration_minutes is null;

-- ============================================================
-- 8. SAMPLE RATINGS
-- ============================================================
insert into public.ratings (booking_id, rated_by, rated_user, rating, review_text)
values
  ('c0000000-0000-0000-0000-000000000007', '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 5, 'Sarah was fantastic. Clear, professional, and made the whole appointment feel easy.'),
  ('c0000000-0000-0000-0000-000000000008', '11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000003', 5, 'Elena is the best legal interpreter I''ve ever worked with. Highly recommend.'),
  ('c0000000-0000-0000-0000-000000000009', '11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000011', 5, 'Hannah made me feel safe and understood during a difficult session.'),
  ('c0000000-0000-0000-0000-000000000010', '11111111-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000008', 4, 'Good interpretation, VRI connection was a bit spotty but Brian handled it well.')
on conflict (booking_id, rated_by) do nothing;

-- ============================================================
-- Re-enable the trigger so real signups work normally
-- ============================================================
alter table auth.users enable trigger on_auth_user_created;

-- ============================================================
-- Demo login credentials summary
-- ============================================================
-- Password for all demo accounts: password123
--
-- Deaf users:
--   maya.deaf@pah.demo / jordan.deaf@pah.demo / priya.deaf@pah.demo
--   andre.deaf@pah.demo / sam.deaf@pah.demo
--
-- Interpreters (20):
--   sarah.chen@pah.demo  (expert, medical/legal, 4.9★)
--   elena.ramirez@pah.demo  (expert, legal, 5.0★)
--   james.thompson@pah.demo  (expert, legal, 5.0★, 421 jobs)
--   ...and 17 more
--
-- Businesses:
--   admin@riverside-medical.demo  (medical)
--   admin@cedar-legal.demo  (legal)
--   admin@summit-university.demo  (educational)
--   admin@harbor-mental.demo  (mental health)
--   admin@metro-courts.demo  (government — no payment method)
--   admin@childrens-hospital.demo  (medical)
--   admin@oakwood-school.demo  (educational)
--   admin@northside-clinic.demo  (medical — no payment method)
