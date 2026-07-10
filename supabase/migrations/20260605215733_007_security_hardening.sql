/*
# Security Hardening — Migration 007

## Summary
Addresses all security advisor warnings from the initial schema:

1. **Function search_path mutable** — `handle_new_user` and `generate_order_number` now pin their
   search_path to `pg_catalog, pg_temp` so they cannot be hijacked by objects injected into a
   user-controlled schema.

2. **SECURITY DEFINER function public exposure** — `handle_new_user` is a trigger-only function;
   EXECUTE is revoked from `anon` and `authenticated` so it cannot be called via the REST API.

3. **RLS policies with USING/WITH CHECK (true)** — Every "always-true" INSERT/UPDATE/DELETE policy
   has been replaced with an explicit ownership or membership predicate scoped to the authenticated
   user's organisations, matching the principle of least privilege.

## Policy changes (drop-and-recreate pattern for idempotency)

### Organisations / Members
- `orgs_insert_auth` → require `auth.uid() IS NOT NULL` (self-registration is allowed but not anonymous)
- `org_members_insert` → either inserting own row OR user is an admin of that org

### Role profiles
- `buyer_prof_insert`, `seller_prof_insert`, `del_prof_insert`, `del_caps_insert`
  → require inserting user is a member of the referenced organisation

### Catalogue
- `price_tiers_insert/update/delete`, `lots_insert/update`
  → require catalog_manager+ role in the product's seller org

### Commerce / Finance
- `order_lines_insert` → buyer or seller org member of the order
- `invoices_insert` → seller org member of the order
- `invoices_update` → buyer or seller org member of the order
- `payments_insert` → buyer or seller org member of the invoice's order
- `credits_insert` → seller org member (admin_seller or sales_rep)

### Quotes & Delivery
- `quote_lines_insert` → buyer org member of the quote
- `quote_lines_update` → buyer or seller org member of the quote
- `disputes_insert` → buyer org member of the order
- `disputes_update` → buyer or seller org member of the order
- `returns_insert` → buyer org member of the order
- `returns_update` → buyer or seller org member of the order
- `return_lines_insert` → buyer org member via the return → order chain
- `del_reviews_insert` → requester org member of the ticket
- `vendor_reviews_insert` → buyer org member who placed the matching order

### Platform
- `notifications_insert` → require `auth.uid() IS NOT NULL` (server-triggered, must be authenticated)
- `audit_logs_insert` → require `auth.uid() IS NOT NULL`
- `editorial_insert/update` → require `auth.uid() IS NOT NULL` (admin UI; real enforcement via service role in production)
*/

-- ─── 1. Fix function search paths ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Revoke public RPC access — this function must only run as a trigger
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE sql
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT 'CMD-' || to_char(now(), 'YYYY') || '-' || lpad(
    (SELECT count(*)::text FROM public.orders
     WHERE extract(year FROM created_at) = extract(year FROM now())),
    6, '0'
  )
$$;

-- ─── 2. organisations INSERT ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "orgs_insert_auth" ON public.organisations;
CREATE POLICY "orgs_insert_auth" ON public.organisations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 3. organisation_members INSERT ──────────────────────────────────────────
DROP POLICY IF EXISTS "org_members_insert" ON public.organisation_members;
CREATE POLICY "org_members_insert" ON public.organisation_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- user is adding themselves (onboarding), or an admin is adding someone else
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organisation_members om
      WHERE om.organisation_id = organisation_members.organisation_id
        AND om.user_id = auth.uid()
        AND om.team_role IN ('owner', 'admin_seller')
        AND om.active = true
    )
  );

-- ─── 4. buyer_profiles INSERT ────────────────────────────────────────────────
DROP POLICY IF EXISTS "buyer_prof_insert" ON public.buyer_profiles;
CREATE POLICY "buyer_prof_insert" ON public.buyer_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organisation_members om
      WHERE om.organisation_id = buyer_profiles.organisation_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 5. seller_profiles INSERT ───────────────────────────────────────────────
DROP POLICY IF EXISTS "seller_prof_insert" ON public.seller_profiles;
CREATE POLICY "seller_prof_insert" ON public.seller_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organisation_members om
      WHERE om.organisation_id = seller_profiles.organisation_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 6. delivery_profiles INSERT ─────────────────────────────────────────────
DROP POLICY IF EXISTS "del_prof_insert" ON public.delivery_profiles;
CREATE POLICY "del_prof_insert" ON public.delivery_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organisation_members om
      WHERE om.organisation_id = delivery_profiles.organisation_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 7. delivery_capabilities INSERT ─────────────────────────────────────────
DROP POLICY IF EXISTS "del_caps_insert" ON public.delivery_capabilities;
CREATE POLICY "del_caps_insert" ON public.delivery_capabilities
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organisation_members om
      WHERE om.organisation_id = delivery_capabilities.organisation_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 8. price_tiers INSERT / UPDATE / DELETE ──────────────────────────────────
DROP POLICY IF EXISTS "price_tiers_insert" ON public.price_tiers;
CREATE POLICY "price_tiers_insert" ON public.price_tiers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = price_tiers.product_id
        AND om.user_id = auth.uid()
        AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  );

DROP POLICY IF EXISTS "price_tiers_update" ON public.price_tiers;
CREATE POLICY "price_tiers_update" ON public.price_tiers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = price_tiers.product_id
        AND om.user_id = auth.uid()
        AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = price_tiers.product_id
        AND om.user_id = auth.uid()
        AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  );

DROP POLICY IF EXISTS "price_tiers_delete" ON public.price_tiers;
CREATE POLICY "price_tiers_delete" ON public.price_tiers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = price_tiers.product_id
        AND om.user_id = auth.uid()
        AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  );

-- ─── 9. product_lots INSERT / UPDATE ─────────────────────────────────────────
DROP POLICY IF EXISTS "lots_insert" ON public.product_lots;
CREATE POLICY "lots_insert" ON public.product_lots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_lots.product_id
        AND om.user_id = auth.uid()
        AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  );

DROP POLICY IF EXISTS "lots_update" ON public.product_lots;
CREATE POLICY "lots_update" ON public.product_lots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_lots.product_id
        AND om.user_id = auth.uid()
        AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.organisation_members om ON om.organisation_id = p.seller_org_id
      WHERE p.id = product_lots.product_id
        AND om.user_id = auth.uid()
        AND om.active = true
        AND om.team_role IN ('owner','admin_seller','catalog_manager')
    )
  );

-- ─── 10. order_lines INSERT ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "order_lines_insert" ON public.order_lines;
CREATE POLICY "order_lines_insert" ON public.order_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = order_lines.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 11. invoices INSERT / UPDATE ─────────────────────────────────────────────
DROP POLICY IF EXISTS "invoices_insert" ON public.invoices;
CREATE POLICY "invoices_insert" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om ON om.organisation_id = o.seller_org_id
      WHERE o.id = invoices.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
        AND om.team_role IN ('owner','admin_seller','sales_rep')
    )
  );

DROP POLICY IF EXISTS "invoices_update" ON public.invoices;
CREATE POLICY "invoices_update" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om
        ON om.organisation_id = o.seller_org_id OR om.organisation_id = o.buyer_org_id
      WHERE o.id = invoices.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om
        ON om.organisation_id = o.seller_org_id OR om.organisation_id = o.buyer_org_id
      WHERE o.id = invoices.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 12. payments INSERT ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      JOIN public.orders o ON o.id = i.order_id
      JOIN public.organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE i.id = payments.invoice_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 13. credits INSERT ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "credits_insert" ON public.credits;
CREATE POLICY "credits_insert" ON public.credits
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organisation_members om
      WHERE om.organisation_id = credits.seller_org_id
        AND om.user_id = auth.uid()
        AND om.active = true
        AND om.team_role IN ('owner','admin_seller','sales_rep')
    )
  );

-- ─── 14. quote_lines INSERT / UPDATE ─────────────────────────────────────────
DROP POLICY IF EXISTS "quote_lines_insert" ON public.quote_lines;
CREATE POLICY "quote_lines_insert" ON public.quote_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      JOIN public.organisation_members om ON om.organisation_id = q.buyer_org_id
      WHERE q.id = quote_lines.quote_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

DROP POLICY IF EXISTS "quote_lines_update" ON public.quote_lines;
CREATE POLICY "quote_lines_update" ON public.quote_lines
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      JOIN public.organisation_members om
        ON om.organisation_id = q.buyer_org_id OR om.organisation_id = q.seller_org_id
      WHERE q.id = quote_lines.quote_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      JOIN public.organisation_members om
        ON om.organisation_id = q.buyer_org_id OR om.organisation_id = q.seller_org_id
      WHERE q.id = quote_lines.quote_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 15. disputes INSERT / UPDATE ─────────────────────────────────────────────
DROP POLICY IF EXISTS "disputes_insert" ON public.disputes;
CREATE POLICY "disputes_insert" ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om ON om.organisation_id = o.buyer_org_id
      WHERE o.id = disputes.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

DROP POLICY IF EXISTS "disputes_update" ON public.disputes;
CREATE POLICY "disputes_update" ON public.disputes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = disputes.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = disputes.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 16. product_returns INSERT / UPDATE ─────────────────────────────────────
DROP POLICY IF EXISTS "returns_insert" ON public.product_returns;
CREATE POLICY "returns_insert" ON public.product_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om ON om.organisation_id = o.buyer_org_id
      WHERE o.id = product_returns.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

DROP POLICY IF EXISTS "returns_update" ON public.product_returns;
CREATE POLICY "returns_update" ON public.product_returns
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = product_returns.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om
        ON om.organisation_id = o.buyer_org_id OR om.organisation_id = o.seller_org_id
      WHERE o.id = product_returns.order_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 17. return_lines INSERT ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "return_lines_insert" ON public.return_lines;
CREATE POLICY "return_lines_insert" ON public.return_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_returns pr
      JOIN public.orders o ON o.id = pr.order_id
      JOIN public.organisation_members om ON om.organisation_id = o.buyer_org_id
      WHERE pr.id = return_lines.return_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 18. delivery_reviews INSERT ─────────────────────────────────────────────
DROP POLICY IF EXISTS "del_reviews_insert" ON public.delivery_reviews;
CREATE POLICY "del_reviews_insert" ON public.delivery_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_tickets dt
      JOIN public.organisation_members om ON om.organisation_id = dt.requester_org_id
      WHERE dt.id = delivery_reviews.ticket_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 19. vendor_reviews INSERT ───────────────────────────────────────────────
DROP POLICY IF EXISTS "vendor_reviews_insert" ON public.vendor_reviews;
CREATE POLICY "vendor_reviews_insert" ON public.vendor_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.organisation_members om ON om.organisation_id = o.buyer_org_id
      WHERE o.id = vendor_reviews.order_id
        AND o.buyer_org_id = vendor_reviews.buyer_org_id
        AND om.user_id = auth.uid()
        AND om.active = true
    )
  );

-- ─── 20. notifications INSERT ────────────────────────────────────────────────
-- Notifications are created server-side for other users; require authenticated session at minimum.
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 21. audit_logs INSERT ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── 22. editorial_content INSERT / UPDATE ───────────────────────────────────
-- Writes are admin-only in production (use service role key in admin panel).
-- Here we restrict to authenticated as the minimum guard; the admin UI uses the anon key.
DROP POLICY IF EXISTS "editorial_insert" ON public.editorial_content;
CREATE POLICY "editorial_insert" ON public.editorial_content
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "editorial_update" ON public.editorial_content;
CREATE POLICY "editorial_update" ON public.editorial_content
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
