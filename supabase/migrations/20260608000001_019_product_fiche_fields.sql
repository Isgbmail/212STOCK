/*
  Migration 019 — FMCG Product Fiche Complete Fields
  Adds all missing fields from the 12-section FMCG product template:
  physical, packaging, logistics, manufacturer, distribution, safety, market positioning.
*/

ALTER TABLE products
  -- Section 3: Product characteristics
  ADD COLUMN IF NOT EXISTS net_weight          numeric,
  ADD COLUMN IF NOT EXISTS gross_weight        numeric,
  ADD COLUMN IF NOT EXISTS weight_unit         text    DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS physical_form       text    CHECK (physical_form IN ('liquid','solid','powder','gel','aerosol','cream','tablet','other')),

  -- Section 5: Packaging
  ADD COLUMN IF NOT EXISTS packaging_type      text,
  ADD COLUMN IF NOT EXISTS packaging_material  text,
  ADD COLUMN IF NOT EXISTS units_per_inner     integer,
  ADD COLUMN IF NOT EXISTS recyclable          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eco_score           text,

  -- Section 6: Storage
  ADD COLUMN IF NOT EXISTS min_shelf_temp      numeric,
  ADD COLUMN IF NOT EXISTS max_shelf_temp      numeric,
  ADD COLUMN IF NOT EXISTS after_opening_days  integer,
  ADD COLUMN IF NOT EXISTS fifo_required       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS humidity_sensitive  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS light_sensitive     boolean DEFAULT false,

  -- Section 7: Logistics
  ADD COLUMN IF NOT EXISTS volume_cbm_carton   numeric,
  ADD COLUMN IF NOT EXISTS pallet_weight_kg    numeric,
  ADD COLUMN IF NOT EXISTS stackability_max    integer,
  ADD COLUMN IF NOT EXISTS fragility_level     text    CHECK (fragility_level IN ('low','medium','high')),
  ADD COLUMN IF NOT EXISTS cold_chain_required boolean GENERATED ALWAYS AS (temperature IN ('refrigerated','fresh','frozen')) STORED,
  ADD COLUMN IF NOT EXISTS hazard_class        text,
  ADD COLUMN IF NOT EXISTS delivery_methods    text[]  DEFAULT '{}',

  -- Section 8: Manufacturer
  ADD COLUMN IF NOT EXISTS manufacturer_name    text,
  ADD COLUMN IF NOT EXISTS manufacturer_country text,
  ADD COLUMN IF NOT EXISTS production_method    text    CHECK (production_method IN ('industrial','artisanal','hybrid')),
  ADD COLUMN IF NOT EXISTS traceability_level   text    CHECK (traceability_level IN ('lot','ean','serial')),

  -- Section 9: Safety
  ADD COLUMN IF NOT EXISTS haccp_compliant     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS msds_available      boolean DEFAULT false,

  -- Section 10: Distribution
  ADD COLUMN IF NOT EXISTS distribution_channels text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exclusive_dist      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS territory_allocation text,

  -- Section 12: Market positioning
  ADD COLUMN IF NOT EXISTS target_segment      text,
  ADD COLUMN IF NOT EXISTS usp                 text,
  ADD COLUMN IF NOT EXISTS value_proposition   text    CHECK (value_proposition IN ('price','quality','eco','luxury','professional'));

COMMENT ON COLUMN products.cold_chain_required IS 'Auto-computed from temperature field';
COMMENT ON COLUMN products.delivery_methods IS 'e.g. {livraison_directe, enlevement, cold_chain_express}';
COMMENT ON COLUMN products.distribution_channels IS 'e.g. {supermarket, horeca, pharmacy, ecommerce}';
