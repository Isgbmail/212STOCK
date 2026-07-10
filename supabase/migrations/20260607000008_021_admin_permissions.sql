/*
  Migration 021 — Admin Team Custom Permissions
  Adds a JSONB column to store per-member permission overrides on top of role defaults.
  Format: { "orders.cancel": true, "settings.edit": false }
  Missing key = inherited from role default.
*/

ALTER TABLE admin_team
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN admin_team.permissions IS
  'Per-user permission overrides. Keys are permission codes, values are true (granted) or false (denied). Missing key = inherited from role default.';
