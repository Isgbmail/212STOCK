/*
# Migration 6: Post-Sale, Reviews, Platform Config & Notifications

## Summary
Completes the data model with disputes, returns, all review types,
platform settings, editorial content, saved searches, notifications,
and audit logs.

## New Tables
- `disputes` — Buyer-raised order disputes.
- `product_returns` — RMA process.
- `return_lines` — Items in a return request.
- `product_reviews` — Buyer reviews of products after receiving an order.
- `vendor_reviews` — Buyer reviews of the seller.
- `delivery_reviews` — Reviews of delivery providers.
- `platform_settings` — Singleton row with global platform config.
- `editorial_content` — CMS content pages (CGV, FAQ, legal).
- `saved_searches` — Buyer saved catalogue filters.
- `notifications` — In-app notification feed.
- `audit_logs` — Append-only log of sensitive changes.
*/

-- ─── disputes ────────────────────────────────────────────────────────────────
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
    EXISTS (
      SELECT 1 FROM orders o
      JOIN organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = disputes.order_id AND om.user_id = auth.uid() AND om.active = true
    )
  );

DROP POLICY IF EXISTS "disputes_insert" ON disputes;
CREATE POLICY "disputes_insert" ON disputes FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "disputes_update" ON disputes;
CREATE POLICY "disputes_update" ON disputes FOR UPDATE
  TO authenticated USING (true);

-- ─── product_returns ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_returns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id),
  dispute_id      uuid REFERENCES disputes(id),
  status          text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','authorized','shipped_by_buyer','received_by_seller','inspected','refunded')),
  return_address  jsonb DEFAULT '{}',
  carrier_org_id  uuid REFERENCES organisations(id),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  authorized_at   timestamptz,
  received_at     timestamptz
);

ALTER TABLE product_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "returns_select" ON product_returns;
CREATE POLICY "returns_select" ON product_returns FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "returns_insert" ON product_returns;
CREATE POLICY "returns_insert" ON product_returns FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "returns_update" ON product_returns;
CREATE POLICY "returns_update" ON product_returns FOR UPDATE TO authenticated USING (true);

-- ─── return_lines ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS return_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id       uuid NOT NULL REFERENCES product_returns(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id),
  qty_returned    integer NOT NULL,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE return_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "return_lines_select" ON return_lines;
CREATE POLICY "return_lines_select" ON return_lines FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "return_lines_insert" ON return_lines;
CREATE POLICY "return_lines_insert" ON return_lines FOR INSERT TO authenticated WITH CHECK (true);

-- ─── product_reviews ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES products(id),
  order_id        uuid NOT NULL REFERENCES orders(id),
  buyer_org_id    uuid NOT NULL REFERENCES organisations(id),
  rating          integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  rating_delivery integer CHECK (rating_delivery BETWEEN 1 AND 5),
  rating_quality  integer CHECK (rating_quality BETWEEN 1 AND 5),
  comment         text,
  verified        boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_reviews_select" ON product_reviews;
CREATE POLICY "prod_reviews_select" ON product_reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "prod_reviews_insert" ON product_reviews;
CREATE POLICY "prod_reviews_insert" ON product_reviews FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.organisation_id = product_reviews.buyer_org_id
        AND om.user_id = auth.uid() AND om.active = true
    )
  );

-- ─── vendor_reviews ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id   uuid NOT NULL REFERENCES organisations(id),
  buyer_org_id    uuid NOT NULL REFERENCES organisations(id),
  order_id        uuid NOT NULL REFERENCES orders(id),
  rating_global   integer NOT NULL CHECK (rating_global BETWEEN 1 AND 5),
  rating_service  integer CHECK (rating_service BETWEEN 1 AND 5),
  rating_conformity integer CHECK (rating_conformity BETWEEN 1 AND 5),
  comment         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_reviews_select" ON vendor_reviews;
CREATE POLICY "vendor_reviews_select" ON vendor_reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vendor_reviews_insert" ON vendor_reviews;
CREATE POLICY "vendor_reviews_insert" ON vendor_reviews FOR INSERT
  TO authenticated WITH CHECK (true);

-- ─── delivery_reviews ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_org_id     uuid NOT NULL REFERENCES organisations(id),
  ticket_id           uuid NOT NULL REFERENCES delivery_tickets(id),
  rating_global       integer NOT NULL CHECK (rating_global BETWEEN 1 AND 5),
  rating_punctuality  integer CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_communication integer CHECK (rating_communication BETWEEN 1 AND 5),
  comment             text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "del_reviews_select" ON delivery_reviews;
CREATE POLICY "del_reviews_select" ON delivery_reviews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "del_reviews_insert" ON delivery_reviews;
CREATE POLICY "del_reviews_insert" ON delivery_reviews FOR INSERT TO authenticated WITH CHECK (true);

-- ─── platform_settings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_currency      text NOT NULL DEFAULT 'EUR',
  available_languages   text[] DEFAULT '{"fr","en"}',
  cart_ttl_days         integer DEFAULT 30,
  intraeu_vat_enabled   boolean NOT NULL DEFAULT true,
  vat_rules             jsonb DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_select" ON platform_settings;
CREATE POLICY "platform_settings_select" ON platform_settings FOR SELECT
  TO authenticated USING (true);

INSERT INTO platform_settings DEFAULT VALUES ON CONFLICT DO NOTHING;

-- ─── editorial_content ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_content (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL,
  lang         text NOT NULL DEFAULT 'fr',
  title        text NOT NULL,
  content      text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, lang)
);

ALTER TABLE editorial_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editorial_select" ON editorial_content;
CREATE POLICY "editorial_select" ON editorial_content FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "editorial_insert" ON editorial_content;
CREATE POLICY "editorial_insert" ON editorial_content FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "editorial_update" ON editorial_content;
CREATE POLICY "editorial_update" ON editorial_content FOR UPDATE TO authenticated USING (true);

-- ─── saved_searches ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_searches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  filters         jsonb NOT NULL DEFAULT '{}',
  alert_enabled   boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
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

-- ─── notifications ───────────────────────────────────────────────────────────
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
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

-- ─── audit_logs ──────────────────────────────────────────────────────────────
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
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);
