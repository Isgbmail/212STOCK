-- Migration 035: Données statiques en base — carriers, brands enrichis,
-- templates de résolution de litiges, content_items (bannières + remises)

-- ── 1. Enrichir la table brands ─────────────────────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS initials          text,
  ADD COLUMN IF NOT EXISTS primary_color     text         NOT NULL DEFAULT '#1a5c8f',
  ADD COLUMN IF NOT EXISTS tagline           text,
  ADD COLUMN IF NOT EXISTS country           text         NOT NULL DEFAULT 'Maroc',
  ADD COLUMN IF NOT EXISTS founding_year     integer,
  ADD COLUMN IF NOT EXISTS is_active         boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified       boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured       boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS categories        text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications    text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_market     text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_segment     text         NOT NULL DEFAULT 'Moyen',
  ADD COLUMN IF NOT EXISTS brand_values      text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS channels          text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS export_countries  text[]       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moq               text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_conditions text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_title        text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meta_desc         text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS keywords          text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS visibility        text         NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','draft','archived')),
  ADD COLUMN IF NOT EXISTS website           text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email             text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone             text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instagram         text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tiktok            text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS facebook          text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkedin          text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS youtube           text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS video_url         text         NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gallery           text[]       NOT NULL DEFAULT '{}';

-- ── 2. Seed brands (Copag, Aïcha, Koutoubia) ────────────────────────────────
INSERT INTO brands (
  name, description, initials, primary_color,
  tagline, country, founding_year,
  is_active, is_verified, is_featured,
  categories, certifications,
  target_market, price_segment, brand_values,
  channels, export_countries,
  moq, payment_conditions,
  visibility, website, email, phone, instagram, facebook
) VALUES
  (
    'Copag', 'Leader du secteur laitier au Maroc.', 'CP', '#1a5c8f',
    'La qualité laitière marocaine', 'Maroc', 1995,
    true, true, true,
    ARRAY['Laitiers', 'Desserts'], ARRAY['ONSSA', 'HACCP', 'ISO 22000'],
    'GMS / HORECA / Export', 'Moyen', ARRAY['Qualité', 'Traçabilité'],
    ARRAY['GMS', 'HORECA'], ARRAY['France', 'Espagne'],
    '48', 'Virement 30j',
    'public', 'www.copag.ma', 'contact@copag.ma', '+212 522 001 001', '@copag.maroc', '/copag.maroc'
  ),
  (
    'Aïcha', 'Marque iconique de conserves et confitures marocaines.', 'AI', '#c97d1a',
    'Le goût authentique marocain', 'Maroc', 1961,
    true, true, false,
    ARRAY['Épicerie', 'Conserves'], ARRAY['ONSSA', 'Halal'],
    'GMS / Export', 'Accessible', ARRAY['Authenticité', 'Tradition'],
    ARRAY['GMS', 'Export'], ARRAY['France', 'Canada', 'Belgique'],
    '24', 'COD / Virement 15j',
    'public', 'www.aicha.ma', '', '', '', ''
  ),
  (
    'Koutoubia', 'Premier groupe avicole marocain.', 'KO', '#b91c1c',
    'Fraîcheur garantie, qualité certifiée', 'Maroc', 1976,
    false, true, false,
    ARRAY['Frais', 'Viandes'], ARRAY['Halal', 'ONSSA'],
    'GMS / HORECA', 'Moyen', ARRAY['Fraîcheur', 'Halal garanti'],
    ARRAY['GMS', 'HORECA', 'Collectivités'], ARRAY[]::text[],
    '10', 'Virement 7j',
    'draft', '', '', '', '', ''
  )
ON CONFLICT (name) DO UPDATE SET
  initials          = EXCLUDED.initials,
  primary_color     = EXCLUDED.primary_color,
  tagline           = EXCLUDED.tagline,
  country           = EXCLUDED.country,
  founding_year     = EXCLUDED.founding_year,
  is_active         = EXCLUDED.is_active,
  is_verified       = EXCLUDED.is_verified,
  is_featured       = EXCLUDED.is_featured,
  categories        = EXCLUDED.categories,
  certifications    = EXCLUDED.certifications,
  target_market     = EXCLUDED.target_market,
  price_segment     = EXCLUDED.price_segment,
  brand_values      = EXCLUDED.brand_values,
  channels          = EXCLUDED.channels,
  export_countries  = EXCLUDED.export_countries,
  moq               = EXCLUDED.moq,
  payment_conditions = EXCLUDED.payment_conditions,
  visibility        = EXCLUDED.visibility,
  website           = EXCLUDED.website,
  email             = EXCLUDED.email,
  phone             = EXCLUDED.phone,
  instagram         = EXCLUDED.instagram,
  facebook          = EXCLUDED.facebook;

-- ── 3. Créer la table carriers ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carriers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL UNIQUE,
  type            text        NOT NULL DEFAULT 'external'
    CHECK (type IN ('external', 'internal', '3pl')),
  regions         text[]      NOT NULL DEFAULT '{}',
  cold_chain      boolean     NOT NULL DEFAULT false,
  urgent          boolean     NOT NULL DEFAULT false,
  price_per_kg    numeric(10,2) NOT NULL DEFAULT 0,
  avg_days        integer     NOT NULL DEFAULT 1,
  phone           text,
  driver_name     text,
  vehicle         text,
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carriers_select" ON carriers
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "carriers_admin" ON carriers
  FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ── 4. Seed carriers ─────────────────────────────────────────────────────────
INSERT INTO carriers (name, type, regions, cold_chain, urgent, price_per_kg, avg_days, phone)
VALUES
  ('Amana Express',    'external', ARRAY['Casablanca', 'Rabat', 'Tanger', 'Fès', 'Marrakech'], false, true,  12, 1, '+212 522 001 001'),
  ('TMSA Logistics',   'external', ARRAY['Casablanca', 'Rabat', 'Agadir', 'Oujda'],             true,  false, 18, 2, '+212 537 002 002'),
  ('CTM Cargo',        'external', ARRAY['Toutes régions'],                                      false, false, 8,  3, '+212 522 003 003'),
  ('Maroc Cold Chain', 'external', ARRAY['Casablanca', 'Rabat', 'Marrakech'],                    true,  true,  25, 1, '+212 522 004 004')
ON CONFLICT (name) DO NOTHING;

INSERT INTO carriers (name, type, regions, cold_chain, urgent, price_per_kg, avg_days, phone, driver_name, vehicle)
VALUES
  ('Ali Hajji — Camion réfrigéré', 'internal', ARRAY['Grand Casablanca'],         true,  false, 0, 1, '+212 661 001 001', 'Ali Hajji',      'Mercedes Sprinter réfrigéré — A 1234 B'),
  ('Youssef Amrani — Fourgon',     'internal', ARRAY['Grand Casablanca', 'Rabat'], false, true,  0, 1, '+212 662 002 002', 'Youssef Amrani', 'Renault Master — A 5678 C')
ON CONFLICT (name) DO NOTHING;

-- ── 5. Créer la table dispute_resolution_templates ───────────────────────────
CREATE TABLE IF NOT EXISTS dispute_resolution_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text        NOT NULL UNIQUE,
  body       text        NOT NULL,
  verdict    text        NOT NULL,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dispute_resolution_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drt_select" ON dispute_resolution_templates
  FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "drt_admin" ON dispute_resolution_templates
  FOR ALL TO authenticated
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ── 6. Seed dispute_resolution_templates ─────────────────────────────────────
INSERT INTO dispute_resolution_templates (label, body, verdict) VALUES
  (
    'Marchandise non conforme',
    'Après examen du dossier, les marchandises livrées ne correspondent pas à la description du produit commandé. L''acheteur sera remboursé intégralement. Le vendeur est notifié et invité à corriger sa fiche produit.',
    'refund_buyer'
  ),
  (
    'Quantité manquante',
    'La livraison est incomplète. La différence de quantité est avérée. L''acheteur sera remboursé à hauteur du manquant. Le vendeur devra effectuer une livraison complémentaire ou accepter le remboursement partiel.',
    'refund_buyer_partial'
  ),
  (
    'Litige non justifié',
    'Après vérification, la commande a été livrée conformément aux termes convenus. Aucune action corrective n''est requise. Le litige est classé sans suite.',
    'no_action'
  ),
  (
    'Retard de livraison',
    'La livraison a été effectuée avec un retard significatif par rapport au délai annoncé. Un geste commercial (avoir ou remboursement partiel des frais de livraison) est accordé à l''acheteur.',
    'refund_buyer_partial'
  ),
  (
    'Produit endommagé',
    'Les marchandises sont arrivées endommagées. Après examen des preuves photographiques fournies, la responsabilité est partagée entre le vendeur (emballage insuffisant) et le livreur. Un remboursement partiel est accordé.',
    'shared'
  )
ON CONFLICT (label) DO NOTHING;

-- ── 7. Seed content_items : bannières top + footer ───────────────────────────
INSERT INTO content_items (type, title, subtitle, body, cta_label, cta_url, active, display_order)
VALUES
  (
    'banner',
    'Stock212 — Marketplace B2B FMCG',
    'Accédez à 10 000+ références, prix dégressifs MOQ, livreurs certifiés.',
    '{"banner_position":"top","bg":"linear-gradient(135deg, #0d1f38 0%, #1a3558 60%, #254b7a 100%)","accentColor":"#c97d1a"}',
    'Explorer le catalogue', '/catalog', true, 1
  ),
  (
    'banner',
    'Produits Bio & Certifiés',
    'ECOCERT, Fairtrade, GlobalG.A.P. — Vérifiés et sourcés directement.',
    '{"banner_position":"top","bg":"linear-gradient(135deg, #1a5c35 0%, #14532d 60%, #166534 100%)","accentColor":"#4ade80"}',
    'Voir les produits Bio', '/catalog?cert=Bio', true, 2
  ),
  (
    'banner',
    'Déstockage — Stocks à saisir',
    'Produits en fin de série, lots spéciaux. Quantités limitées.',
    '{"banner_position":"top","bg":"linear-gradient(135deg, #be1c1c 0%, #9b1c1c 60%, #7f1d1d 100%)","accentColor":"#fca5a5"}',
    'Voir le déstockage', '/best-deals', true, 3
  ),
  (
    'banner',
    'Développez votre réseau de fournisseurs',
    'Rejoignez 500+ acheteurs qualifiés sur Stock212.',
    '{"banner_position":"footer","bg":"linear-gradient(135deg, #1a5c35 0%, #14532d 100%)","accentColor":"#4ade80"}',
    'Découvrir', '/auth', true, 10
  )
ON CONFLICT DO NOTHING;

-- ── 8. Seed content_items : remises / highlights ──────────────────────────────
INSERT INTO content_items (type, title, body, active, display_order)
VALUES
  ('highlight', '-15% dès 500€',  '{"code":"STOCK15",   "color":"#be1c1c","desc":"Sur toute commande ≥ 500 €"}', true, 1),
  ('highlight', '-20% Nouveau',   '{"code":"BIENVENUE", "color":"#0f766e","desc":"1ère commande seulement"}',    true, 2),
  ('highlight', 'Franco ≥ 300€',  '{"code":null,        "color":"#1a5c35","desc":"Livraison offerte · France"}', true, 3),
  ('highlight', 'Pack démo',      '{"code":"DEMO10",    "color":"#6366f1","desc":"-10% sur les échantillons"}',  true, 4)
ON CONFLICT DO NOTHING;
