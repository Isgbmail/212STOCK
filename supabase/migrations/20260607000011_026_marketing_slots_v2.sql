-- Migration 026 : Nouveaux types de campagnes pour les 12 blocs merchandising
-- TopBanner, VentesFlash, ExtraRemise, RecommandéPourVous, Category rows,
-- Déstockage, DealOfDay, FooterBanner, SearchSponsored, CartCrossSell, RFQBoost

-- ── 1. Étendre la contrainte CHECK sur campaigns.type ─────────────────────────
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_type_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_type_check CHECK (
  type IN (
    'sponsored_product','sponsored_brand','sponsored_category','sponsored_boutique',
    'destocking','volume_deal','promo_code','trade_deal','flash_sale',
    'digital_sampling','rfq_boost','cross_sell',
    -- Nouveaux types v2
    'top_banner','deal_of_day','footer_banner','extra_remise',
    'category_row','recommended_slot','search_sponsored','cart_cross_sell'
  )
);

-- ── 2. Nouveaux slots dans ad_inventory_caps ──────────────────────────────────
INSERT INTO public.ad_inventory_caps (placement, daily_slots, description, active)
VALUES
  ('homepage_top_banner',       3,   'Bannière hero pleine largeur — au-dessus du fold', true),
  ('homepage_ventes_flash',    20,   'Bloc ventes flash avec compte à rebours',           true),
  ('homepage_extra_remise',    10,   'Bloc remises supplémentaires / codes promo visuels', true),
  ('homepage_recommended',     50,   'Slots recommandations personnalisées',               true),
  ('homepage_category_row',    30,   'Ligne de produits par catégorie sponsorisée',        true),
  ('homepage_deal_of_day',      1,   'Deal of the Day — offre unique mise en avant',       true),
  ('homepage_footer_banner',    4,   'Bannière bas de page (avant footer)',                true),
  ('search_sponsored',        200,   'Produits sponsorisés injectés dans les résultats',   true),
  ('cart_cross_sell',          50,   'Cross-sell affiché sur la page panier',              true),
  ('rfq_boost_homepage',        5,   'Appels d''offres boostés affichés sur homepage',      true)
ON CONFLICT (placement) DO NOTHING;

-- ── 3. Nouveaux coûts en crédits ─────────────────────────────────────────────
INSERT INTO public.credit_costs (action_type, credits_per_unit, unit, description)
VALUES
  ('top_banner_per_day',        80,  'jour',  'Bannière hero pleine largeur — slot premium'),
  ('deal_of_day_per_slot',     120,  'jour',  'Deal of the Day — exclusivité journalière'),
  ('footer_banner_per_day',     30,  'jour',  'Bannière bas de page'),
  ('extra_remise_per_day',      15,  'jour',  'Bloc extra remise / promo visuelle'),
  ('category_row_per_day',      20,  'jour',  'Ligne catégorie sponsorisée'),
  ('recommended_slot_per_day',  12,  'jour',  'Slot recommandé personnalisé'),
  ('search_sponsored_per_day',  10,  'jour',  'Produit sponsorisé dans recherche'),
  ('cart_cross_sell_per_day',    5,  'jour',  'Cross-sell panier')
ON CONFLICT (action_type) DO NOTHING;

-- ── 4. Index pour les requêtes par type de placement ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_campaigns_type_status_dates
  ON public.campaigns(type, status, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_campaigns_placement_status
  ON public.campaigns(placement, status);
