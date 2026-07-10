/*
================================================================================
  Stock212 — Script SQL complet (migrations 001 → 021)
  Généré le 2026-06-07
  À exécuter UNE SEULE FOIS sur une base vide via Supabase SQL Editor.
  Toutes les instructions sont idempotentes (IF NOT EXISTS / DROP IF EXISTS).
================================================================================
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 001 — Identité & Organisations
-- ─────────────────────────────────────────────────────────────────────────────

-- profiles
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- business_categories
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

-- organisations
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

-- organisation_members
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

-- RLS organisations (après création de organisation_members)
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
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "orgs_update_member" ON organisations;
CREATE POLICY "orgs_update_member" ON organisations FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = organisations.id AND om.user_id = auth.uid()
        AND om.team_role IN ('owner','admin_seller') AND om.active = true
    )
  );

-- RLS organisation_members
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

-- saved_addresses
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
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = saved_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "saved_addr_insert" ON saved_addresses;
CREATE POLICY "saved_addr_insert" ON saved_addresses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = saved_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "saved_addr_update" ON saved_addresses;
CREATE POLICY "saved_addr_update" ON saved_addresses FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = saved_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "saved_addr_delete" ON saved_addresses;
CREATE POLICY "saved_addr_delete" ON saved_addresses FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = saved_addresses.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 002 — Profils étendus (Acheteur / Vendeur / Livreur)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS buyer_profiles (
  organisation_id       uuid PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  credit_limit          numeric(12,2),
  default_payment_terms text DEFAULT 'prepayment',
  interest_categories   text[] DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE buyer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyer_prof_select" ON buyer_profiles;
CREATE POLICY "buyer_prof_select" ON buyer_profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = buyer_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "buyer_prof_insert" ON buyer_profiles;
CREATE POLICY "buyer_prof_insert" ON buyer_profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = buyer_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "buyer_prof_update" ON buyer_profiles;
CREATE POLICY "buyer_prof_update" ON buyer_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = buyer_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS seller_profiles (
  organisation_id          uuid PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  bank_iban                text,
  bank_bic                 text,
  certifications           text[] DEFAULT '{}',
  accepted_payment_terms   text[] DEFAULT '{"prepayment"}',
  default_prep_days        integer DEFAULT 3,
  avg_rating               numeric(3,2) DEFAULT 0,
  review_count             integer DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_prof_select_public" ON seller_profiles;
CREATE POLICY "seller_prof_select_public" ON seller_profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "seller_prof_insert" ON seller_profiles;
CREATE POLICY "seller_prof_insert" ON seller_profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = seller_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "seller_prof_update" ON seller_profiles;
CREATE POLICY "seller_prof_update" ON seller_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = seller_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS delivery_profiles (
  organisation_id       uuid PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  delivery_type         text NOT NULL DEFAULT 'independent'
    CHECK (delivery_type IN ('logistics_company','independent','internal_fleet')),
  parent_org_id         uuid REFERENCES organisations(id),
  base_rate             numeric(10,2),
  validation_status     text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending','validated','rejected')),
  avg_rating            numeric(3,2) DEFAULT 0,
  review_count          integer DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "del_prof_select" ON delivery_profiles;
CREATE POLICY "del_prof_select" ON delivery_profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "del_prof_insert" ON delivery_profiles;
CREATE POLICY "del_prof_insert" ON delivery_profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "del_prof_update" ON delivery_profiles;
CREATE POLICY "del_prof_update" ON delivery_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS delivery_zones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  region          text,
  postal_codes    text[] DEFAULT '{}',
  surcharge       numeric(10,2) DEFAULT 0,
  lead_days_min   integer DEFAULT 1,
  lead_days_max   integer DEFAULT 5,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "del_zones_select" ON delivery_zones;
CREATE POLICY "del_zones_select" ON delivery_zones FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "del_zones_insert" ON delivery_zones;
CREATE POLICY "del_zones_insert" ON delivery_zones FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_zones.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "del_zones_update" ON delivery_zones;
CREATE POLICY "del_zones_update" ON delivery_zones FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_zones.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "del_zones_delete" ON delivery_zones;
CREATE POLICY "del_zones_delete" ON delivery_zones FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_zones.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS delivery_capabilities (
  organisation_id    uuid PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  max_weight_kg      numeric(10,2),
  max_volume_m3      numeric(10,3),
  cold_chain         boolean NOT NULL DEFAULT false,
  ambient            boolean NOT NULL DEFAULT true,
  frozen             boolean NOT NULL DEFAULT false,
  fragile            boolean NOT NULL DEFAULT false,
  last_mile          boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "del_caps_select" ON delivery_capabilities;
CREATE POLICY "del_caps_select" ON delivery_capabilities FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "del_caps_insert" ON delivery_capabilities;
CREATE POLICY "del_caps_insert" ON delivery_capabilities FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_capabilities.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "del_caps_update" ON delivery_capabilities;
CREATE POLICY "del_caps_update" ON delivery_capabilities FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_capabilities.organisation_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 003 — Catalogue produits
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  name_i18n     jsonb DEFAULT '{}',
  parent_id     uuid REFERENCES categories(id),
  description   text,
  icon          text,
  display_order integer DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select"      ON categories;
DROP POLICY IF EXISTS "categories_select_auth" ON categories;
DROP POLICY IF EXISTS "categories_select_anon" ON categories;
CREATE POLICY "categories_select_auth" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_select_anon" ON categories FOR SELECT TO anon USING (active = true);

INSERT INTO categories (name, display_order) VALUES
  ('Food', 1), ('Non-Food', 2)
ON CONFLICT DO NOTHING;

DO $$
DECLARE food_id uuid; nonfood_id uuid;
BEGIN
  SELECT id INTO food_id    FROM categories WHERE name = 'Food'     LIMIT 1;
  SELECT id INTO nonfood_id FROM categories WHERE name = 'Non-Food' LIMIT 1;
  INSERT INTO categories (name, parent_id, display_order) VALUES
    ('Boissons',                food_id,    1),
    ('Épicerie sèche',          food_id,    2),
    ('Produits laitiers',       food_id,    3),
    ('Boucherie & Charcuterie', food_id,    4),
    ('Fruits & Légumes',        food_id,    5),
    ('Surgelés',                food_id,    6),
    ('Conserves',               food_id,    7),
    ('Hygiène',                 nonfood_id, 1),
    ('Entretien',               nonfood_id, 2),
    ('Emballages',              nonfood_id, 3),
    ('Papeterie',               nonfood_id, 4)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE TABLE IF NOT EXISTS brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  logo_url    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_select"      ON brands;
DROP POLICY IF EXISTS "brands_select_auth" ON brands;
DROP POLICY IF EXISTS "brands_select_anon" ON brands;
CREATE POLICY "brands_select_auth" ON brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "brands_select_anon" ON brands FOR SELECT TO anon USING (true);

CREATE TABLE IF NOT EXISTS suppliers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  contact     text,
  country     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS products (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id            uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name                     text NOT NULL,
  short_description        text,
  long_description         text,
  images                   text[] DEFAULT '{}',
  videos                   text[] DEFAULT '{}',
  status                   text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','inactive','archived')),
  category_id              uuid REFERENCES categories(id),
  brand_id                 uuid REFERENCES brands(id),
  supplier_id              uuid REFERENCES suppliers(id),
  ean                      text,
  hs_code                  text,
  temperature              text DEFAULT 'ambient'
    CHECK (temperature IN ('ambient','refrigerated','fresh','frozen')),
  shelf_life_days          integer,
  moq                      integer NOT NULL DEFAULT 1,
  pack_size                integer DEFAULT 1,
  origin_country           text,
  export_countries         text[] DEFAULT '{}',
  certifications           text[] DEFAULT '{}',
  allergens                text[] DEFAULT '{}',
  ingredients              text,
  nutritional_info         text,
  incoterms                text[] DEFAULT '{}',
  currency                 text NOT NULL DEFAULT 'EUR',
  avg_rating               numeric(3,2) DEFAULT 0,
  review_count             integer DEFAULT 0,
  is_new                   boolean NOT NULL DEFAULT false,
  is_on_promotion          boolean NOT NULL DEFAULT false,
  is_sponsored             boolean NOT NULL DEFAULT false,
  stock_qty                integer,
  estimated_lead_days      integer DEFAULT 7,
  palettisation            jsonb DEFAULT '{}',
  dimensions_unit          jsonb DEFAULT '{}',
  dimensions_carton        jsonb DEFAULT '{}',
  dimensions_pallet        jsonb DEFAULT '{}',
  related_product_ids      uuid[] DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_seller   ON products (seller_org_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_status   ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_fts      ON products USING gin(
  to_tsvector('french', coalesce(name,'') || ' ' || coalesce(short_description,''))
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select"      ON products;
DROP POLICY IF EXISTS "products_select_auth" ON products;
DROP POLICY IF EXISTS "products_select_anon" ON products;
CREATE POLICY "products_select_auth" ON products FOR SELECT
  TO authenticated USING (status = 'active' OR EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.organisation_id = products.seller_org_id
      AND om.user_id = auth.uid() AND om.active = true
  ));
CREATE POLICY "products_select_anon" ON products FOR SELECT
  TO anon USING (status = 'active');

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = products.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  );

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = products.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager','marketing_manager'))
  );

CREATE TABLE IF NOT EXISTS product_variants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       text NOT NULL,
  ean        text,
  stock_qty  integer,
  image_url  text,
  dimensions jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variants_select" ON product_variants;
CREATE POLICY "variants_select" ON product_variants FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "variants_insert" ON product_variants;
CREATE POLICY "variants_insert" ON product_variants FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_variants.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  );

DROP POLICY IF EXISTS "variants_update" ON product_variants;
CREATE POLICY "variants_update" ON product_variants FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_variants.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  );

CREATE TABLE IF NOT EXISTS price_tiers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  qty_min    integer NOT NULL DEFAULT 1,
  unit_price numeric(12,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);

ALTER TABLE price_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_tiers_select"      ON price_tiers;
DROP POLICY IF EXISTS "price_tiers_select_auth" ON price_tiers;
DROP POLICY IF EXISTS "price_tiers_select_anon" ON price_tiers;
CREATE POLICY "price_tiers_select_auth" ON price_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_tiers_select_anon" ON price_tiers FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "price_tiers_insert" ON price_tiers;
CREATE POLICY "price_tiers_insert" ON price_tiers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = price_tiers.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  );

DROP POLICY IF EXISTS "price_tiers_update" ON price_tiers;
CREATE POLICY "price_tiers_update" ON price_tiers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = price_tiers.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = price_tiers.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  );

DROP POLICY IF EXISTS "price_tiers_delete" ON price_tiers;
CREATE POLICY "price_tiers_delete" ON price_tiers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = price_tiers.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  );

CREATE TABLE IF NOT EXISTS product_lots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_number    text NOT NULL,
  qty_available integer NOT NULL DEFAULT 0,
  expiry_date   date,
  specific_price numeric(12,4),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lots_select" ON product_lots;
CREATE POLICY "lots_select" ON product_lots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "lots_insert" ON product_lots;
CREATE POLICY "lots_insert" ON product_lots FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_lots.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  );

DROP POLICY IF EXISTS "lots_update" ON product_lots;
CREATE POLICY "lots_update" ON product_lots FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_lots.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_lots.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 004 — Commerce (Promotions, Carts, Orders)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS promotions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id  uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name           text NOT NULL,
  promo_type     text NOT NULL DEFAULT 'percentage'
    CHECK (promo_type IN ('percentage','fixed','bundle','volume')),
  discount_value numeric(10,4) NOT NULL,
  application    text NOT NULL DEFAULT 'all_products'
    CHECK (application IN ('all_products','specific_products','category')),
  product_ids    uuid[] DEFAULT '{}',
  category_id    uuid REFERENCES categories(id),
  min_qty        integer DEFAULT 1,
  starts_at      timestamptz,
  ends_at        timestamptz,
  active         boolean NOT NULL DEFAULT true,
  stackable      boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promos_select" ON promotions;
CREATE POLICY "promos_select" ON promotions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "promos_insert" ON promotions;
CREATE POLICY "promos_insert" ON promotions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = promotions.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','marketing_manager'))
  );

DROP POLICY IF EXISTS "promos_update" ON promotions;
CREATE POLICY "promos_update" ON promotions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = promotions.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','marketing_manager'))
  );

CREATE TABLE IF NOT EXISTS promo_codes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id    uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  code             text NOT NULL UNIQUE,
  promo_type       text NOT NULL DEFAULT 'percentage'
    CHECK (promo_type IN ('percentage','fixed')),
  value            numeric(10,4) NOT NULL,
  application      text NOT NULL DEFAULT 'all_products'
    CHECK (application IN ('all_products','specific_products','category')),
  product_ids      uuid[] DEFAULT '{}',
  category_id      uuid REFERENCES categories(id),
  min_qty          integer DEFAULT 1,
  min_order_amount numeric(12,2),
  starts_at        timestamptz,
  ends_at          timestamptz,
  max_uses         integer,
  current_uses     integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_codes_select" ON promo_codes;
CREATE POLICY "promo_codes_select" ON promo_codes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "promo_codes_insert" ON promo_codes;
CREATE POLICY "promo_codes_insert" ON promo_codes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = promo_codes.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','marketing_manager'))
  );

CREATE TABLE IF NOT EXISTS carts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_org_id   uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  status         text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','abandoned','converted')),
  promo_code_id  uuid REFERENCES promo_codes(id),
  name           text,
  is_template    boolean NOT NULL DEFAULT false,
  order_count    integer NOT NULL DEFAULT 0,
  last_ordered_at timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carts_buyer     ON carts (buyer_org_id, status);
CREATE INDEX IF NOT EXISTS idx_carts_templates ON carts (buyer_org_id, is_template) WHERE is_template = true;

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carts_select" ON carts;
CREATE POLICY "carts_select" ON carts FOR SELECT
  TO authenticated USING (buyer_org_id = ANY(public.get_user_org_ids()));

DROP POLICY IF EXISTS "carts_insert" ON carts;
CREATE POLICY "carts_insert" ON carts FOR INSERT
  TO authenticated WITH CHECK (buyer_org_id = ANY(public.get_user_org_ids()));

DROP POLICY IF EXISTS "carts_update" ON carts;
CREATE POLICY "carts_update" ON carts FOR UPDATE
  TO authenticated USING (buyer_org_id = ANY(public.get_user_org_ids()));

DROP POLICY IF EXISTS "carts_delete" ON carts;
CREATE POLICY "carts_delete" ON carts FOR DELETE
  TO authenticated USING (buyer_org_id = ANY(public.get_user_org_ids()));

CREATE TABLE IF NOT EXISTS cart_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id             uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id),
  variant_id          uuid REFERENCES product_variants(id),
  quantity            integer NOT NULL DEFAULT 1,
  unit_price_computed numeric(12,4),
  promotion_id        uuid REFERENCES promotions(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_cart_product_unique UNIQUE (cart_id, product_id)
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_items_select" ON cart_items;
CREATE POLICY "cart_items_select" ON cart_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_items.cart_id
      AND c.buyer_org_id = ANY(public.get_user_org_ids()))
  );

DROP POLICY IF EXISTS "cart_items_insert" ON cart_items;
CREATE POLICY "cart_items_insert" ON cart_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_items.cart_id
      AND c.buyer_org_id = ANY(public.get_user_org_ids()))
  );

DROP POLICY IF EXISTS "cart_items_update" ON cart_items;
CREATE POLICY "cart_items_update" ON cart_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_items.cart_id
      AND c.buyer_org_id = ANY(public.get_user_org_ids()))
  );

DROP POLICY IF EXISTS "cart_items_delete" ON cart_items;
CREATE POLICY "cart_items_delete" ON cart_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_items.cart_id
      AND c.buyer_org_id = ANY(public.get_user_org_ids()))
  );

CREATE TABLE IF NOT EXISTS orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number        text NOT NULL UNIQUE,
  buyer_org_id        uuid NOT NULL REFERENCES organisations(id),
  seller_org_id       uuid NOT NULL REFERENCES organisations(id),
  quote_id            uuid,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','in_preparation','shipped','delivered','cancelled','dispute')),
  total_ht            numeric(14,4) NOT NULL DEFAULT 0,
  total_taxes         numeric(14,4) NOT NULL DEFAULT 0,
  total_ttc           numeric(14,4) NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'EUR',
  exchange_rate       numeric(12,6) DEFAULT 1,
  payment_terms       text DEFAULT 'prepayment',
  payment_method      text,
  delivery_address    jsonb DEFAULT '{}',
  billing_address     jsonb DEFAULT '{}',
  delivery_preference text DEFAULT 'standard'
    CHECK (delivery_preference IN ('standard','express','cold_chain')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer  ON orders (buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders (seller_org_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = orders.buyer_org_id OR om.organisation_id = orders.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "orders_insert" ON orders;
CREATE POLICY "orders_insert" ON orders FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = orders.buyer_org_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = orders.buyer_org_id OR om.organisation_id = orders.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS order_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id),
  variant_id        uuid REFERENCES product_variants(id),
  product_name_snap text NOT NULL,
  quantity          integer NOT NULL,
  unit_price_ht     numeric(12,4) NOT NULL,
  line_total_ht     numeric(14,4) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_lines_select" ON order_lines;
CREATE POLICY "order_lines_select" ON order_lines FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = order_lines.order_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "order_lines_insert" ON order_lines;
CREATE POLICY "order_lines_insert" ON order_lines FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = order_lines.order_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text LANGUAGE sql
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT 'CMD-' || to_char(now(), 'YYYY') || '-' || lpad(
    (SELECT count(*)::text FROM public.orders WHERE extract(year FROM created_at) = extract(year FROM now())),
    6, '0'
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 005 — Finance, Devis & Tickets livraison
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  issued_at      date NOT NULL DEFAULT current_date,
  due_at         date,
  status         text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid','paid','overdue','cancelled','partially_paid')),
  amount_ht      numeric(14,4) NOT NULL,
  amount_tax     numeric(14,4) NOT NULL DEFAULT 0,
  amount_ttc     numeric(14,4) NOT NULL,
  amount_paid    numeric(14,4) NOT NULL DEFAULT 0,
  pdf_url        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = invoices.order_id AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.seller_org_id
      WHERE o.id = invoices.order_id AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','sales_rep'))
  );

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.seller_org_id OR om.organisation_id = o.buyer_org_id
      WHERE o.id = invoices.order_id AND om.user_id = auth.uid() AND om.active = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.seller_org_id OR om.organisation_id = o.buyer_org_id
      WHERE o.id = invoices.order_id AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount         numeric(14,4) NOT NULL,
  paid_at        date NOT NULL DEFAULT current_date,
  payment_method text,
  external_ref   text,
  status         text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','posted','rejected')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM invoices i
      JOIN orders o ON o.id = i.order_id
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE i.id = payments.invoice_id AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS credits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id uuid NOT NULL REFERENCES organisations(id),
  buyer_org_id  uuid NOT NULL REFERENCES organisations(id),
  order_id      uuid REFERENCES orders(id),
  amount        numeric(14,4) NOT NULL,
  currency      text NOT NULL DEFAULT 'EUR',
  reason        text,
  used          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credits_select" ON credits;
CREATE POLICY "credits_select" ON credits FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = credits.buyer_org_id OR om.organisation_id = credits.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "credits_insert" ON credits;
CREATE POLICY "credits_insert" ON credits FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = credits.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','sales_rep'))
  );

CREATE TABLE IF NOT EXISTS quotes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number         text NOT NULL UNIQUE,
  buyer_org_id         uuid NOT NULL REFERENCES organisations(id),
  seller_org_id        uuid NOT NULL REFERENCES organisations(id),
  status               text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','in_progress','responded','accepted','refused','expired','converted')),
  requested_at         timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz,
  responded_at         timestamptz,
  accepted_at          timestamptz,
  order_id             uuid REFERENCES orders(id),
  incoterm             text,
  loading_port         text,
  desired_delivery_date date,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotes_buyer  ON quotes (buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_quotes_seller ON quotes (seller_org_id);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_select" ON quotes;
CREATE POLICY "quotes_select" ON quotes FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = quotes.buyer_org_id OR om.organisation_id = quotes.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "quotes_insert" ON quotes;
CREATE POLICY "quotes_insert" ON quotes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = quotes.buyer_org_id AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "quotes_update" ON quotes;
CREATE POLICY "quotes_update" ON quotes FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = quotes.buyer_org_id OR om.organisation_id = quotes.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS quote_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id),
  product_description text,
  quantity            integer NOT NULL,
  requested_price     numeric(12,4),
  proposed_price      numeric(12,4),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_lines_select" ON quote_lines;
CREATE POLICY "quote_lines_select" ON quote_lines FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quotes q
      JOIN organisation_members om ON om.organisation_id = q.buyer_org_id OR om.organisation_id = q.seller_org_id
      WHERE q.id = quote_lines.quote_id AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "quote_lines_insert" ON quote_lines;
CREATE POLICY "quote_lines_insert" ON quote_lines FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM quotes q
      JOIN organisation_members om ON om.organisation_id = q.buyer_org_id
      WHERE q.id = quote_lines.quote_id AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "quote_lines_update" ON quote_lines;
CREATE POLICY "quote_lines_update" ON quote_lines FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quotes q
      JOIN organisation_members om ON om.organisation_id = q.buyer_org_id OR om.organisation_id = q.seller_org_id
      WHERE q.id = quote_lines.quote_id AND om.user_id = auth.uid() AND om.active = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM quotes q
      JOIN organisation_members om ON om.organisation_id = q.buyer_org_id OR om.organisation_id = q.seller_org_id
      WHERE q.id = quote_lines.quote_id AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS quote_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sender_id      uuid NOT NULL REFERENCES auth.users(id),
  message        text NOT NULL,
  attachment_url text,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quote_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_msgs_select" ON quote_messages;
CREATE POLICY "quote_msgs_select" ON quote_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM quotes q
      JOIN organisation_members om ON om.organisation_id = q.buyer_org_id OR om.organisation_id = q.seller_org_id
      WHERE q.id = quote_messages.quote_id AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "quote_msgs_insert" ON quote_messages;
CREATE POLICY "quote_msgs_insert" ON quote_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE TABLE IF NOT EXISTS delivery_tickets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number        text NOT NULL UNIQUE,
  created_by           uuid NOT NULL REFERENCES auth.users(id),
  requester_org_id     uuid NOT NULL REFERENCES organisations(id),
  order_id             uuid REFERENCES orders(id),
  assigned_delivery_id uuid REFERENCES organisations(id),
  pickup_address       jsonb NOT NULL DEFAULT '{}',
  delivery_address     jsonb NOT NULL DEFAULT '{}',
  parcel_details       jsonb DEFAULT '{}',
  window_start         timestamptz,
  window_end           timestamptz,
  status               text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','assigned','picked_up','in_transit','delivered','cancelled')),
  priority             text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal','express')),
  proposed_price       numeric(10,2),
  accepted_price       numeric(10,2),
  assigned_at          timestamptz,
  completed_at         timestamptz,
  proof_url            text,
  insured              boolean NOT NULL DEFAULT false,
  insured_value        numeric(12,2),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_requester ON delivery_tickets (requester_org_id);
CREATE INDEX IF NOT EXISTS idx_tickets_delivery  ON delivery_tickets (assigned_delivery_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status    ON delivery_tickets (status);

ALTER TABLE delivery_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_select" ON delivery_tickets;
CREATE POLICY "tickets_select" ON delivery_tickets FOR SELECT
  TO authenticated USING (
    status = 'open'
    OR EXISTS (SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = delivery_tickets.requester_org_id
             OR om.organisation_id = delivery_tickets.assigned_delivery_id)
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "tickets_insert" ON delivery_tickets;
CREATE POLICY "tickets_insert" ON delivery_tickets FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_tickets.requester_org_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "tickets_update" ON delivery_tickets;
CREATE POLICY "tickets_update" ON delivery_tickets FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = delivery_tickets.requester_org_id
             OR om.organisation_id = delivery_tickets.assigned_delivery_id)
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS ticket_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      uuid NOT NULL REFERENCES delivery_tickets(id) ON DELETE CASCADE,
  sender_id      uuid NOT NULL REFERENCES auth.users(id),
  message        text NOT NULL,
  attachment_url text,
  internal       boolean NOT NULL DEFAULT false,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket_msgs_select" ON ticket_messages;
CREATE POLICY "ticket_msgs_select" ON ticket_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM delivery_tickets dt
      JOIN organisation_members om ON om.organisation_id = dt.requester_org_id OR om.organisation_id = dt.assigned_delivery_id
      WHERE dt.id = ticket_messages.ticket_id AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "ticket_msgs_insert" ON ticket_messages;
CREATE POLICY "ticket_msgs_insert" ON ticket_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 006 — Post-vente, Avis, Config plateforme & Notifications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id),
  dispute_type      text NOT NULL
    CHECK (dispute_type IN ('non_conforming','damaged','partial_delivery','late','billing_error')),
  status            text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  buyer_description text,
  seller_response   text,
  attachments       text[] DEFAULT '{}',
  resolution        text,
  refund_amount     numeric(14,4),
  credit_id         uuid REFERENCES credits(id),
  opened_at         timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_select" ON disputes;
CREATE POLICY "disputes_select" ON disputes FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = disputes.order_id AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "disputes_insert" ON disputes;
CREATE POLICY "disputes_insert" ON disputes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id
      WHERE o.id = disputes.order_id AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "disputes_update" ON disputes;
CREATE POLICY "disputes_update" ON disputes FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = disputes.order_id AND om.user_id = auth.uid() AND om.active = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = disputes.order_id AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS product_returns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id),
  dispute_id     uuid REFERENCES disputes(id),
  status         text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','authorized','shipped_by_buyer','received_by_seller','inspected','refunded')),
  return_address jsonb DEFAULT '{}',
  carrier_org_id uuid REFERENCES organisations(id),
  requested_at   timestamptz NOT NULL DEFAULT now(),
  authorized_at  timestamptz,
  received_at    timestamptz
);

ALTER TABLE product_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "returns_select" ON product_returns;
CREATE POLICY "returns_select" ON product_returns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "returns_insert" ON product_returns;
CREATE POLICY "returns_insert" ON product_returns FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id
      WHERE o.id = product_returns.order_id AND om.user_id = auth.uid() AND om.active = true)
  );

DROP POLICY IF EXISTS "returns_update" ON product_returns;
CREATE POLICY "returns_update" ON product_returns FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = product_returns.order_id AND om.user_id = auth.uid() AND om.active = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = product_returns.order_id AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS return_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id   uuid NOT NULL REFERENCES product_returns(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id),
  qty_returned integer NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE return_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_lines_select" ON return_lines;
CREATE POLICY "return_lines_select" ON return_lines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "return_lines_insert" ON return_lines;
CREATE POLICY "return_lines_insert" ON return_lines FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM product_returns pr
      JOIN orders o ON o.id = pr.order_id
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id
      WHERE pr.id = return_lines.return_id AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS product_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(id),
  order_id        uuid NOT NULL REFERENCES orders(id),
  buyer_org_id    uuid NOT NULL REFERENCES organisations(id),
  rating          integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  rating_delivery integer CHECK (rating_delivery BETWEEN 1 AND 5),
  rating_quality  integer CHECK (rating_quality BETWEEN 1 AND 5),
  comment         text,
  reviewer_name   text,
  verified        boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_anon" ON product_reviews;
DROP POLICY IF EXISTS "reviews_select_auth" ON product_reviews;
DROP POLICY IF EXISTS "prod_reviews_select" ON product_reviews;
CREATE POLICY "reviews_select_anon" ON product_reviews FOR SELECT TO anon USING (true);
CREATE POLICY "reviews_select_auth" ON product_reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prod_reviews_insert" ON product_reviews;
CREATE POLICY "prod_reviews_insert" ON product_reviews FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = product_reviews.buyer_org_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS vendor_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id    uuid NOT NULL REFERENCES organisations(id),
  buyer_org_id     uuid NOT NULL REFERENCES organisations(id),
  order_id         uuid NOT NULL REFERENCES orders(id),
  rating_global    integer NOT NULL CHECK (rating_global BETWEEN 1 AND 5),
  rating_service   integer CHECK (rating_service BETWEEN 1 AND 5),
  rating_conformity integer CHECK (rating_conformity BETWEEN 1 AND 5),
  comment          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_reviews_select" ON vendor_reviews;
CREATE POLICY "vendor_reviews_select" ON vendor_reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vendor_reviews_insert" ON vendor_reviews;
CREATE POLICY "vendor_reviews_insert" ON vendor_reviews FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders o
      JOIN organisation_members om ON om.organisation_id = o.buyer_org_id
      WHERE o.id = vendor_reviews.order_id AND o.buyer_org_id = vendor_reviews.buyer_org_id
        AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS delivery_reviews (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_org_id       uuid NOT NULL REFERENCES organisations(id),
  ticket_id             uuid NOT NULL REFERENCES delivery_tickets(id),
  rating_global         integer NOT NULL CHECK (rating_global BETWEEN 1 AND 5),
  rating_punctuality    integer CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_communication  integer CHECK (rating_communication BETWEEN 1 AND 5),
  comment               text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "del_reviews_select" ON delivery_reviews;
CREATE POLICY "del_reviews_select" ON delivery_reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "del_reviews_insert" ON delivery_reviews;
CREATE POLICY "del_reviews_insert" ON delivery_reviews FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM delivery_tickets dt
      JOIN organisation_members om ON om.organisation_id = dt.requester_org_id
      WHERE dt.id = delivery_reviews.ticket_id AND om.user_id = auth.uid() AND om.active = true)
  );

CREATE TABLE IF NOT EXISTS platform_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_currency    text NOT NULL DEFAULT 'EUR',
  available_languages text[] DEFAULT '{"fr","en"}',
  cart_ttl_days       integer DEFAULT 30,
  intraeu_vat_enabled boolean NOT NULL DEFAULT true,
  vat_rules           jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select" ON platform_settings;
CREATE POLICY "platform_settings_select" ON platform_settings FOR SELECT TO authenticated USING (true);

INSERT INTO platform_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS editorial_content (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL,
  lang       text NOT NULL DEFAULT 'fr',
  title      text NOT NULL,
  content    text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, lang)
);

ALTER TABLE editorial_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editorial_select" ON editorial_content;
CREATE POLICY "editorial_select" ON editorial_content FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "editorial_insert" ON editorial_content;
CREATE POLICY "editorial_insert" ON editorial_content FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "editorial_update" ON editorial_content;
CREATE POLICY "editorial_update" ON editorial_content FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS saved_searches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  filters       jsonb NOT NULL DEFAULT '{}',
  alert_enabled boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_searches_select" ON saved_searches;
CREATE POLICY "saved_searches_select" ON saved_searches FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_searches_insert" ON saved_searches;
CREATE POLICY "saved_searches_insert" ON saved_searches FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_searches_delete" ON saved_searches;
CREATE POLICY "saved_searches_delete" ON saved_searches FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  entity_type text,
  entity_id   uuid,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  changes     jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 008 — Fix récursion infinie dans organisation_members SELECT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT array_agg(organisation_id)
  FROM public.organisation_members
  WHERE user_id = auth.uid() AND active = true;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_org_ids() FROM anon;

DROP POLICY IF EXISTS "org_members_select" ON public.organisation_members;
CREATE POLICY "org_members_select" ON public.organisation_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organisation_id = ANY(public.get_user_org_ids())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 009 — Fix organisations SELECT et org_members_insert
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "orgs_select_member" ON public.organisations;
CREATE POLICY "orgs_select_member" ON public.organisations
  FOR SELECT TO authenticated
  USING (id = ANY(public.get_user_org_ids()));

DROP POLICY IF EXISTS "organisations_public_select_anon" ON public.organisations;
CREATE POLICY "organisations_public_select_anon" ON organisations FOR SELECT
  TO anon USING (validation_status = 'active');

DROP POLICY IF EXISTS "org_members_insert" ON public.organisation_members;
CREATE POLICY "org_members_insert" ON public.organisation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR organisation_id = ANY(public.get_user_org_ids())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 010 — image_url sur categories + accès anon étendu
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url text;

UPDATE categories SET image_url = 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg' WHERE name = 'Food'     AND parent_id IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/6802042/pexels-photo-6802042.jpeg' WHERE name = 'Non-Food'  AND parent_id IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/1346155/pexels-photo-1346155.jpeg' WHERE name = 'Boissons';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg' WHERE name = 'Épicerie sèche';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg'   WHERE name = 'Produits laitiers';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/618775/pexels-photo-618775.jpeg'   WHERE name = 'Boucherie & Charcuterie';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/1300972/pexels-photo-1300972.jpeg' WHERE name = 'Fruits & Légumes';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/3736173/pexels-photo-3736173.jpeg' WHERE name = 'Surgelés';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg' WHERE name = 'Conserves';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/3952232/pexels-photo-3952232.jpeg' WHERE name = 'Hygiène';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/4239091/pexels-photo-4239091.jpeg' WHERE name = 'Entretien';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/4068309/pexels-photo-4068309.jpeg' WHERE name = 'Emballages';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/5632398/pexels-photo-5632398.jpeg' WHERE name = 'Papeterie';

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 011 — Seed marques + accès anon price_tiers & reviews
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO brands (name, description, logo_url) VALUES
  ('Nestlé',    'Leader mondial des produits alimentaires et boissons',   'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'),
  ('Danone',    'Produits laitiers et nutrition avancée',                  'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg'),
  ('Coca-Cola', 'Boissons rafraîchissantes leader mondial',               'https://images.pexels.com/photos/1346155/pexels-photo-1346155.jpeg'),
  ('Unilever',  'Hygiène, entretien et produits alimentaires',            'https://images.pexels.com/photos/3952232/pexels-photo-3952232.jpeg'),
  ('McCain',    'Spécialiste des produits surgelés',                      'https://images.pexels.com/photos/3736173/pexels-photo-3736173.jpeg'),
  ('Bonduelle', 'Légumes et conserves de qualité',                        'https://images.pexels.com/photos/1300972/pexels-photo-1300972.jpeg'),
  ('Heinz',     'Sauces, condiments et conserves',                        'https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg'),
  ('Président', 'Produits laitiers premium',                              'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 012 — Flag is_admin sur profiles
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 013 — Bucket Storage pour images produits
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 'product-images', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product_images_public_select" ON storage.objects;
CREATE POLICY "product_images_public_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_vendor_insert" ON storage.objects;
CREATE POLICY "product_images_vendor_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_vendor_delete" ON storage.objects;
CREATE POLICY "product_images_vendor_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 014 — Nutri-Score, DLC, valeurs nutritionnelles, documents
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS nutri_score        text CHECK (nutri_score IN ('A','B','C','D','E')),
  ADD COLUMN IF NOT EXISTS dlc_type           text CHECK (dlc_type IN ('DLC','DDM')),
  ADD COLUMN IF NOT EXISTS nutritional_values  jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS document_urls       jsonb DEFAULT '[]';

COMMENT ON COLUMN products.nutri_score       IS 'Nutri-Score A–E (food products)';
COMMENT ON COLUMN products.dlc_type          IS 'DLC = Date Limite de Consommation / DDM = Date de Durabilité Minimale';
COMMENT ON COLUMN products.nutritional_values IS 'Structured nutrition per 100g';
COMMENT ON COLUMN products.document_urls      IS 'Array of {name, url, type}';

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 015 — Fix RLS carts + UNIQUE cart_items
-- (get_user_org_ids() est déjà définie en migration 008)
-- ─────────────────────────────────────────────────────────────────────────────

-- (Les policies carts et cart_items ont déjà été créées avec get_user_org_ids()
--  dans la migration 004 ci-dessus — aucun DROP/CREATE supplémentaire nécessaire)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_items_cart_product_unique'
      AND conrelid = 'cart_items'::regclass
  ) THEN
    ALTER TABLE cart_items ADD CONSTRAINT cart_items_cart_product_unique UNIQUE (cart_id, product_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 016 — Gestion des retours commandes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_returns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL UNIQUE,
  order_id      uuid NOT NULL REFERENCES orders(id),
  buyer_org_id  uuid NOT NULL REFERENCES organisations(id),
  seller_org_id uuid NOT NULL REFERENCES organisations(id),
  reason        text NOT NULL DEFAULT 'other'
    CHECK (reason IN ('damaged','wrong_product','quality_issue','expired','excess','other')),
  status        text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','rejected','in_transit','received','completed')),
  refund_type   text NOT NULL DEFAULT 'avoir'
    CHECK (refund_type IN ('avoir','exchange','refund')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  approved_at   timestamptz,
  received_at   timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "returns_select" ON order_returns;
CREATE POLICY "returns_select" ON order_returns FOR SELECT
  TO authenticated USING (
    buyer_org_id  = ANY(public.get_user_org_ids()) OR
    seller_org_id = ANY(public.get_user_org_ids())
  );

DROP POLICY IF EXISTS "returns_insert" ON order_returns;
CREATE POLICY "returns_insert" ON order_returns FOR INSERT
  TO authenticated WITH CHECK (buyer_org_id = ANY(public.get_user_org_ids()));

DROP POLICY IF EXISTS "returns_update" ON order_returns;
CREATE POLICY "returns_update" ON order_returns FOR UPDATE
  TO authenticated USING (
    buyer_org_id  = ANY(public.get_user_org_ids()) OR
    seller_org_id = ANY(public.get_user_org_ids())
  );

CREATE TABLE IF NOT EXISTS order_return_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id           uuid NOT NULL REFERENCES order_returns(id) ON DELETE CASCADE,
  product_name_snap   text NOT NULL,
  product_id          uuid REFERENCES products(id),
  quantity_requested  integer NOT NULL DEFAULT 1,
  quantity_received   integer,
  unit_price_ht       numeric(12,4),
  reason_line         text,
  condition           text CHECK (condition IN ('intact','damaged','expired','other')),
  accepted            boolean,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_return_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_lines_select" ON order_return_lines;
CREATE POLICY "return_lines_select" ON order_return_lines FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM order_returns r WHERE r.id = order_return_lines.return_id
      AND (r.buyer_org_id = ANY(public.get_user_org_ids()) OR r.seller_org_id = ANY(public.get_user_org_ids())))
  );

DROP POLICY IF EXISTS "return_lines_insert" ON order_return_lines;
CREATE POLICY "return_lines_insert" ON order_return_lines FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM order_returns r WHERE r.id = order_return_lines.return_id
      AND r.buyer_org_id = ANY(public.get_user_org_ids()))
  );

DROP POLICY IF EXISTS "return_lines_update" ON order_return_lines;
CREATE POLICY "return_lines_update" ON order_return_lines FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM order_returns r WHERE r.id = order_return_lines.return_id
      AND (r.buyer_org_id = ANY(public.get_user_org_ids()) OR r.seller_org_id = ANY(public.get_user_org_ids())))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 017 — Frais de mission livreurs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mission_expenses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_ticket_id uuid NOT NULL REFERENCES delivery_tickets(id) ON DELETE CASCADE,
  expense_type       text NOT NULL DEFAULT 'other'
    CHECK (expense_type IN ('fuel','toll','parking','meal','lodging','other')),
  description        text,
  expense_date       date NOT NULL DEFAULT CURRENT_DATE,
  amount_ht          numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount_ht >= 0),
  tva_rate           numeric(5,2)  NOT NULL DEFAULT 20,
  receipt_ref        text,
  created_by         uuid REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mission_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mission_expenses_select" ON mission_expenses;
CREATE POLICY "mission_expenses_select" ON mission_expenses FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM delivery_tickets dt WHERE dt.id = mission_expenses.delivery_ticket_id
      AND (dt.requester_org_id = ANY(public.get_user_org_ids()) OR dt.assigned_delivery_id = ANY(public.get_user_org_ids())))
  );

DROP POLICY IF EXISTS "mission_expenses_insert" ON mission_expenses;
CREATE POLICY "mission_expenses_insert" ON mission_expenses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM delivery_tickets dt WHERE dt.id = mission_expenses.delivery_ticket_id
      AND dt.assigned_delivery_id = ANY(public.get_user_org_ids()))
  );

DROP POLICY IF EXISTS "mission_expenses_delete" ON mission_expenses;
CREATE POLICY "mission_expenses_delete" ON mission_expenses FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM delivery_tickets dt WHERE dt.id = mission_expenses.delivery_ticket_id
      AND dt.assigned_delivery_id = ANY(public.get_user_org_ids()))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 018 — Support templates sur carts
-- (déjà intégré dans la création de la table carts en migration 004)
-- ─────────────────────────────────────────────────────────────────────────────

-- Colonnes déjà ajoutées dans CREATE TABLE carts ci-dessus — rien à faire.

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 019 — Champs FMCG complets (fiche produit 12 sections)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS net_weight           numeric,
  ADD COLUMN IF NOT EXISTS gross_weight         numeric,
  ADD COLUMN IF NOT EXISTS weight_unit          text DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS physical_form        text
    CHECK (physical_form IN ('liquid','solid','powder','gel','aerosol','cream','tablet','other')),
  ADD COLUMN IF NOT EXISTS packaging_type       text,
  ADD COLUMN IF NOT EXISTS packaging_material   text,
  ADD COLUMN IF NOT EXISTS units_per_inner      integer,
  ADD COLUMN IF NOT EXISTS recyclable           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eco_score            text,
  ADD COLUMN IF NOT EXISTS min_shelf_temp       numeric,
  ADD COLUMN IF NOT EXISTS max_shelf_temp       numeric,
  ADD COLUMN IF NOT EXISTS after_opening_days   integer,
  ADD COLUMN IF NOT EXISTS fifo_required        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS humidity_sensitive   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS light_sensitive      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS volume_cbm_carton    numeric,
  ADD COLUMN IF NOT EXISTS pallet_weight_kg     numeric,
  ADD COLUMN IF NOT EXISTS stackability_max     integer,
  ADD COLUMN IF NOT EXISTS fragility_level      text CHECK (fragility_level IN ('low','medium','high')),
  ADD COLUMN IF NOT EXISTS cold_chain_required  boolean GENERATED ALWAYS AS (temperature IN ('refrigerated','fresh','frozen')) STORED,
  ADD COLUMN IF NOT EXISTS hazard_class         text,
  ADD COLUMN IF NOT EXISTS delivery_methods     text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS manufacturer_name    text,
  ADD COLUMN IF NOT EXISTS manufacturer_country text,
  ADD COLUMN IF NOT EXISTS production_method    text CHECK (production_method IN ('industrial','artisanal','hybrid')),
  ADD COLUMN IF NOT EXISTS traceability_level   text CHECK (traceability_level IN ('lot','ean','serial')),
  ADD COLUMN IF NOT EXISTS haccp_compliant      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS msds_available       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS distribution_channels text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exclusive_dist       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS territory_allocation text,
  ADD COLUMN IF NOT EXISTS target_segment       text,
  ADD COLUMN IF NOT EXISTS usp                  text,
  ADD COLUMN IF NOT EXISTS value_proposition    text
    CHECK (value_proposition IN ('price','quality','eco','luxury','professional'));

COMMENT ON COLUMN products.cold_chain_required   IS 'Auto-calculé depuis temperature';
COMMENT ON COLUMN products.delivery_methods      IS 'e.g. {livraison_directe, enlevement, cold_chain_express}';
COMMENT ON COLUMN products.distribution_channels IS 'e.g. {supermarket, horeca, pharmacy, ecommerce}';

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 020 — Équipe d'administration & RBAC
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_team (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('superadmin','moderator','finance_admin','support','data_viewer')),
  granted_by uuid        REFERENCES profiles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  notes      text,
  active     boolean     NOT NULL DEFAULT true,
  UNIQUE (user_id)
);

COMMENT ON TABLE  admin_team        IS 'Équipe admin plateforme avec contrôle d''accès par rôle';
COMMENT ON COLUMN admin_team.role   IS 'superadmin=accès total | moderator=contenu/orgs | finance_admin=données financières | support=commandes+litiges | data_viewer=lecture seule';
COMMENT ON COLUMN admin_team.active IS 'false = accès révoqué, ligne conservée pour audit';

ALTER TABLE admin_team ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_team_select" ON admin_team;
CREATE POLICY "admin_team_select" ON admin_team FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "admin_team_insert" ON admin_team;
CREATE POLICY "admin_team_insert" ON admin_team FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_team WHERE user_id = auth.uid() AND role = 'superadmin' AND active = true));

DROP POLICY IF EXISTS "admin_team_update" ON admin_team;
CREATE POLICY "admin_team_update" ON admin_team FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_team WHERE user_id = auth.uid() AND role = 'superadmin' AND active = true));

DROP POLICY IF EXISTS "admin_team_delete" ON admin_team;
CREATE POLICY "admin_team_delete" ON admin_team FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_team WHERE user_id = auth.uid() AND role = 'superadmin' AND active = true));

-- Lecture complète des profiles pour les admins (nécessaire pour la recherche d'utilisateurs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'admin_read_all_profiles'
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

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION 021 — Permissions JSONB par membre admin
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE admin_team
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN admin_team.permissions IS
  'Overrides de permissions par membre. Clés = codes permission, valeurs = true (accordé) ou false (refusé). Clé absente = hérité du rôle par défaut.';

-- ─────────────────────────────────────────────────────────────────────────────
-- BOOTSTRAP — Premier superadmin (à exécuter manuellement après ce script)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Remplacez <user-uuid> par l'UUID réel du compte dans auth.users / profiles :
--
--   INSERT INTO admin_team (user_id, role, notes)
--   VALUES ('<user-uuid>', 'superadmin', 'Premier superadmin — bootstrapé manuellement');
--
--   UPDATE profiles SET is_admin = true WHERE id = '<user-uuid>';
--
-- ─────────────────────────────────────────────────────────────────────────────
-- FIN DU SCRIPT
-- ─────────────────────────────────────────────────────────────────────────────
