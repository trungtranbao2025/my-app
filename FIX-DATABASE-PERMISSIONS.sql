-- ==================================================
-- SCRIPT SỬA LỖI TỔNG HỢP - CHẠY TRONG SUPABASE SQL
-- ==================================================
-- Script này sẽ:
-- 1. Kích hoạt RLS cho bảng `profiles` nếu chưa có.
-- 2. Xóa các policy cũ trên bảng `profiles` để tránh xung đột.
-- 3. Tạo policy mới cho phép trigger `handle_new_user` có thể INSERT vào `profiles`.
-- 4. Tạo lại trigger `handle_new_user` để đảm bảo nó là phiên bản mới nhất.

-- BƯỚC 1: KÍCH HOẠT RLS (Row Level Security) CHO BẢNG PROFILES
-- --------------------------------------------------
-- Lệnh này đảm bảo RLS được bật. Nếu đã bật, nó sẽ không làm gì cả.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- BƯỚC 2: XÓA TẤT CẢ POLICIES CŨ TRÊN BẢNG PROFILES
-- --------------------------------------------------
-- Việc này giúp dọn dẹp và tránh các policy cũ gây ra lỗi không mong muốn.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated user to insert" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;


-- BƯỚC 3: TẠO POLICY MỚI CHO PHÉP INSERT VÀO PROFILES
-- --------------------------------------------------
-- Đây là policy QUAN TRỌNG NHẤT để sửa lỗi "Database error saving new user".
-- Nó cho phép BẤT KỲ ai đã đăng nhập (authenticated) đều có thể thêm dòng mới vào `profiles`.
-- Trigger `handle_new_user` chạy với quyền của hệ thống (thông qua service_role) nên sẽ được phép.
CREATE POLICY "Enable insert for authenticated users only"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- BƯỚC 4: TẠO LẠI TRIGGER ĐỂ ĐẢM BẢO PHIÊN BẢN ĐÚNG
-- --------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, birthday, join_date, is_active, role)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    (NEW.raw_user_meta_data->>'birthday')::DATE,
    COALESCE((NEW.raw_user_meta_data->>'join_date')::DATE, CURRENT_DATE),
    COALESCE((NEW.raw_user_meta_data->>'is_active')::BOOLEAN, true),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$;

-- Xóa trigger cũ và tạo lại để áp dụng function mới nhất
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- BƯỚC 5: TẠO CÁC POLICY CƠ BẢN KHÁC
-- --------------------------------------------------
-- Cho phép mọi người xem tất cả profile (nếu bạn muốn)
CREATE POLICY "Public profiles are viewable by everyone."
ON public.profiles
FOR SELECT
USING (true);

-- Cho phép user tự cập nhật profile của chính mình
CREATE POLICY "Users can update own profile."
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- ==================================================
-- HOÀN TẤT! BÂY GIỜ HÃY TEST LẠI ỨNG DỤNG.
-- ==================================================
