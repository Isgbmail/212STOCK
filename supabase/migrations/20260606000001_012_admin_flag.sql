/*
# Migration 12: Admin flag on profiles

Adds is_admin boolean to profiles table.
Platform admins can be promoted via SQL or the Supabase dashboard.
RLS: only the user can read their own profile (existing policy),
admin write requires service_role key (done outside RLS).
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
