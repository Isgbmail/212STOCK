-- Migration 032: Admin content_items & org_subtypes tables

-- ── 1. content_items (contenus éditoriaux) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS content_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text NOT NULL
    CHECK (type IN ('banner','popup','highlight','faq','legal','email')),
  title         text NOT NULL,
  subtitle      text,
  body          text,
  cta_label     text,
  cta_url       text,
  image_url     text,
  active        boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

-- Admins can do everything; anon/auth can read active items
DROP POLICY IF EXISTS "content_items_admin" ON content_items;
CREATE POLICY "content_items_admin" ON content_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

DROP POLICY IF EXISTS "content_items_read_active" ON content_items;
CREATE POLICY "content_items_read_active" ON content_items
  FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "content_items_read_active_anon" ON content_items;
CREATE POLICY "content_items_read_active_anon" ON content_items
  FOR SELECT TO anon USING (active = true);

-- ── 2. org_subtypes (types d'acteurs officiels) ─────────────────────────────
CREATE TABLE IF NOT EXISTS org_subtypes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  org_type    text NOT NULL CHECK (org_type IN ('buyer','seller','delivery')),
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, org_type)
);

ALTER TABLE org_subtypes ENABLE ROW LEVEL SECURITY;

-- Admins can manage; everyone can read
DROP POLICY IF EXISTS "org_subtypes_admin" ON org_subtypes;
CREATE POLICY "org_subtypes_admin" ON org_subtypes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

DROP POLICY IF EXISTS "org_subtypes_read" ON org_subtypes;
CREATE POLICY "org_subtypes_read" ON org_subtypes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "org_subtypes_read_anon" ON org_subtypes;
CREATE POLICY "org_subtypes_read_anon" ON org_subtypes
  FOR SELECT TO anon USING (true);

-- Seed with common subtypes
INSERT INTO org_subtypes (name, org_type, description) VALUES
  ('GMS',           'buyer',  'Grande et Moyenne Surface (supermarché, hypermarché)'),
  ('Distributeur',  'buyer',  'Distributeur B2B multi-catégories'),
  ('Importateur',   'buyer',  'Importateur et grossiste'),
  ('Restauration',  'buyer',  'Restaurant, traiteur, CHR'),
  ('E-commerce',    'buyer',  'Boutique en ligne pure player'),
  ('Grossiste',     'seller', 'Grossiste ou centrale d''achat'),
  ('Fabricant',     'seller', 'Producteur ou fabricant direct'),
  ('Importateur',   'seller', 'Importateur revendeur'),
  ('Coopérative',   'seller', 'Coopérative agricole ou artisanale'),
  ('Indépendant',   'delivery', 'Livreur indépendant auto-entrepreneur'),
  ('Société 3PL',   'delivery', 'Société de logistique tierce partie'),
  ('Flotte propre', 'delivery', 'Flotte interne d''un vendeur')
ON CONFLICT (name, org_type) DO NOTHING;
