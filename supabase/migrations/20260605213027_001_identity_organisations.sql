/*
# Migration 1: Identity & Organisations

Creates profiles, business_categories, organisations, and organisation_members.
Policies on organisations reference organisation_members, so members table is created first,
then policies added after both tables exist.
*/

-- ─── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          text,
  preferred_lang     text NOT NULL DEFAULT 'fr',
  preferred_currency text NOT NULL DEFAULT 'EUR',
  gdpr_consent       boolean NOT NULL DEFAULT false,
  onboarding_done    boolean NOT NULL DEFAULT false,
  last_seen          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── business_categories ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type  text NOT NULL CHECK (actor_type IN ('buyer','seller','delivery')),
  name        text NOT NULL,
  description text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE business_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "biz_cats_select" ON business_categories;
CREATE POLICY "biz_cats_select" ON business_categories FOR SELECT
  TO authenticated USING (true);

INSERT INTO business_categories (actor_type, name) VALUES
  ('buyer',    'Café'),
  ('buyer',    'Restaurant'),
  ('buyer',    'Supermarché'),
  ('buyer',    'Grossiste'),
  ('buyer',    'Distributeur'),
  ('buyer',    'E-commerce'),
  ('buyer',    'Hôtel'),
  ('buyer',    'Institutionnel'),
  ('buyer',    'Artisan'),
  ('seller',   'Fabricant'),
  ('seller',   'Distributeur'),
  ('seller',   'Grossiste'),
  ('seller',   'Coopérative'),
  ('seller',   'Marque de distributeur'),
  ('seller',   'Artisan'),
  ('seller',   'Importateur / Exportateur'),
  ('seller',   'Courtier'),
  ('delivery', 'Entreprise de logistique'),
  ('delivery', 'Indépendant'),
  ('delivery', 'Flotte interne'),
  ('delivery', 'Coursier'),
  ('delivery', 'Spécialiste chaîne du froid'),
  ('delivery', 'Dernier kilomètre')
ON CONFLICT DO NOTHING;

-- ─── organisations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organisations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  org_type          text NOT NULL CHECK (org_type IN ('buyer','seller','delivery')),
  sub_type          text,
  siret             text,
  vat_number        text,
  country           text NOT NULL DEFAULT 'FR',
  address_line1     text,
  address_line2     text,
  city              text,
  postal_code       text,
  region            text,
  validation_status text NOT NULL DEFAULT 'active'
    CHECK (validation_status IN ('pending','active','rejected')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- ─── organisation_members ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organisation_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_role       text NOT NULL DEFAULT 'owner' CHECK (team_role IN (
    'owner','admin_seller','catalog_manager','marketing_manager',
    'sales_rep','delivery_coordinator','member'
  )),
  active          boolean NOT NULL DEFAULT true,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organisation_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org  ON organisation_members (organisation_id);

ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;

-- ─── RLS on organisations (now that organisation_members exists) ──────────────
DROP POLICY IF EXISTS "orgs_select_member" ON organisations;
CREATE POLICY "orgs_select_member" ON organisations FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = organisations.id AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "orgs_insert_auth" ON organisations;
CREATE POLICY "orgs_insert_auth" ON organisations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "orgs_update_member" ON organisations;
CREATE POLICY "orgs_update_member" ON organisations FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = organisations.id AND om.user_id = auth.uid()
        AND om.team_role IN ('owner','admin_seller') AND om.active = true
    )
  );

-- ─── RLS on organisation_members ─────────────────────────────────────────────
DROP POLICY IF EXISTS "org_members_select" ON organisation_members;
CREATE POLICY "org_members_select" ON organisation_members FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organisation_members om2
      WHERE om2.organisation_id = organisation_members.organisation_id
        AND om2.user_id = auth.uid() AND om2.active = true
    )
  );

DROP POLICY IF EXISTS "org_members_insert" ON organisation_members;
CREATE POLICY "org_members_insert" ON organisation_members FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "org_members_update" ON organisation_members;
CREATE POLICY "org_members_update" ON organisation_members FOR UPDATE
  TO authenticated USING (user_id = auth.uid());

-- ─── saved_addresses ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_addresses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  alias                 text NOT NULL,
  address_line1         text,
  address_line2         text,
  city                  text,
  postal_code           text,
  region                text,
  country               text NOT NULL DEFAULT 'FR',
  is_default_delivery   boolean NOT NULL DEFAULT false,
  is_default_billing    boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_addr_select" ON saved_addresses;
CREATE POLICY "saved_addr_select" ON saved_addresses FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = saved_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "saved_addr_insert" ON saved_addresses;
CREATE POLICY "saved_addr_insert" ON saved_addresses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = saved_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "saved_addr_update" ON saved_addresses;
CREATE POLICY "saved_addr_update" ON saved_addresses FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = saved_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "saved_addr_delete" ON saved_addresses;
CREATE POLICY "saved_addr_delete" ON saved_addresses FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = saved_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );
