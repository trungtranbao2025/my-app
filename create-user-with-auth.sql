-- Function để tạo user mới với Supabase Auth
-- Chạy script này trong Supabase SQL Editor

-- 1. Tạo function để tạo user mới (chỉ admin/manager mới được dùng)
CREATE OR REPLACE FUNCTION create_user_with_profile(
  user_email TEXT,
  user_password TEXT,
  user_full_name TEXT,
  user_phone TEXT DEFAULT NULL,
  user_birthday DATE DEFAULT NULL,
  user_join_date DATE DEFAULT NULL,
  user_is_active BOOLEAN DEFAULT true,
  user_role TEXT DEFAULT 'user'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
  new_profile RECORD;
  result JSON;
BEGIN
  -- Kiểm tra quyền: chỉ admin hoặc manager mới được tạo user
  IF NOT (
    SELECT role IN ('admin', 'manager') 
    FROM profiles 
    WHERE id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Chỉ Admin hoặc Manager mới có quyền tạo nhân sự mới';
  END IF;

  -- Kiểm tra email đã tồn tại chưa
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    RAISE EXCEPTION 'Email % đã được sử dụng', user_email;
  END IF;

  -- Tạo user trong auth.users (sử dụng Supabase Admin API)
  -- Lưu ý: Function này cần được gọi từ client với Supabase Admin
  -- Vì plpgsql không thể trực tiếp tạo auth user
  
  -- Trả về thông tin để client xử lý
  result := json_build_object(
    'email', user_email,
    'password', user_password,
    'full_name', user_full_name,
    'phone', user_phone,
    'birthday', user_birthday,
    'join_date', user_join_date,
    'is_active', user_is_active,
    'role', user_role,
    'action', 'create_auth_user'
  );

  RETURN result;
END;
$$;

-- 2. Tạo trigger để tự động tạo profile khi có auth user mới
-- (Trigger này đã có sẵn từ trước, nhưng đảm bảo nó hoạt động đúng)

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

-- Xóa trigger cũ nếu có và tạo lại
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION create_user_with_profile TO authenticated;

-- 4. Kiểm tra trigger đã hoạt động
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Hoàn thành!
-- Cách sử dụng:
-- 1. Từ client (React), gọi Supabase Admin API để tạo auth user
-- 2. Trigger sẽ tự động tạo profile tương ứng
-- 3. Hoặc sử dụng function create_user_with_profile để lấy thông tin cần thiết
