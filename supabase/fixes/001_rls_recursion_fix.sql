-- ============================================================
-- PAH — Fix RLS recursion on organization_members & organizations
-- ============================================================
-- WHY THIS EXISTS
-- The original policy on organization_members self-references
-- the same table:
--
--   using (
--     org_id in (
--       select org_id from public.organization_members
--       where user_id = auth.uid()
--     )
--   )
--
-- The inner subquery is re-evaluated with the *same* RLS policy,
-- causing silent recursion. Net effect: nobody can see their own
-- membership row, which makes the business dashboard think the
-- logged-in admin has no org and redirect them back to onboarding.
--
-- The organizations policy transitively calls organization_members,
-- so orgs are also invisible. And the bookings policy has an
-- `organization_id IN (select ... from organization_members ...)`
-- branch that, when it errors, can prevent deaf users from seeing
-- their own bookings via the earlier `deaf_user_id = auth.uid()`
-- clause (Postgres does not guarantee OR short-circuiting in RLS).
--
-- FIX
-- 1. Add a simple, NON-recursive policy: a user can always see
--    their own membership row directly.
-- 2. Rewrite the "see my org's other members" policy as a
--    SECURITY DEFINER helper so it doesn't self-reference.
-- 3. Rewrite the organizations policy to use the helper too.
-- 4. Rewrite the bookings policy to use the helper.
--
-- Safe to re-run: each CREATE is guarded by a DROP IF EXISTS.
-- ============================================================

-- ------------------------------------------------------------
-- Helper function: list of org_ids the current user belongs to
-- SECURITY DEFINER bypasses RLS inside the function body, which
-- breaks the recursion cleanly. It's safe because it only
-- returns org_ids for the *caller's* own user_id.
-- ------------------------------------------------------------
create or replace function public.current_user_org_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id
  from public.organization_members
  where user_id = auth.uid();
$$;

revoke all on function public.current_user_org_ids() from public;
grant execute on function public.current_user_org_ids() to authenticated;

-- ------------------------------------------------------------
-- organization_members: drop the recursive policy, replace with
-- a direct "see my own row" policy + a helper-based "see other
-- members of my orgs" policy.
-- ------------------------------------------------------------
drop policy if exists "Members can view their org members" on public.organization_members;
drop policy if exists "Users can view own membership" on public.organization_members;
drop policy if exists "Members can view teammates" on public.organization_members;

create policy "Users can view own membership"
  on public.organization_members for select
  using (user_id = auth.uid());

create policy "Members can view teammates"
  on public.organization_members for select
  using (org_id in (select public.current_user_org_ids()));

-- ------------------------------------------------------------
-- organizations: rewrite "Org members can view their org"
-- to use the helper instead of a direct subquery.
-- ------------------------------------------------------------
drop policy if exists "Org members can view their org" on public.organizations;
drop policy if exists "Org owners/admins can update" on public.organizations;

create policy "Org members can view their org"
  on public.organizations for select
  using (id in (select public.current_user_org_ids()));

-- Owners/admins update policy — we still need to check the role,
-- but can do it without triggering recursion by using the helper
-- on the id match and a separate direct check on role.
create policy "Org owners/admins can update"
  on public.organizations for update
  using (
    id in (
      select om.org_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );
-- Note: this subquery is NOT recursive because it reads
-- organization_members, which now has a non-recursive "own row"
-- policy that will match on user_id = auth.uid().

-- ------------------------------------------------------------
-- bookings: rewrite the view policy so the org branch uses the
-- helper function. This prevents the recursive subquery from
-- poisoning the whole OR expression.
-- ------------------------------------------------------------
drop policy if exists "Users can view their bookings" on public.bookings;
drop policy if exists "Involved parties can update bookings" on public.bookings;

create policy "Users can view their bookings"
  on public.bookings for select
  using (
    auth.uid() = deaf_user_id
    or auth.uid() = requested_by
    or interpreter_id in (
      select id from public.interpreter_profiles where user_id = auth.uid()
    )
    or organization_id in (select public.current_user_org_ids())
  );

create policy "Involved parties can update bookings"
  on public.bookings for update
  using (
    auth.uid() = deaf_user_id
    or auth.uid() = requested_by
    or interpreter_id in (
      select id from public.interpreter_profiles where user_id = auth.uid()
    )
    or organization_id in (select public.current_user_org_ids())
  );

-- ============================================================
-- Done. After running, verify with:
--   select * from public.organization_members;  -- should return
--     the caller's membership row(s)
--   select * from public.organizations;         -- should return
--     only the caller's orgs
-- ============================================================
