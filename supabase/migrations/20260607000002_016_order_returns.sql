-- Migration 016 — Returns management: order_returns + return_lines
-- Covers the full return workflow: requested → approved → in_transit → received → completed

-- ─── order_returns ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_returns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number    text NOT NULL UNIQUE,
  order_id         uuid NOT NULL REFERENCES orders(id),
  buyer_org_id     uuid NOT NULL REFERENCES organisations(id),
  seller_org_id    uuid NOT NULL REFERENCES organisations(id),
  reason           text NOT NULL DEFAULT 'other'
    CHECK (reason IN ('damaged','wrong_product','quality_issue','expired','excess','other')),
  status           text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','rejected','in_transit','received','completed')),
  refund_type      text NOT NULL DEFAULT 'avoir'
    CHECK (refund_type IN ('avoir','exchange','refund')),
  requested_at     timestamptz NOT NULL DEFAULT now(),
  approved_at      timestamptz,
  received_at      timestamptz,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
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
  TO authenticated WITH CHECK (
    buyer_org_id = ANY(public.get_user_org_ids())
  );

DROP POLICY IF EXISTS "returns_update" ON order_returns;
CREATE POLICY "returns_update" ON order_returns FOR UPDATE
  TO authenticated USING (
    buyer_org_id  = ANY(public.get_user_org_ids()) OR
    seller_org_id = ANY(public.get_user_org_ids())
  );

-- ─── return_lines ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS return_lines (
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

ALTER TABLE return_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_lines_select" ON return_lines;
CREATE POLICY "return_lines_select" ON return_lines FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM order_returns r
      WHERE r.id = return_lines.return_id
        AND (
          r.buyer_org_id  = ANY(public.get_user_org_ids()) OR
          r.seller_org_id = ANY(public.get_user_org_ids())
        )
    )
  );

DROP POLICY IF EXISTS "return_lines_insert" ON return_lines;
CREATE POLICY "return_lines_insert" ON return_lines FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_returns r
      WHERE r.id = return_lines.return_id
        AND r.buyer_org_id = ANY(public.get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "return_lines_update" ON return_lines;
CREATE POLICY "return_lines_update" ON return_lines FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM order_returns r
      WHERE r.id = return_lines.return_id
        AND (
          r.buyer_org_id  = ANY(public.get_user_org_ids()) OR
          r.seller_org_id = ANY(public.get_user_org_ids())
        )
    )
  );
