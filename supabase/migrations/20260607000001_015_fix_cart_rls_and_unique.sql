-- Migration 015 — Fix cart RLS policies + add UNIQUE constraint on cart_items
-- Root causes of "Impossible de créer le panier":
--   1. carts_insert policy used old EXISTS(organisation_members) pattern, which can fail
--      when combined with the recursion-safe org_members_select from migration 008/009.
--   2. cart_items UNIQUE(cart_id, product_id) was missing, so upsert({ onConflict: ... })
--      silently fell back to an INSERT and could error.

-- ─── carts: all policies → use get_user_org_ids() ────────────────────────────
DROP POLICY IF EXISTS "carts_insert" ON carts;
CREATE POLICY "carts_insert" ON carts FOR INSERT
  TO authenticated WITH CHECK (
    buyer_org_id = ANY(public.get_user_org_ids())
  );

DROP POLICY IF EXISTS "carts_select" ON carts;
CREATE POLICY "carts_select" ON carts FOR SELECT
  TO authenticated USING (
    buyer_org_id = ANY(public.get_user_org_ids())
  );

DROP POLICY IF EXISTS "carts_update" ON carts;
CREATE POLICY "carts_update" ON carts FOR UPDATE
  TO authenticated USING (
    buyer_org_id = ANY(public.get_user_org_ids())
  );

DROP POLICY IF EXISTS "carts_delete" ON carts;
CREATE POLICY "carts_delete" ON carts FOR DELETE
  TO authenticated USING (
    buyer_org_id = ANY(public.get_user_org_ids())
  );

-- ─── cart_items: all policies → use get_user_org_ids() via carts subquery ─────
DROP POLICY IF EXISTS "cart_items_select" ON cart_items;
CREATE POLICY "cart_items_select" ON cart_items FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM carts c
      WHERE c.id = cart_items.cart_id
        AND c.buyer_org_id = ANY(public.get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "cart_items_insert" ON cart_items;
CREATE POLICY "cart_items_insert" ON cart_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts c
      WHERE c.id = cart_items.cart_id
        AND c.buyer_org_id = ANY(public.get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "cart_items_update" ON cart_items;
CREATE POLICY "cart_items_update" ON cart_items FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM carts c
      WHERE c.id = cart_items.cart_id
        AND c.buyer_org_id = ANY(public.get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "cart_items_delete" ON cart_items;
CREATE POLICY "cart_items_delete" ON cart_items FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM carts c
      WHERE c.id = cart_items.cart_id
        AND c.buyer_org_id = ANY(public.get_user_org_ids())
    )
  );

-- ─── UNIQUE constraint so upsert({ onConflict: 'cart_id,product_id' }) works ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_items_cart_product_unique'
      AND conrelid = 'cart_items'::regclass
  ) THEN
    ALTER TABLE cart_items ADD CONSTRAINT cart_items_cart_product_unique UNIQUE (cart_id, product_id);
  END IF;
END $$;
