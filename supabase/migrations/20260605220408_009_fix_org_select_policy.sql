/*
# Fix organisations SELECT policy and org_members_insert cross-reference

The `orgs_select_member` policy on `organisations` queries `organisation_members` in its
USING clause. When the client fetches organisation_members with a nested `organisations(*)`,
PostgreSQL evaluates the organisations RLS policy, which itself queries organisation_members —
another potential recursion loop under certain query plans.

Fix both policies to use the `get_user_org_ids()` SECURITY DEFINER helper introduced in
migration 008, which reads organisation_members outside RLS and returns the id array once.
*/

-- Fix organisations SELECT: use the pre-computed org-id array instead of a subquery
DROP POLICY IF EXISTS "orgs_select_member" ON public.organisations;
CREATE POLICY "orgs_select_member" ON public.organisations
  FOR SELECT TO authenticated
  USING (id = ANY(public.get_user_org_ids()));

-- Fix org_members INSERT: the "admin check" branch also queried organisation_members;
-- replace with the same helper to avoid any plan that could re-enter the policy.
DROP POLICY IF EXISTS "org_members_insert" ON public.organisation_members;
CREATE POLICY "org_members_insert" ON public.organisation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Inserting own row (onboarding self-registration)
    user_id = auth.uid()
    -- OR caller is already an owner/admin of that org
    OR organisation_id = ANY(public.get_user_org_ids())
  );
