-- Fix: récursion infinie sur la policy admin_read_all_profiles
-- Cause : la policy interrogeait profiles depuis une policy sur profiles elle-même.
-- Impact : bloquait aussi en cascade toutes les vérifications admin sur d'autres
-- tables (orders, disputes, admin_team, module marketing...) qui dépendent
-- de is_admin.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'pg_temp'
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

DROP POLICY IF EXISTS admin_read_all_profiles ON profiles;

CREATE POLICY admin_read_all_profiles ON profiles
FOR SELECT
USING (auth.uid() = id OR public.is_current_user_admin());