-- Migration 029 — Vendor Delivery Configuration
-- Each seller configures their delivery pricing model.
-- Used by the cart optimizer to compute total landed cost (products + delivery)
-- and to suggest vendor consolidation when it saves money overall.

CREATE TABLE IF NOT EXISTS vendor_delivery_config (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  -- Pricing model
  delivery_mode      text NOT NULL DEFAULT 'free_above_threshold'
    CHECK (delivery_mode IN (
      'flat_rate',           -- fixed fee per delivery regardless of order size
      'free_above_threshold',-- flat fee, waived when order subtotal >= free_threshold_mad
      'percentage',          -- fee = order_subtotal × percentage_rate (with optional min/max)
      'free_always',         -- seller always delivers for free
      'negotiated'           -- price set case by case; optimizer shows 0 as placeholder
    )),
  flat_rate_mad      numeric(10,2) NOT NULL DEFAULT 35,
  free_threshold_mad numeric(10,2) DEFAULT 1000,   -- only used in free_above_threshold mode
  percentage_rate    numeric(5,4),                  -- e.g. 0.05 = 5 %
  min_charge_mad     numeric(10,2),
  max_charge_mad     numeric(10,2),
  notes              text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_org_id)
);

CREATE INDEX IF NOT EXISTS idx_vdc_seller ON vendor_delivery_config (seller_org_id);

ALTER TABLE vendor_delivery_config ENABLE ROW LEVEL SECURITY;

-- Buyers can read configs to estimate landed costs
DROP POLICY IF EXISTS "vdc_select" ON vendor_delivery_config;
CREATE POLICY "vdc_select" ON vendor_delivery_config FOR SELECT TO authenticated USING (true);

-- Only org owners / admins can manage their own config
DROP POLICY IF EXISTS "vdc_insert" ON vendor_delivery_config;
CREATE POLICY "vdc_insert" ON vendor_delivery_config FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = vendor_delivery_config.seller_org_id
        AND om.user_id = auth.uid()
        AND om.team_role IN ('owner', 'admin_seller')
        AND om.active = true
    )
  );

DROP POLICY IF EXISTS "vdc_update" ON vendor_delivery_config;
CREATE POLICY "vdc_update" ON vendor_delivery_config FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = vendor_delivery_config.seller_org_id
        AND om.user_id = auth.uid()
        AND om.team_role IN ('owner', 'admin_seller')
        AND om.active = true
    )
  );

-- Seed defaults for all existing seller orgs
-- Default: 35 MAD flat rate, free above 1 000 MAD
INSERT INTO vendor_delivery_config (seller_org_id)
SELECT id FROM organisations WHERE org_type = 'seller'
ON CONFLICT (seller_org_id) DO NOTHING;
