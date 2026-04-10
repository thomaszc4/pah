-- ============================================================
-- PAH — Diagnostic queries
-- ============================================================
-- Run these in the Supabase SQL editor if something looks wrong.
-- They bypass RLS (SQL editor runs as postgres role), so they
-- show the ground truth in the database regardless of policies.
-- ============================================================

-- 1. Confirm Riverside admin IS a member of Riverside Medical Group.
--    Expected: one row, Lisa Chen / owner / Riverside Medical Group.
select
  p.email,
  p.full_name,
  p.roles as profile_roles,
  om.role as org_role,
  o.name as org_name,
  o.payment_method_on_file
from public.organization_members om
join public.organizations o on o.id = om.org_id
join public.profiles p on p.id = om.user_id
where p.email = 'admin@riverside-medical.demo';

-- 2. Confirm Maya's bookings by status.
--    Expected: confirmed (Riverside, +2d), in_progress (Children's
--    Hospital), completed x0, cancelled (Metro Courts).
select
  b.id,
  b.status,
  b.scheduled_start,
  b.specialization_required,
  o.name as org,
  ip.id as interp_profile_id,
  ip_profile.full_name as interpreter
from public.bookings b
left join public.organizations o on o.id = b.organization_id
left join public.interpreter_profiles ip on ip.id = b.interpreter_id
left join public.profiles ip_profile on ip_profile.id = ip.user_id
where b.deaf_user_id = '11111111-0000-0000-0000-000000000001'
order by b.scheduled_start;

-- 3. Count everything, quick sanity check.
select 'profiles' as tbl, count(*) from public.profiles
union all select 'interpreter_profiles', count(*) from public.interpreter_profiles
union all select 'certifications', count(*) from public.certifications
union all select 'organizations', count(*) from public.organizations
union all select 'organization_members', count(*) from public.organization_members
union all select 'bookings', count(*) from public.bookings
union all select 'ratings', count(*) from public.ratings;

-- 4. Test the RLS helper as a specific user. Run this in the
--    SQL editor AFTER applying 001_rls_recursion_fix.sql.
--    Uncomment and substitute the user's UUID to simulate them.
-- set local role authenticated;
-- set local request.jwt.claims to '{"sub":"33333333-0000-0000-0000-000000000001","role":"authenticated"}';
-- select public.current_user_org_ids();  -- should return Riverside's uuid
-- select * from public.organization_members;  -- should return 1 row
-- select * from public.organizations;  -- should return 1 row
-- reset role;
