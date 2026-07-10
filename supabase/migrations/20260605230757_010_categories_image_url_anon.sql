-- Add image_url column to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url text;

-- Allow anonymous (unauthenticated) users to read categories and products
-- so the storefront works for guests
DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select_auth" ON categories FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "categories_select_anon" ON categories FOR SELECT
  TO anon USING (active = true);

-- Allow anon to read active products (price_tiers hidden via app logic, not RLS)
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select_auth" ON products FOR SELECT
  TO authenticated USING (status = 'active' OR EXISTS (
    SELECT 1 FROM organisation_members om
    WHERE om.organisation_id = products.seller_org_id
      AND om.user_id = auth.uid() AND om.active = true
  ));
CREATE POLICY "products_select_anon" ON products FOR SELECT
  TO anon USING (status = 'active');

-- Allow anon to read brands (used in product detail)
DROP POLICY IF EXISTS "brands_select" ON brands;
CREATE POLICY "brands_select_auth" ON brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "brands_select_anon" ON brands FOR SELECT TO anon USING (true);

-- Allow anon to read organisations (seller names shown in cards)
DROP POLICY IF EXISTS "organisations_public_select" ON organisations;
CREATE POLICY "organisations_public_select_anon" ON organisations FOR SELECT
  TO anon USING (validation_status = 'active');

-- Seed representative image_url values for top-level and sub categories
UPDATE categories SET image_url = 'https://images.pexels.com/photos/1640774/pexels-photo-1640774.jpeg'
  WHERE name = 'Food' AND parent_id IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/6802042/pexels-photo-6802042.jpeg'
  WHERE name = 'Non-Food' AND parent_id IS NULL;
UPDATE categories SET image_url = 'https://images.pexels.com/photos/1346155/pexels-photo-1346155.jpeg'
  WHERE name = 'Boissons';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'
  WHERE name = 'Épicerie sèche';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg'
  WHERE name = 'Produits laitiers';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/618775/pexels-photo-618775.jpeg'
  WHERE name = 'Boucherie & Charcuterie';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/1300972/pexels-photo-1300972.jpeg'
  WHERE name = 'Fruits & Légumes';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/3736173/pexels-photo-3736173.jpeg'
  WHERE name = 'Surgelés';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/4033148/pexels-photo-4033148.jpeg'
  WHERE name = 'Conserves';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/3952232/pexels-photo-3952232.jpeg'
  WHERE name = 'Hygiène';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/4239091/pexels-photo-4239091.jpeg'
  WHERE name = 'Entretien';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/4068309/pexels-photo-4068309.jpeg'
  WHERE name = 'Emballages';
UPDATE categories SET image_url = 'https://images.pexels.com/photos/5632398/pexels-photo-5632398.jpeg'
  WHERE name = 'Papeterie';
