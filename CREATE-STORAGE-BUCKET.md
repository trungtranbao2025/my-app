# Hướng dẫn tạo Storage Bucket trong Supabase

## ⚠️ LỖI: "Bucket not found"
Bạn cần tạo storage bucket `company-assets` trong Supabase Dashboard.

## 📋 Các bước thực hiện:

### Bước 1: Vào Supabase Storage
1. Mở trình duyệt và đi tới: https://supabase.com/dashboard
2. Chọn project của bạn
3. Ở sidebar trái, click vào **Storage**

### Bước 2: Tạo New Bucket
1. Click nút **"New bucket"** (góc phải phía trên)
2. Điền thông tin:
   - **Name**: `company-assets` (chính xác tên này, không sai chính tả!)
   - **Public bucket**: ✅ **BẬT** (toggle sang màu xanh)
   - **File size limit**: `2097152` (2MB = 2 * 1024 * 1024 bytes)
   - **Allowed MIME types**: `image/*` (hoặc để trống)
3. Click **"Create bucket"**

### Bước 3: Cài đặt RLS Policies cho Storage

#### 3.1. Vào Policies của bucket
1. Trong danh sách buckets, click vào bucket `company-assets`
2. Click tab **"Policies"**
3. Click **"New policy"**

#### 3.2. Policy 1: Cho phép mọi người XEM ảnh (Public Read)
```
Name: Public Access - Anyone can view images
Policy type: SELECT
Target roles: public

SQL:
```
```sql
CREATE POLICY "Public can view company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');
```

#### 3.3. Policy 2: Chỉ Manager được UPLOAD ảnh
```
Name: Manager Upload - Only managers can upload
Policy type: INSERT
Target roles: authenticated

SQL:
```
```sql
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
```

#### 3.4. Policy 3: Manager có thể XÓA/CẬP NHẬT
```sql
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
```

```sql
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
```

### Bước 4: Chạy SQL Policies (Cách nhanh hơn)

Hoặc bạn có thể vào **SQL Editor** và chạy tất cả policies một lần:

```sql
-- Policy 1: Public Read
CREATE POLICY "Public can view company assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');

-- Policy 2: Manager Upload
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

-- Policy 3: Manager Delete
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

-- Policy 4: Manager Update
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
```

### Bước 5: Kiểm tra lại
1. Vào **Storage** → **company-assets**
2. Tab **Policies** - phải thấy 4 policies màu xanh ✅
3. Tab **Configuration** - phải thấy "Public bucket: Yes"

### Bước 6: Test upload logo
1. Làm mới trang web (Ctrl + Shift + R)
2. Đăng nhập với tài khoản Manager
3. Click vào logo ở góc trái trên
4. Chọn file ảnh
5. ✅ Upload thành công!

## 🔍 Kiểm tra nhanh

Sau khi tạo bucket, bạn có thể test bằng cách:

```javascript
// Mở Console trong trình duyệt và chạy:
const { data, error } = await supabase.storage.listBuckets()
console.log('Buckets:', data)
// Phải thấy 'company-assets' trong danh sách
```

## ❓ Nếu vẫn lỗi

- Kiểm tra tên bucket chính xác: `company-assets` (có dấu gạch ngang)
- Kiểm tra Public bucket đã bật
- Kiểm tra RLS policies đã được tạo
- Thử xóa bucket và tạo lại từ đầu

## 📌 Lưu ý quan trọng

- ⚠️ Bucket name phải là `company-assets` (chữ thường, có dấu -)
- ⚠️ Public bucket phải BẬT để hiển thị ảnh
- ⚠️ Policies phải có đủ 4 cái (SELECT, INSERT, DELETE, UPDATE)
- ⚠️ Manager role trong database phải chính xác là `'manager'`
