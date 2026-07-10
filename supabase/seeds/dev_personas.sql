-- ─── Seed : personas de développement ────────────────────────────────────────
-- À exécuter UNE SEULE FOIS via le SQL Editor Supabase (pas une migration).
-- Crée 4 comptes dev qui permettent au DevAuthContext de s'authentifier
-- avec de vrais JWT → RLS / get_user_org_ids() fonctionnent.
--
-- IDs fixes qui correspondent exactement à DevAuthContext.tsx :
--   admin    00000000-0000-0000-0000-100000000001 / org 200000000001
--   seller   00000000-0000-0000-0000-100000000002 / org 200000000002
--   buyer    00000000-0000-0000-0000-100000000003 / org 200000000003
--   delivery 00000000-0000-0000-0000-100000000004 / org 200000000004
--
-- Mot de passe commun : DevStock212!

-- ─── 1. auth.users ────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, is_sso_user, deleted_at
)
VALUES
  (
    '00000000-0000-0000-0000-100000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'dev-admin@stock212.dev',
    crypt('DevStock212!', gen_salt('bf', 10)),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Dev"}'::jsonb,
    false, false, null
  ),
  (
    '00000000-0000-0000-0000-100000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'dev-seller@stock212.dev',
    crypt('DevStock212!', gen_salt('bf', 10)),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Vendeur Dev"}'::jsonb,
    false, false, null
  ),
  (
    '00000000-0000-0000-0000-100000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'dev-buyer@stock212.dev',
    crypt('DevStock212!', gen_salt('bf', 10)),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Acheteur Dev"}'::jsonb,
    false, false, null
  ),
  (
    '00000000-0000-0000-0000-100000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'dev-delivery@stock212.dev',
    crypt('DevStock212!', gen_salt('bf', 10)),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Livreur Dev"}'::jsonb,
    false, false, null
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 2. profiles ──────────────────────────────────────────────────────────────
INSERT INTO profiles (
  id, full_name, preferred_lang, preferred_currency,
  gdpr_consent, onboarding_done, is_admin, created_at
)
VALUES
  ('00000000-0000-0000-0000-100000000001', 'Admin Dev',    'fr', 'MAD', true, true, true,  now()),
  ('00000000-0000-0000-0000-100000000002', 'Vendeur Dev',  'fr', 'MAD', true, true, false, now()),
  ('00000000-0000-0000-0000-100000000003', 'Acheteur Dev', 'fr', 'MAD', true, true, false, now()),
  ('00000000-0000-0000-0000-100000000004', 'Livreur Dev',  'fr', 'MAD', true, true, false, now())
ON CONFLICT (id) DO NOTHING;

-- ─── 3. organisations ─────────────────────────────────────────────────────────
INSERT INTO organisations (
  id, name, org_type, country, address_line1, city, postal_code,
  validation_status, created_at
)
VALUES
  ('00000000-0000-0000-0000-200000000001', 'Stock212 Admin',   'buyer',    'MA', 'Casablanca',         'Casablanca', null,    'active', now()),
  ('00000000-0000-0000-0000-200000000002', 'Casablanca Foods', 'seller',   'MA', '12 Avenue Hassan II','Casablanca', '20000', 'active', now()),
  ('00000000-0000-0000-0000-200000000003', 'Hyper Atlas',      'buyer',    'MA', '5 Rue Ibn Battouta', 'Rabat',      '10000', 'active', now()),
  ('00000000-0000-0000-0000-200000000004', 'Express Livraison','delivery', 'MA', '8 Rue du Port',      'Tanger',     '90000', 'active', now())
ON CONFLICT (id) DO NOTHING;

-- ─── 4. organisation_members ─────────────────────────────────────────────────
-- get_user_org_ids() se base sur cette table pour résoudre les RLS policies.
INSERT INTO organisation_members (
  id, organisation_id, user_id, team_role, active, joined_at
)
VALUES
  ('00000000-0000-0000-0000-300000000001', '00000000-0000-0000-0000-200000000001', '00000000-0000-0000-0000-100000000001', 'owner', true, now()),
  ('00000000-0000-0000-0000-300000000002', '00000000-0000-0000-0000-200000000002', '00000000-0000-0000-0000-100000000002', 'owner', true, now()),
  ('00000000-0000-0000-0000-300000000003', '00000000-0000-0000-0000-200000000003', '00000000-0000-0000-0000-100000000003', 'owner', true, now()),
  ('00000000-0000-0000-0000-300000000004', '00000000-0000-0000-0000-200000000004', '00000000-0000-0000-0000-100000000004', 'owner', true, now())
ON CONFLICT (id) DO NOTHING;

-- ─── 5. delivery_profiles (persona livreur) ───────────────────────────────────
INSERT INTO delivery_profiles (
  organisation_id, validation_status, avg_rating
)
VALUES (
  '00000000-0000-0000-0000-200000000004', 'validated', 4.8
)
ON CONFLICT (organisation_id) DO NOTHING;
