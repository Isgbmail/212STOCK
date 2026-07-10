/*
# Migration 2: Role-Specific Profiles

## Summary
Creates extended profile tables for buyers, sellers, and delivery providers.
Also creates the delivery zone and delivery capability tables used by the
directory search feature.

## New Tables
- `buyer_profiles` — Preferences and credit settings for buying organisations.
- `seller_profiles` — Banking, certifications, payment terms for selling orgs.
- `delivery_profiles` — Type, parent org (for internal fleets), and tariff base.
- `delivery_zones` — Postal code sets with per-zone surcharges and lead times.
- `delivery_capabilities` — Max weight/volume, cold chain, etc.
*/

-- ─── buyer_profiles ──────────────────────────────────────────────────────────
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
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = buyer_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "buyer_prof_insert" ON buyer_profiles;
CREATE POLICY "buyer_prof_insert" ON buyer_profiles FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "buyer_prof_update" ON buyer_profiles;
CREATE POLICY "buyer_prof_update" ON buyer_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = buyer_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── seller_profiles ─────────────────────────────────────────────────────────
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
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "seller_prof_update" ON seller_profiles;
CREATE POLICY "seller_prof_update" ON seller_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = seller_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── delivery_profiles ───────────────────────────────────────────────────────
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
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "del_prof_update" ON delivery_profiles;
CREATE POLICY "del_prof_update" ON delivery_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_profiles.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── delivery_zones ──────────────────────────────────────────────────────────
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
CREATE POLICY "del_zones_select" ON delivery_zones FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "del_zones_insert" ON delivery_zones;
CREATE POLICY "del_zones_insert" ON delivery_zones FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_zones.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "del_zones_update" ON delivery_zones;
CREATE POLICY "del_zones_update" ON delivery_zones FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_zones.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "del_zones_delete" ON delivery_zones;
CREATE POLICY "del_zones_delete" ON delivery_zones FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_zones.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── delivery_capabilities ───────────────────────────────────────────────────
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
CREATE POLICY "del_caps_select" ON delivery_capabilities FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "del_caps_insert" ON delivery_capabilities;
CREATE POLICY "del_caps_insert" ON delivery_capabilities FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "del_caps_update" ON delivery_capabilities;
CREATE POLICY "del_caps_update" ON delivery_capabilities FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = delivery_capabilities.organisation_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );
