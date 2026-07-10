/*
# Migration 3: Product Catalogue

## Summary
Creates the full FMCG product catalogue including categories (tree), brands,
suppliers, products, variants, price tiers, and product lots for batch tracking.

## New Tables
- `categories` — Self-referencing tree (Food / Non-Food hierarchy).
- `brands` — Brand master list managed by admin.
- `suppliers` — Supplier master list.
- `products` — Core product entity with all FMCG-specific fields.
- `product_variants` — Size/format variants linked to a product.
- `price_tiers` — Quantity-break pricing per product or variant.
- `product_lots` — Batch/lot tracking for destocking and traceability.

## Security
- Categories, brands, suppliers: readable by all authenticated users.
- Products: readable by all authenticated; writable by seller org members with catalog role.
- Variants, tiers, lots: same seller-scoped write access.
*/

-- ─── categories ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  name_i18n       jsonb DEFAULT '{}',
  parent_id       uuid REFERENCES categories(id),
  description     text,
  icon            text,
  display_order   integer DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT
  TO authenticated USING (true);

INSERT INTO categories (name, display_order) VALUES
  ('Food', 1),
  ('Non-Food', 2)
ON CONFLICT DO NOTHING;

DO $$
DECLARE food_id uuid; nonfood_id uuid;
BEGIN
  SELECT id INTO food_id    FROM categories WHERE name = 'Food'     LIMIT 1;
  SELECT id INTO nonfood_id FROM categories WHERE name = 'Non-Food' LIMIT 1;

  INSERT INTO categories (name, parent_id, display_order) VALUES
    ('Boissons',            food_id, 1),
    ('Épicerie sèche',      food_id, 2),
    ('Produits laitiers',   food_id, 3),
    ('Boucherie & Charcuterie', food_id, 4),
    ('Fruits & Légumes',    food_id, 5),
    ('Surgelés',            food_id, 6),
    ('Conserves',           food_id, 7),
    ('Hygiène',             nonfood_id, 1),
    ('Entretien',           nonfood_id, 2),
    ('Emballages',          nonfood_id, 3),
    ('Papeterie',           nonfood_id, 4)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─── brands ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  logo_url    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brands_select" ON brands;
CREATE POLICY "brands_select" ON brands FOR SELECT TO authenticated USING (true);

-- ─── suppliers ───────────────────────────────────────────────────────────────
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

-- ─── products ────────────────────────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_products_seller    ON products (seller_org_id);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_status    ON products (status);
CREATE INDEX IF NOT EXISTS idx_products_fts       ON products USING gin(
  to_tsvector('french', coalesce(name,'') || ' ' || coalesce(short_description,''))
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT
  TO authenticated USING (status = 'active' OR EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.organisation_id = products.seller_org_id
      AND om.user_id = auth.uid() AND om.active = true
  ));

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = products.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  );

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = products.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager','marketing_manager')
    )
  );

-- ─── product_variants ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name            text NOT NULL,
  ean             text,
  stock_qty       integer,
  image_url       text,
  dimensions      jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variants_select" ON product_variants;
CREATE POLICY "variants_select" ON product_variants FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "variants_insert" ON product_variants;
CREATE POLICY "variants_insert" ON product_variants FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_variants.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  );

DROP POLICY IF EXISTS "variants_update" ON product_variants;
CREATE POLICY "variants_update" ON product_variants FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM products p
      JOIN organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_variants.product_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  );

-- ─── price_tiers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_tiers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid REFERENCES products(id) ON DELETE CASCADE,
  variant_id  uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  qty_min     integer NOT NULL DEFAULT 1,
  unit_price  numeric(12,4) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);

ALTER TABLE price_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "price_tiers_select" ON price_tiers;
CREATE POLICY "price_tiers_select" ON price_tiers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "price_tiers_insert" ON price_tiers;
CREATE POLICY "price_tiers_insert" ON price_tiers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "price_tiers_update" ON price_tiers;
CREATE POLICY "price_tiers_update" ON price_tiers FOR UPDATE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "price_tiers_delete" ON price_tiers;
CREATE POLICY "price_tiers_delete" ON price_tiers FOR DELETE
  TO authenticated USING (true);

-- ─── product_lots ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_lots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_number      text NOT NULL,
  qty_available   integer NOT NULL DEFAULT 0,
  expiry_date     date,
  specific_price  numeric(12,4),
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lots_select" ON product_lots;
CREATE POLICY "lots_select" ON product_lots FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "lots_insert" ON product_lots;
CREATE POLICY "lots_insert" ON product_lots FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lots_update" ON product_lots;
CREATE POLICY "lots_update" ON product_lots FOR UPDATE
  TO authenticated USING (true);
