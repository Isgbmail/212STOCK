/*
  Migration 022 — Module Marketing B2B FMCG
  Toutes les tables du système marketing : campagnes, liquidation, deals,
  produits sponsorisés, flash sales, sampling, RFQ, fidélité, tiers acheteurs,
  crédits vendeurs, inventaire publicitaire.
*/

-- ─── Crédits vendeur sur profiles ────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seller_credits_balance numeric(14,2) NOT NULL DEFAULT 0;

-- ─── Config marketing (singleton) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_config (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_sale_request_threshold integer NOT NULL DEFAULT 10,
  seller_low_credits_pct       numeric(5,2) NOT NULL DEFAULT 10,
  inventory_alert_pct          numeric(5,2) NOT NULL DEFAULT 90,
  promotion_stacking_allowed   boolean NOT NULL DEFAULT false,
  default_platform_fee_pct     numeric(5,2) NOT NULL DEFAULT 3.0,
  min_campaign_duration_days   integer NOT NULL DEFAULT 1,
  max_campaign_duration_days   integer NOT NULL DEFAULT 90,
  buyer_points_per_dollar      numeric(10,4) NOT NULL DEFAULT 0.1,
  updated_at                   timestamptz NOT NULL DEFAULT now()
);
INSERT INTO marketing_config DEFAULT VALUES ON CONFLICT DO NOTHING;

ALTER TABLE marketing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mktcfg_select" ON marketing_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "mktcfg_update" ON marketing_config FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Tiers acheteurs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tiers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL UNIQUE,
  monthly_price          numeric(10,2) NOT NULL DEFAULT 0,
  max_requests_per_month integer NOT NULL DEFAULT 3,
  max_active_campaigns   integer NOT NULL DEFAULT 1,
  max_samples_per_month  integer NOT NULL DEFAULT 1,
  max_rfq_per_month      integer NOT NULL DEFAULT 5,
  priority_queue         boolean NOT NULL DEFAULT false,
  analytics_access       boolean NOT NULL DEFAULT false,
  active                 boolean NOT NULL DEFAULT true,
  display_order          integer NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO tiers (name, monthly_price, max_requests_per_month, max_active_campaigns, max_samples_per_month, max_rfq_per_month, priority_queue, analytics_access, display_order) VALUES
  ('Free',       0,   3,   1,  1,  5,   false, false, 1),
  ('Pro',        49,  20,  5,  3,  20,  true,  true,  2),
  ('Enterprise', 199, 100, 20, 10, 100, true,  true,  3)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiers_select" ON tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "tiers_admin_write" ON tiers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Abonnements acheteurs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS buyer_subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id                  uuid NOT NULL REFERENCES tiers(id),
  start_date               date NOT NULL DEFAULT current_date,
  end_date                 date,
  requests_used_this_month integer NOT NULL DEFAULT 0,
  campaigns_used_this_month integer NOT NULL DEFAULT 0,
  samples_used_this_month  integer NOT NULL DEFAULT 0,
  rfq_used_this_month      integer NOT NULL DEFAULT 0,
  loyalty_points           integer NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_sub_user ON buyer_subscriptions (user_id);

ALTER TABLE buyer_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyer_sub_own"       ON buyer_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "buyer_sub_admin_read" ON buyer_subscriptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Packs de crédits ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_packs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  credits       numeric(14,2) NOT NULL,
  price         numeric(10,2) NOT NULL,
  currency      text NOT NULL DEFAULT 'EUR',
  bonus_credits numeric(14,2) NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO credit_packs (name, credits, price, currency) VALUES
  ('Starter',       500,  49,  'EUR'),
  ('Growth',       2000,  149, 'EUR'),
  ('Pro',          5000,  299, 'EUR'),
  ('Enterprise',  15000,  699, 'EUR')
ON CONFLICT DO NOTHING;

ALTER TABLE credit_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_packs_select" ON credit_packs FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "credit_packs_admin"  ON credit_packs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Plans crédit mensuels vendeurs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  monthly_credits numeric(14,2) NOT NULL,
  monthly_price   numeric(10,2) NOT NULL,
  currency        text NOT NULL DEFAULT 'EUR',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO credit_plans (name, monthly_credits, monthly_price, currency) VALUES
  ('Basic Plan',  1000,  39,  'EUR'),
  ('Growth Plan', 3500,  99,  'EUR'),
  ('Scale Plan',  10000, 249, 'EUR')
ON CONFLICT DO NOTHING;

ALTER TABLE credit_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_plans_select" ON credit_plans FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "credit_plans_admin"  ON credit_plans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Abonnements crédits vendeurs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_credit_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id         uuid NOT NULL REFERENCES credit_plans(id),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  next_renewal_at timestamptz,
  external_sub_id text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seller_credit_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_sub_own"   ON seller_credit_subscriptions FOR ALL TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "seller_sub_admin" ON seller_credit_subscriptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Transactions crédits ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount        numeric(14,2) NOT NULL,
  type          text NOT NULL CHECK (type IN (
    'pack_purchase','subscription_renewal','campaign_deduction','campaign_refund',
    'liquidation_fee','admin_adjustment','sample_deduction','rfq_boost_deduction',
    'loyalty_redemption','cross_sell_deduction','rfq_bid_boost_deduction','tier_purchase'
  )),
  reference_id  uuid,
  description   text,
  balance_after numeric(14,2),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions (user_id, created_at DESC);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_tx_own"   ON credit_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "credit_tx_write" ON credit_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "credit_tx_admin" ON credit_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Coûts en crédits (configurables admin) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_costs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type      text NOT NULL UNIQUE,
  credits_per_unit numeric(10,4) NOT NULL,
  unit             text NOT NULL DEFAULT 'day',
  description      text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO credit_costs (action_type, credits_per_unit, unit, description) VALUES
  ('sponsored_product_per_day',   10,   'day',  'Produit sponsorisé par jour'),
  ('sponsored_brand_per_day',     25,   'day',  'Marque sponsorisée par jour'),
  ('sponsored_category_per_day',  20,   'day',  'Catégorie sponsorisée par jour'),
  ('sponsored_boutique_per_day',  15,   'day',  'Boutique sponsorisée par jour'),
  ('flash_sale_per_day',           8,   'day',  'Flash sale par jour'),
  ('digital_sample_per_unit',      5,   'item', 'Échantillon digital par unité'),
  ('rfq_bid_boost',               20,   'item', 'Boost d''offre RFQ (vendeur)'),
  ('rfq_homepage_boost',          50,   'item', 'Boost RFQ page d''accueil (acheteur)'),
  ('cross_sell_per_day',           3,   'day',  'Règle cross-sell par jour'),
  ('liquidation_fee_pct',          3,   'pct',  'Commission liquidation (%)'),
  ('loyalty_point_value',          0.01,'item', 'Valeur d''un point fidélité en crédits')
ON CONFLICT (action_type) DO UPDATE SET credits_per_unit = EXCLUDED.credits_per_unit, updated_at = now();

ALTER TABLE credit_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_costs_select" ON credit_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "credit_costs_admin"  ON credit_costs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Capacités inventaire publicitaire (admin) ────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_inventory_caps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement   text NOT NULL UNIQUE,
  daily_slots integer NOT NULL DEFAULT 100,
  description text,
  active      boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ad_inventory_caps (placement, daily_slots, description) VALUES
  ('homepage_hero',        10,  'Bannière hero page d''accueil'),
  ('homepage_featured',    20,  'Produits vedettes page d''accueil'),
  ('category_top',         50,  'Haut de page catégorie'),
  ('search_results',      100,  'Résultats de recherche'),
  ('product_sidebar',     200,  'Sidebar page produit'),
  ('cart_recommendations', 30,  'Recommandations panier')
ON CONFLICT (placement) DO NOTHING;

ALTER TABLE ad_inventory_caps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_caps_select" ON ad_inventory_caps FOR SELECT TO authenticated USING (true);
CREATE POLICY "ad_caps_admin"  ON ad_inventory_caps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Inventaire publicitaire (lignes journalières) ────────────────────────────
CREATE TABLE IF NOT EXISTS ad_inventory (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement      text NOT NULL,
  date           date NOT NULL DEFAULT current_date,
  total_slots    integer NOT NULL DEFAULT 100,
  reserved_slots integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement, date)
);

CREATE INDEX IF NOT EXISTS idx_ad_inventory_pd ON ad_inventory (placement, date);

ALTER TABLE ad_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_inv_select" ON ad_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "ad_inv_write"  ON ad_inventory FOR ALL TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ─── Campagnes marketing ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type                text NOT NULL CHECK (type IN (
    'sponsored_product','sponsored_brand','sponsored_category','sponsored_boutique',
    'destocking','volume_deal','promo_code','trade_deal','flash_sale',
    'digital_sampling','rfq_boost','cross_sell'
  )),
  name                text NOT NULL DEFAULT '',
  scope_type          text CHECK (scope_type IN ('item','boutique','brand','category')),
  scope_value         text,
  placement           text NOT NULL DEFAULT 'product_sidebar',
  budget_credits      numeric(14,2) NOT NULL DEFAULT 0,
  spent_credits       numeric(14,2) NOT NULL DEFAULT 0,
  daily_credits       numeric(14,2),
  start_date          date NOT NULL DEFAULT current_date,
  end_date            date,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending','active','paused','completed','cancelled','rejected'
  )),
  metadata            jsonb NOT NULL DEFAULT '{}',
  impressions         integer NOT NULL DEFAULT 0,
  clicks              integer NOT NULL DEFAULT 0,
  orders_attributed   integer NOT NULL DEFAULT 0,
  cancellation_reason text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_seller ON campaigns (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type   ON campaigns (type);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates  ON campaigns (start_date, end_date);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_own"         ON campaigns FOR ALL        TO authenticated USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());
CREATE POLICY "campaigns_admin_read"  ON campaigns FOR SELECT     TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "campaigns_admin_write" ON campaigns FOR UPDATE     TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Demandes de promotion (acheteur) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotion_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type             text NOT NULL CHECK (type IN ('trade','flash_sale')),
  desired_discount numeric(5,2),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','auto_created')),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_req_buyer   ON promotion_requests (buyer_id);
CREATE INDEX IF NOT EXISTS idx_promo_req_product ON promotion_requests (product_id, type);

ALTER TABLE promotion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_req_own"   ON promotion_requests FOR ALL    TO authenticated USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "promo_req_admin" ON promotion_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Lots de liquidation ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liquidation_lots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  campaign_id      uuid REFERENCES campaigns(id),
  title            text NOT NULL,
  description      text,
  scope            text NOT NULL DEFAULT 'item' CHECK (scope IN ('item','product_line','boutique')),
  product_ids      uuid[] DEFAULT '{}',
  sale_type        text NOT NULL DEFAULT 'auction' CHECK (sale_type IN ('auction','fixed_price')),
  start_price      numeric(14,2),
  buy_now_price    numeric(14,2),
  reserve_price    numeric(14,2),
  current_bid      numeric(14,2) DEFAULT 0,
  bid_count        integer NOT NULL DEFAULT 0,
  winner_buyer_id  uuid REFERENCES profiles(id),
  auction_end_at   timestamptz,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','sold','unsold','cancelled')),
  platform_fee_pct numeric(5,2) NOT NULL DEFAULT 3.0,
  images           text[] DEFAULT '{}',
  quantity         integer NOT NULL DEFAULT 1,
  currency         text NOT NULL DEFAULT 'EUR',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lots_seller ON liquidation_lots (seller_id);
CREATE INDEX IF NOT EXISTS idx_lots_status ON liquidation_lots (status, auction_end_at);

ALTER TABLE liquidation_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lots_select_public"  ON liquidation_lots FOR SELECT TO authenticated USING (status IN ('active','sold') OR seller_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "lots_insert_own"     ON liquidation_lots FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "lots_update_own"     ON liquidation_lots FOR UPDATE TO authenticated USING (seller_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Enchères sur lots ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liquidation_bids (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id      uuid NOT NULL REFERENCES liquidation_lots(id) ON DELETE CASCADE,
  bidder_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount      numeric(14,2) NOT NULL,
  is_winning  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bids_lot     ON liquidation_bids (lot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_bidder  ON liquidation_bids (bidder_id);

ALTER TABLE liquidation_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bids_select"  ON liquidation_bids FOR SELECT TO authenticated USING (true);
CREATE POLICY "bids_insert"  ON liquidation_bids FOR INSERT TO authenticated WITH CHECK (bidder_id = auth.uid());

-- ─── Règles cross-sell / upsell ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cross_sell_rules (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type              text NOT NULL DEFAULT 'product_to_product' CHECK (rule_type IN ('product_to_product','category_to_product')),
  trigger_product_id     uuid REFERENCES products(id) ON DELETE CASCADE,
  trigger_category_id    uuid REFERENCES categories(id) ON DELETE CASCADE,
  recommended_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_paid            boolean NOT NULL DEFAULT false,
  credits_bid            numeric(10,2) DEFAULT 0,
  campaign_id            uuid REFERENCES campaigns(id),
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cross_sell_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cross_sell_select" ON cross_sell_rules FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "cross_sell_write"  ON cross_sell_rules FOR ALL    TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ─── Campagnes sampling (échantillonnage) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS sampling_campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES products(id),
  sample_price numeric(10,2) NOT NULL DEFAULT 0,
  shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  max_samples  integer NOT NULL DEFAULT 100,
  samples_sent integer NOT NULL DEFAULT 0,
  auto_approve boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sampling_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sampling_camp_select" ON sampling_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "sampling_camp_write"  ON sampling_campaigns FOR ALL    TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ─── Demandes d'échantillons ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sampling_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sampling_campaign_id uuid NOT NULL REFERENCES sampling_campaigns(id) ON DELETE CASCADE,
  buyer_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','shipped')),
  shipping_address     jsonb DEFAULT '{}',
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sampling_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sampling_req_buyer" ON sampling_requests FOR ALL TO authenticated USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "sampling_req_seller_read" ON sampling_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM sampling_campaigns sc JOIN campaigns c ON c.id = sc.campaign_id
          WHERE sc.id = sampling_requests.sampling_campaign_id AND c.seller_id = auth.uid())
);
CREATE POLICY "sampling_req_seller_update" ON sampling_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM sampling_campaigns sc JOIN campaigns c ON c.id = sc.campaign_id
          WHERE sc.id = sampling_requests.sampling_campaign_id AND c.seller_id = auth.uid())
);

-- ─── Posts RFQ (appels d'offres acheteur) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_name    text NOT NULL,
  category_id     uuid REFERENCES categories(id),
  quantity        integer NOT NULL,
  desired_price   numeric(12,4),
  description     text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','awarded')),
  is_boosted      boolean NOT NULL DEFAULT false,
  boost_expires_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_rfq_buyer  ON rfq_posts (buyer_id);
CREATE INDEX IF NOT EXISTS idx_rfq_status ON rfq_posts (status, created_at DESC);

ALTER TABLE rfq_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfq_select"      ON rfq_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "rfq_insert"      ON rfq_posts FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "rfq_update_own"  ON rfq_posts FOR UPDATE TO authenticated USING (buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Offres sur RFQ (vendeur) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfq_bids (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id            uuid NOT NULL REFERENCES rfq_posts(id) ON DELETE CASCADE,
  seller_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bid_price         numeric(12,4) NOT NULL,
  notes             text,
  is_boosted        boolean NOT NULL DEFAULT false,
  boost_credits_paid numeric(10,2) DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rfq_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rfq_bids_select"      ON rfq_bids FOR SELECT TO authenticated USING (true);
CREATE POLICY "rfq_bids_insert"      ON rfq_bids FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "rfq_bids_update_own"  ON rfq_bids FOR UPDATE TO authenticated USING (seller_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Transactions fidélité ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points       integer NOT NULL,
  type         text NOT NULL CHECK (type IN ('earn_order','redeem_requests','redeem_credits','admin_adjust')),
  reference_id uuid,
  description  text,
  balance_after integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_transactions (user_id, created_at DESC);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_own"   ON loyalty_transactions FOR ALL    TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "loyalty_admin" ON loyalty_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── Notifications admin marketing ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_marketing_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN (
    'buyer_tier_upgrade','buyer_limit_reached','seller_credits_low',
    'inventory_nearly_full','promotion_budget_depleted','flash_sale_threshold_reached'
  )),
  message     text NOT NULL,
  entity_type text,
  entity_id   uuid,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_marketing_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_mkt_notif_read"   ON admin_marketing_notifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "admin_mkt_notif_insert" ON admin_marketing_notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_mkt_notif_update" ON admin_marketing_notifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ─── CRON JOBS (commentaires de setup) ───────────────────────────────────────
-- À configurer dans Supabase Cron (Extensions > pg_cron) :
--
-- 1. Réinitialisation inventaire publicitaire (minuit chaque jour) :
--    SELECT cron.schedule('reset-ad-inventory', '0 0 * * *', $$
--      INSERT INTO ad_inventory (placement, date, total_slots, reserved_slots)
--      SELECT placement, current_date + 1, daily_slots, 0
--      FROM ad_inventory_caps WHERE active = true
--      ON CONFLICT (placement, date) DO UPDATE SET reserved_slots = 0;
--    $$);
--
-- 2. Réinitialisation compteurs acheteurs mensuels (1er de chaque mois) :
--    SELECT cron.schedule('reset-buyer-monthly', '0 0 1 * *', $$
--      UPDATE buyer_subscriptions SET
--        requests_used_this_month = 0,
--        campaigns_used_this_month = 0,
--        samples_used_this_month = 0,
--        rfq_used_this_month = 0,
--        updated_at = now();
--    $$);
--
-- 3. Clôture automatique des enchères expirées (toutes les 5 min) :
--    SELECT cron.schedule('close-expired-auctions', '*/5 * * * *', $$
--      UPDATE liquidation_lots SET status = CASE WHEN bid_count > 0 THEN 'sold' ELSE 'unsold' END,
--        updated_at = now()
--      WHERE sale_type = 'auction' AND status = 'active' AND auction_end_at < now();
--    $$);
--
-- 4. Marquer campagnes terminées (minuit) :
--    SELECT cron.schedule('complete-campaigns', '5 0 * * *', $$
--      UPDATE campaigns SET status = 'completed', updated_at = now()
--      WHERE status = 'active' AND end_date < current_date;
--    $$);
