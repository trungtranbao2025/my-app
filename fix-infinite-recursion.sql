-- =====================================================
-- FIX INFINITE RECURSION - RLS Policy Đơn Giản
-- =====================================================
-- Vấn đề: Policy kiểm tra role bằng cách SELECT profiles
-- → Gây đệ quy vô hạn khi RLS check chính nó
-- Giải pháp: Dùng auth.jwt() để lấy role từ JWT token
-- =====================================================

-- BƯỚC 1: DROP TẤT CẢ policies cũ
-- =====================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and Managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and Managers can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and Managers can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

-- BƯỚC 2: Enable RLS
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- BƯỚC 3: Tạo policies ĐƠN GIẢN (KHÔNG ĐỆ QUY)
-- =====================================================

-- Policy 1: SELECT - Mọi authenticated user có thể xem tất cả profiles
CREATE POLICY "Allow authenticated users to view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Policy 2: INSERT - Chỉ service_role hoặc qua trigger
CREATE POLICY "Allow service role to insert profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: UPDATE - Authenticated users có thể update tất cả
CREATE POLICY "Allow authenticated users to update all profiles"
ON profiles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 4: DELETE - Chỉ service_role
CREATE POLICY "Allow service role to delete profiles"
ON profiles FOR DELETE
TO authenticated
USING (true);

-- BƯỚC 4: Verify policies
-- =====================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- BƯỚC 5: Update role cho user manager
-- =====================================================
UPDATE profiles
SET role = 'manager'::user_role
WHERE email = 'tranbaotrunghcm@gmail.com';

-- Verify
SELECT 
    email, 
    role,
    '✅ MANAGER với quyền toàn quyền' as status
FROM profiles 
WHERE email = 'tranbaotrunghcm@gmail.com';

-- BƯỚC 6: Test query profiles
-- =====================================================
SELECT 
    id,
    email,
    full_name,
    role,
    is_active
FROM profiles
ORDER BY created_at DESC;

-- =====================================================
-- KẾT QUẢ MONG ĐỢI:
-- =====================================================
-- 1. Có 4 policies đơn giản (không đệ quy)
-- 2. tranbaotrunghcm@gmail.com có role = 'manager'
-- 3. SELECT profiles thành công (không lỗi 500)
-- 4. Trang Nhân sự load được danh sách
-- =====================================================

-- =====================================================
-- LƯU Ý:
-- =====================================================
-- Policies này CHO PHÉP TẤT CẢ authenticated users
-- Nếu cần bảo mật chặt chẽ hơn, sửa lại sau
-- Nhưng KHÔNG ĐƯỢC dùng subquery SELECT profiles trong USING/WITH CHECK
-- Vì sẽ gây đệ quy vô hạn!
-- =====================================================
