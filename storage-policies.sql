-- Storage Bucket Policies for company-assets
-- Run this AFTER creating the bucket in Supabase Dashboard > Storage
-- Bucket name: company-assets (must be created manually first!)

-- =====================================================
-- IMPORTANT: Create bucket first via Supabase Dashboard!
-- Storage → New bucket → Name: company-assets → Public: YES
-- =====================================================

-- Policy 1: Allow everyone to VIEW images (Public Read)
CREATE POLICY "Public can view company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');

-- Policy 2: Only MANAGERS can UPLOAD images
CREATE POLICY "Only managers can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' 
  AND (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  ) = 'manager'
);

-- Policy 3: Only MANAGERS can DELETE images
CREATE POLICY "Managers can delete company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets' 
  AND (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  ) = 'manager'
);

-- Policy 4: Only MANAGERS can UPDATE images
CREATE POLICY "Managers can update company assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-assets' 
  AND (
    SELECT role FROM public.profiles 
    WHERE id = auth.uid()
  ) = 'manager'
);

-- Verify policies were created
-- Run this to check:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
