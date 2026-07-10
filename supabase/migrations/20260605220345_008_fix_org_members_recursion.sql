/*
# Fix infinite recursion in organisation_members SELECT policy

The original SELECT policy used EXISTS (SELECT 1 FROM organisation_members om2 ...)
inside a policy ON organisation_members, causing PostgreSQL to infinitely recurse.

Fix: use a SECURITY DEFINER helper function that bypasses RLS to check membership,
breaking the recursion. The function checks only by user_id so it is safe to expose.
*/

-- Helper function: returns the set of organisation_ids the calling user belongs to.
-- SECURITY DEFINER + fixed search_path so it bypasses RLS without exposing other data.
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT array_agg(organisation_id)
  FROM public.organisation_members
  WHERE user_id = auth.uid()
    AND active = true;
$$;

-- Revoke direct RPC access — this is an internal helper only
REVOKE EXECUTE ON FUNCTION public.get_user_org_ids() FROM anon;

-- Rewrite the SELECT policy using the helper to avoid self-referential recursion
DROP POLICY IF EXISTS "org_members_select" ON public.organisation_members;
CREATE POLICY "org_members_select" ON public.organisation_members
  FOR SELECT TO authenticated
  USING (
    -- user sees their own rows, or rows for orgs they belong to
    user_id = auth.uid()
    OR organisation_id = ANY(public.get_user_org_ids())
  );
