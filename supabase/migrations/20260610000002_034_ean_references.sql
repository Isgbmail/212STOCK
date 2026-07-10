-- Migration 034: Table de référence EAN (catalogue produit canonique)
-- Géré par l'équipe interne et enrichi par les vendeurs lors de la création produit.

CREATE TABLE IF NOT EXISTS ean_references (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  ean               text         UNIQUE NOT NULL,
  name              text         NOT NULL,
  short_description text,
  images            text[]       NOT NULL DEFAULT '{}',
  category_id       uuid         REFERENCES categories(id)  ON DELETE SET NULL,
  brand_id          uuid         REFERENCES brands(id)      ON DELETE SET NULL,
  temperature       text         NOT NULL DEFAULT 'ambient'
    CHECK (temperature IN ('ambient', 'refrigerated', 'fresh', 'frozen')),
  physical_form     text
    CHECK (physical_form IS NULL OR physical_form IN ('liquid','solid','powder','gel','aerosol','cream','tablet','other')),
  net_weight        numeric,
  weight_unit       text         DEFAULT 'g',
  certifications    text[]       NOT NULL DEFAULT '{}',
  allergens         text[]       NOT NULL DEFAULT '{}',
  nutri_score       text
    CHECK (nutri_score IS NULL OR nutri_score IN ('A','B','C','D','E')),
  pack_size         integer      DEFAULT 1,
  shelf_life_days   integer,
  origin_country    text,
  hs_code           text,
  packaging_type    text,
  manufacturer_name text,

  -- Workflow
  status            text         NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'rejected')),
  source            text         NOT NULL DEFAULT 'platform'
    CHECK (source IN ('platform', 'vendor')),
  created_by_org_id uuid         REFERENCES organisations(id) ON DELETE SET NULL,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ean_ref_ean       ON ean_references(ean);
CREATE INDEX IF NOT EXISTS idx_ean_ref_status    ON ean_references(status);
CREATE INDEX IF NOT EXISTS idx_ean_ref_category  ON ean_references(category_id);

ALTER TABLE ean_references ENABLE ROW LEVEL SECURITY;

-- Lecture : actives pour tous, toutes pour les admins
CREATE POLICY "ean_ref_select"
  ON ean_references FOR SELECT
  USING (
    status = 'active'
    OR EXISTS (
      SELECT 1 FROM admin_team
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- Vendeurs : peuvent insérer une référence pending
CREATE POLICY "ean_ref_vendor_insert"
  ON ean_references FOR INSERT
  WITH CHECK (
    status = 'pending' AND source = 'vendor'
    AND EXISTS (
      SELECT 1 FROM organisation_members om
      JOIN organisations o ON o.id = om.organisation_id
      WHERE om.user_id = auth.uid()
        AND o.org_type = 'seller'
        AND om.active = true
    )
  );

-- Admins : toutes opérations
CREATE POLICY "ean_ref_admin_all"
  ON ean_references FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_team
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_team
      WHERE user_id = auth.uid() AND active = true
    )
  );
