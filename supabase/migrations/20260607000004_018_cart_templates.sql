-- Migration 018 — Add template support to carts
-- Allows MesPaniersPage to persist named cart templates in Supabase.
-- is_template = true  → saved template (managed by MesPaniersPage)
-- is_template = false → live shopping cart (managed by useCart hook)

ALTER TABLE carts ADD COLUMN IF NOT EXISTS name              text;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS is_template       boolean     NOT NULL DEFAULT false;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS order_count       integer     NOT NULL DEFAULT 0;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS last_ordered_at   timestamptz;

-- Index to speed up template listing per buyer org
CREATE INDEX IF NOT EXISTS idx_carts_templates
  ON carts (buyer_org_id, is_template)
  WHERE is_template = true;

-- RLS already covered by migration 015 — no new policies needed.
