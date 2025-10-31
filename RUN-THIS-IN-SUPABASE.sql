-- ==========================================
-- CHẠY SCRIPT NÀY TRONG SUPABASE SQL EDITOR
-- ==========================================

-- 1. Tạo trigger để tự động tạo profile khi có auth user mới
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_metadata JSONB;
BEGIN
  -- Lấy metadata từ auth.users
  user_metadata := NEW.raw_user_meta_data;

  -- Tạo profile mới
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    birthday,
    join_date,
    is_active,
    role,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(user_metadata->>'full_name', split_part(NEW.email, '@', 1)),
    user_metadata->>'phone',
    (user_metadata->>'birthday')::DATE,
    COALESCE((user_metadata->>'join_date')::DATE, CURRENT_DATE),
    COALESCE((user_metadata->>'is_active')::BOOLEAN, true),
    COALESCE(user_metadata->>'role', 'user'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    birthday = COALESCE(EXCLUDED.birthday, profiles.birthday),
    join_date = COALESCE(EXCLUDED.join_date, profiles.join_date),
    is_active = COALESCE(EXCLUDED.is_active, profiles.is_active),
    role = COALESCE(EXCLUDED.role, profiles.role),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- 2. Xóa trigger cũ nếu có và tạo lại
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 3. Kiểm tra trigger đã hoạt động
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 4. Kiểm tra RLS policies cho profiles table
-- Đảm bảo authenticated users có thể insert profiles
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Hoàn thành!
-- Nếu kết quả trả về có trigger "on_auth_user_created" thì đã thành công!
