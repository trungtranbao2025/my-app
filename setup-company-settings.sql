-- Cập nhật cấu trúc system_settings để hỗ trợ tên công ty và tên phần mềm
-- Chạy script này trong Supabase SQL Editor

-- Cập nhật hoặc thêm company_name
INSERT INTO public.system_settings (key, value, description) 
VALUES ('company_name', '"Tên công ty"', 'Tên công ty hiển thị trên trang đăng nhập')
ON CONFLICT (key) DO UPDATE SET 
  description = EXCLUDED.description;

-- Cập nhật hoặc thêm app_name (tên phần mềm)
INSERT INTO public.system_settings (key, value, description) 
VALUES ('app_name', '"Tên phần mềm"', 'Tên phần mềm hiển thị trên trang đăng nhập')
ON CONFLICT (key) DO UPDATE SET 
  description = EXCLUDED.description;

-- Cập nhật hoặc thêm company_logo
INSERT INTO public.system_settings (key, value, description) 
VALUES ('company_logo', jsonb_build_object(
  'type', 'text',
  'imagePath', null,
  'fallbackText', 'LOGO',
  'imageAlt', 'Logo công ty'
), 'Cấu hình logo công ty')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- Xóa các cài đặt cũ không dùng nữa (nếu có)
DELETE FROM public.system_settings 
WHERE key IN ('company_subtitle', 'company_description');

-- Kiểm tra kết quả
SELECT * FROM public.system_settings 
WHERE key IN ('company_name', 'app_name', 'company_logo')
ORDER BY key;

-- ============================================================
-- HƯỚNG DẪN TẠO STORAGE BUCKET (Thực hiện thủ công)
-- ============================================================
-- Bước 1: Vào Storage trong Supabase Dashboard
-- Bước 2: Tạo bucket mới tên: company-assets
-- Bước 3: Cấu hình bucket:
--   + Public bucket: Yes
--   + File size limit: 2097152 (2MB)
--   + Allowed MIME types: image/*
-- ============================================================

-- RLS Policies cho storage bucket (chạy sau khi tạo bucket)
-- Xóa policies cũ nếu có
DROP POLICY IF EXISTS "Managers can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete company assets" ON storage.objects;
DROP POLICY IF EXISTS "Everyone can view company assets" ON storage.objects;

-- Tạo policies mới
CREATE POLICY "Managers can upload company assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' 
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

CREATE POLICY "Managers can delete company assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets' 
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

CREATE POLICY "Everyone can view company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');
