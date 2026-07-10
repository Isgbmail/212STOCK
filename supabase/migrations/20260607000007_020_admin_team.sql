/*
  Migration 020 — Admin Team & Role-Based Access
  Creates the admin_team table for platform admin role management.
  Roles: superadmin | moderator | finance_admin | support | data_viewer
*/

-- ── Admin team table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_team (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('superadmin', 'moderator', 'finance_admin', 'support', 'data_viewer')),
  granted_by  uuid        REFERENCES profiles(id),
  granted_at  timestamptz NOT NULL DEFAULT now(),
  notes       text,
  active      boolean     NOT NULL DEFAULT true,
  UNIQUE(user_id)
);

COMMENT ON TABLE  admin_team         IS 'Platform admin team members with role-based access control';
COMMENT ON COLUMN admin_team.role    IS 'superadmin=full access | moderator=content/orgs | finance_admin=financial data | support=orders+disputes | data_viewer=read-only';
COMMENT ON COLUMN admin_team.active  IS 'false = access revoked, row kept for audit trail';

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE admin_team ENABLE ROW LEVEL SECURITY;

-- All platform admins (is_admin=true) can list the team
CREATE POLICY "admin_team_select" ON admin_team FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Only active superadmins can insert new members
CREATE POLICY "admin_team_insert" ON admin_team FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_team
      WHERE user_id = auth.uid() AND role = 'superadmin' AND active = true
    )
  );

-- Only active superadmins can update roles/notes/active flag
CREATE POLICY "admin_team_update" ON admin_team FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_team
      WHERE user_id = auth.uid() AND role = 'superadmin' AND active = true
    )
  );

-- Superadmins can hard-delete (prefer soft-delete via active=false)
CREATE POLICY "admin_team_delete" ON admin_team FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_team
      WHERE user_id = auth.uid() AND role = 'superadmin' AND active = true
    )
  );

-- ── Admin can read ALL profiles (needed for user lookup when adding members) ──
-- This policy supplements any existing profile policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'admin_read_all_profiles'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT TO authenticated
        USING (
          auth.uid() = id
          OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
        );
    $policy$;
  END IF;
END $$;

-- ── Helper: to bootstrap first superadmin manually via SQL ───────────────────
-- Run in Supabase SQL Editor (replace <user-uuid> with the actual profile id):
--
--   INSERT INTO admin_team (user_id, role, notes)
--   VALUES ('<user-uuid>', 'superadmin', 'Initial superadmin — bootstrapped');
--
--   UPDATE profiles SET is_admin = true WHERE id = '<user-uuid>';
