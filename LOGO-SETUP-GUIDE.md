# Hướng dẫn Setup Logo Công ty

## Bước 1: Tạo Storage Bucket trong Supabase

1. Vào **Supabase Dashboard** → **Storage**
2. Click **New bucket**
3. Cài đặt:
   - **Name**: `company-assets`
   - **Public bucket**: ✅ Bật (để có thể truy cập công khai)
   - **File size limit**: 2MB
   - **Allowed MIME types**: `image/*`
4. Click **Create bucket**

## Bước 2: Cài đặt RLS Policies cho Storage

Vào **Storage** → **Policies** → **company-assets**, thêm policies:

### Policy 1: Cho phép mọi người xem
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');
```

### Policy 2: Chỉ Manager được upload
```sql
CREATE POLICY "Manager can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets' 
  AND auth.uid() IN (
    SELECT id FROM auth.users 
    WHERE id IN (
      SELECT id FROM public.profiles WHERE role = 'manager'
    )
  )
);
```

## Bước 3: Chạy SQL Script

Vào **SQL Editor** trong Supabase Dashboard và chạy file `update-company-logo.sql`:

```sql
-- Update system_settings table to support company logo storage
UPDATE public.system_settings 
SET value = jsonb_build_object(
  'type', 'text',
  'imagePath', null,
  'fallbackText', 'PM',
  'imageAlt', 'Logo công ty'
)
WHERE key = 'company_logo';

-- Add company_name and company_subtitle settings
INSERT INTO public.system_settings (key, value, description) VALUES
('company_name', '"QLDA"', 'Company name display'),
('company_subtitle', '"Quản lý dự án"', 'Company subtitle display'),
('company_description', '"Quản lý công việc các dự án"', 'Company description')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

## Bước 4: Kiểm tra

1. Đăng nhập với tài khoản **Manager**
2. Click vào logo ở góc trái phía trên (sidebar)
3. Chọn file ảnh logo (PNG, JPG, max 2MB)
4. Logo sẽ được upload và hiển thị ngay lập tức
5. Logo sẽ hiển thị ở:
   - Sidebar (góc trái trên)
   - Trang login
   - Mobile menu

## Tính năng

✅ **Lưu vào database**: Logo được lưu trong Supabase Storage và URL được lưu trong `system_settings`
✅ **Chỉ Manager có quyền**: Chỉ tài khoản Manager mới thấy icon camera và có thể click để thay đổi logo
✅ **Hiển thị toàn hệ thống**: Logo tự động cập nhật ở mọi nơi (sidebar, login, mobile)
✅ **Fallback text**: Nếu không có logo hoặc lỗi, hiển thị chữ "PM"
✅ **Responsive**: Logo tự động điều chỉnh kích thước theo màn hình

## Cấu trúc Files

- `src/components/CompanyLogo.jsx` - Component logo có thể tái sử dụng
- `src/components/Layout.jsx` - Sử dụng CompanyLogo trong sidebar
- `src/pages/LoginPage.jsx` - Hiển thị logo từ database
- `update-company-logo.sql` - SQL script để setup database

## Cách sử dụng Component

```jsx
// Size options: 'sm', 'md', 'lg', 'xl'
// showText: hiển thị tên công ty bên cạnh logo

<CompanyLogo size="md" showText={true} />
```

## Lưu ý

- Logo được lưu vĩnh viễn trong database
- File upload giới hạn 2MB
- Chỉ chấp nhận file ảnh (image/*)
- Manager có thể thay đổi bất cứ lúc nào bằng cách click vào logo
