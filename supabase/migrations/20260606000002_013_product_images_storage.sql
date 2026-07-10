/*
# Migration 13: Product images storage bucket

Creates a public storage bucket for product images with vendor-scoped policies.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access (DROP before CREATE — IF NOT EXISTS not supported on policies)
DROP POLICY IF EXISTS "product_images_public_select" ON storage.objects;
CREATE POLICY "product_images_public_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- Authenticated vendors can upload
DROP POLICY IF EXISTS "product_images_vendor_insert" ON storage.objects;
CREATE POLICY "product_images_vendor_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Vendors can delete their own images
DROP POLICY IF EXISTS "product_images_vendor_delete" ON storage.objects;
CREATE POLICY "product_images_vendor_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
