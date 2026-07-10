/*
# Migration 4: Commerce — Promotions, Promo Codes, Carts, Orders

## Summary
Creates the transactional commerce layer: promotions defined by sellers,
promo codes, shopping carts (persistent per buyer org), and orders with lines.

## New Tables
- `promotions` — Seller-defined discount rules (%, fixed, bundle, volume).
- `promo_codes` — Unique codes linked to a promotion.
- `carts` — Persistent per buyer organisation; one active cart at a time.
- `cart_items` — Product/variant lines inside a cart.
- `orders` — Confirmed purchase orders; created from cart or quote.
- `order_lines` — Snapshot of products at time of order.
*/

-- ─── promotions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id   uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  promo_type      text NOT NULL DEFAULT 'percentage'
    CHECK (promo_type IN ('percentage','fixed','bundle','volume')),
  discount_value  numeric(10,4) NOT NULL,
  application     text NOT NULL DEFAULT 'all_products'
    CHECK (application IN ('all_products','specific_products','category')),
  product_ids     uuid[] DEFAULT '{}',
  category_id     uuid REFERENCES categories(id),
  min_qty         integer DEFAULT 1,
  starts_at       timestamptz,
  ends_at         timestamptz,
  active          boolean NOT NULL DEFAULT true,
  stackable       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promos_select" ON promotions;
CREATE POLICY "promos_select" ON promotions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "promos_insert" ON promotions;
CREATE POLICY "promos_insert" ON promotions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = promotions.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','marketing_manager')
    )
  );

DROP POLICY IF EXISTS "promos_update" ON promotions;
CREATE POLICY "promos_update" ON promotions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = promotions.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','marketing_manager')
    )
  );

-- ─── promo_codes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id         uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  code                  text NOT NULL UNIQUE,
  promo_type            text NOT NULL DEFAULT 'percentage'
    CHECK (promo_type IN ('percentage','fixed')),
  value                 numeric(10,4) NOT NULL,
  application           text NOT NULL DEFAULT 'all_products'
    CHECK (application IN ('all_products','specific_products','category')),
  product_ids           uuid[] DEFAULT '{}',
  category_id           uuid REFERENCES categories(id),
  min_qty               integer DEFAULT 1,
  min_order_amount      numeric(12,2),
  starts_at             timestamptz,
  ends_at               timestamptz,
  max_uses              integer,
  current_uses          integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_codes_select" ON promo_codes;
CREATE POLICY "promo_codes_select" ON promo_codes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "promo_codes_insert" ON promo_codes;
CREATE POLICY "promo_codes_insert" ON promo_codes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = promo_codes.seller_org_id
        AND om.user_id = auth.uid() AND om.active = true
        AND om.team_role IN ('owner','admin_seller','marketing_manager')
    )
  );

-- ─── carts ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_org_id    uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','abandoned','converted')),
  promo_code_id   uuid REFERENCES promo_codes(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carts_buyer ON carts (buyer_org_id, status);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carts_select" ON carts;
CREATE POLICY "carts_select" ON carts FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = carts.buyer_org_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "carts_insert" ON carts;
CREATE POLICY "carts_insert" ON carts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = carts.buyer_org_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "carts_update" ON carts;
CREATE POLICY "carts_update" ON carts FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = carts.buyer_org_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── cart_items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id             uuid NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id),
  variant_id          uuid REFERENCES product_variants(id),
  quantity            integer NOT NULL DEFAULT 1,
  unit_price_computed numeric(12,4),
  promotion_id        uuid REFERENCES promotions(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_items_select" ON cart_items;
CREATE POLICY "cart_items_select" ON cart_items FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM carts c
      JOIN organisation_members om ON om.organisation_id = c.buyer_org_id
      WHERE c.id = cart_items.cart_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "cart_items_insert" ON cart_items;
CREATE POLICY "cart_items_insert" ON cart_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts c
      JOIN organisation_members om ON om.organisation_id = c.buyer_org_id
      WHERE c.id = cart_items.cart_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "cart_items_update" ON cart_items;
CREATE POLICY "cart_items_update" ON cart_items FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM carts c
      JOIN organisation_members om ON om.organisation_id = c.buyer_org_id
      WHERE c.id = cart_items.cart_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "cart_items_delete" ON cart_items;
CREATE POLICY "cart_items_delete" ON cart_items FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM carts c
      JOIN organisation_members om ON om.organisation_id = c.buyer_org_id
      WHERE c.id = cart_items.cart_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── orders ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number         text NOT NULL UNIQUE,
  buyer_org_id         uuid NOT NULL REFERENCES organisations(id),
  seller_org_id        uuid NOT NULL REFERENCES organisations(id),
  quote_id             uuid,
  status               text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','in_preparation','shipped','delivered','cancelled','dispute')),
  total_ht             numeric(14,4) NOT NULL DEFAULT 0,
  total_taxes          numeric(14,4) NOT NULL DEFAULT 0,
  total_ttc            numeric(14,4) NOT NULL DEFAULT 0,
  currency             text NOT NULL DEFAULT 'EUR',
  exchange_rate        numeric(12,6) DEFAULT 1,
  payment_terms        text DEFAULT 'prepayment',
  payment_method       text,
  delivery_address     jsonb DEFAULT '{}',
  billing_address      jsonb DEFAULT '{}',
  delivery_preference  text DEFAULT 'standard'
    CHECK (delivery_preference IN ('standard','express','cold_chain')),
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer  ON orders (buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders (seller_org_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = orders.buyer_org_id OR om.organisation_id = orders.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "orders_insert" ON orders;
CREATE POLICY "orders_insert" ON orders FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = orders.buyer_org_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE (om.organisation_id = orders.buyer_org_id OR om.organisation_id = orders.seller_org_id)
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── order_lines ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_lines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id           uuid NOT NULL REFERENCES products(id),
  variant_id           uuid REFERENCES product_variants(id),
  product_name_snap    text NOT NULL,
  quantity             integer NOT NULL,
  unit_price_ht        numeric(12,4) NOT NULL,
  line_total_ht        numeric(14,4) NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_lines_select" ON order_lines;
CREATE POLICY "order_lines_select" ON order_lines FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = order_lines.order_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "order_lines_insert" ON order_lines;
CREATE POLICY "order_lines_insert" ON order_lines FOR INSERT
  TO authenticated WITH CHECK (true);

-- order number generator
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text LANGUAGE sql AS $$
  SELECT 'CMD-' || to_char(now(), 'YYYY') || '-' || lpad(
    (SELECT count(*)::text FROM orders WHERE extract(year FROM created_at) = extract(year FROM now())),
    6, '0'
  )
$$;
