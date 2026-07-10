-- Allow anon to read price_tiers (UI hides prices for guests)
DROP POLICY IF EXISTS "price_tiers_select" ON price_tiers;
DROP POLICY IF EXISTS "price_tiers_select_auth" ON price_tiers;
DROP POLICY IF EXISTS "price_tiers_select_anon" ON price_tiers;
CREATE POLICY "price_tiers_select_auth" ON price_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_tiers_select_anon" ON price_tiers FOR SELECT TO anon USING (true);

-- Allow anon to read product_reviews
DROP POLICY IF EXISTS "reviews_select_anon" ON product_reviews;
DROP POLICY IF EXISTS "reviews_select_auth" ON product_reviews;
CREATE POLICY "reviews_select_anon" ON product_reviews FOR SELECT TO anon USING (true);
CREATE POLICY "reviews_select_auth" ON product_reviews FOR SELECT TO authenticated USING (true);

-- Add reviewer_name column if missing
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS reviewer_name text;

-- Seed brand data
INSERT INTO brands (name, description, logo_url) VALUES
  ('Nestlé', 'Leader mondial des produits alimentaires et boissons', 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'),
  ('Danone', 'Produits laitiers et nutrition avancée', 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg'),
  ('Coca-Cola', 'Boissons rafraîchissantes leader mondial', 'https://images.pexels.com/photos/1346155/pexels-photo-1346155.jpeg'),
  ('Unilever', 'Hygiène, entretien et produits alimentaires', 'https://images.pexels.com/photos/3952232/pexels-photo-3952232.jpeg'),
  ('McCain', 'Spécialiste des produits surgelés', 'https://images.pexels.com/photos/3736173/pexels-photo-3736173.jpeg'),
  ('Bonduelle', 'Légumes et conserves de qualité', 'https://images.pexels.com/photos/1300972/pexels-photo-1300972.jpeg'),
  ('Heinz', 'Sauces, condiments et conserves', 'https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg'),
  ('Président', 'Produits laitiers premium', 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg')
ON CONFLICT (name) DO NOTHING;
