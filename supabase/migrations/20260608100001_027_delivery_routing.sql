-- ── Migration 027 — Delivery Routing System ──────────────────────────────────
-- Adds delivery_method and carrier_org_id to orders table.
-- delivery_method determines who handles the shipment once the order is confirmed.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_method text
    NOT NULL DEFAULT 'stock212'
    CHECK (delivery_method IN ('partner_carrier', 'stock212', 'seller_fleet', 'buyer_managed')),
  ADD COLUMN IF NOT EXISTS carrier_org_id uuid
    REFERENCES organisations(id) ON DELETE SET NULL;

COMMENT ON COLUMN orders.delivery_method IS
  'partner_carrier = buyer chose a validated 3PL partner; '
  'stock212 = platform dispatches an independent delivery agent; '
  'seller_fleet = seller handles delivery with own vehicles; '
  'buyer_managed = buyer arranges their own shipping / pickup';

COMMENT ON COLUMN orders.carrier_org_id IS
  'FK to the partner carrier org selected by the buyer (only set when delivery_method = partner_carrier)';

-- Ensure carrier_org_id is only set when method is partner_carrier
ALTER TABLE orders ADD CONSTRAINT chk_carrier_org_id
  CHECK (
    (delivery_method = 'partner_carrier' AND carrier_org_id IS NOT NULL)
    OR (delivery_method <> 'partner_carrier' AND carrier_org_id IS NULL)
    OR carrier_org_id IS NULL
  );

-- Index for filtering tickets by delivery agent (already exists on delivery_tickets.assigned_delivery_id)
-- Index for the new column
CREATE INDEX IF NOT EXISTS idx_orders_delivery_method ON orders(delivery_method);
CREATE INDEX IF NOT EXISTS idx_orders_carrier_org_id  ON orders(carrier_org_id) WHERE carrier_org_id IS NOT NULL;
