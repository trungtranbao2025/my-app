# 🔧 HƯỚNG DẪN SỬA LỖI "Database error saving new user"

## ❌ LỖI HIỆN TẠI
```
POST https://emdlwigmrwypudpsmslp.supabase.co/auth/v1/signup 500 (Internal Server Error)
AuthApiError: Database error saving new user
```

## 🎯 NGUYÊN NHÂN
Khi tạo user mới qua `supabase.auth.signUp()`, Supabase Auth cố gắng tạo record trong bảng `profiles` nhưng:
- **Trigger `handle_new_user()` chưa được tạo** trong database
- Hoặc trigger bị lỗi/disabled
- Hoặc RLS policies không cho phép insert vào `profiles`

## ✅ GIẢI PHÁP - CHẠY SQL TRONG SUPABASE

### Bước 1: Đăng nhập Supabase Dashboard
1. Mở trình duyệt
2. Truy cập: https://supabase.com/dashboard
3. Đăng nhập với tài khoản của bạn
4. Chọn project: **emdlwigmrwypudpsmslp**

### Bước 2: Mở SQL Editor
1. Trong menu bên trái, click **"SQL Editor"**
2. Click **"+ New query"** để tạo query mới

### Bước 3: Copy và Paste Script
Copy toàn bộ nội dung từ file `RUN-THIS-IN-SUPABASE.sql` hoặc copy trực tiếp:

```sql
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
```

### Bước 4: Chạy Script
1. Click nút **"Run"** (hoặc nhấn `Ctrl + Enter`)
2. Đợi kết quả hiển thị ở phía dưới

### Bước 5: Kiểm Tra Kết Quả
Bạn sẽ thấy kết quả tương tự:

| trigger_name | event_manipulation | event_object_table | action_statement |
|--------------|-------------------|-------------------|------------------|
| on_auth_user_created | INSERT | users | EXECUTE FUNCTION handle_new_user() |

✅ **Nếu thấy dòng này** → Trigger đã được tạo thành công!

### Bước 6: Kiểm Tra RLS Policies (Tùy chọn)
Chạy thêm query này để kiểm tra policies:

```sql
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

Đảm bảo có policy cho phép **INSERT** vào `profiles`.

## 🧪 TEST SAU KHI SỬA

### 1. Quay lại ứng dụng (localhost:5173/staff)
### 2. Click nút "Thêm nhân sự"
### 3. Điền thông tin:
- **Email:** test@example.com
- **Họ tên:** Nguyễn Văn Test
- **Mật khẩu:** Test123456
- **Số điện thoại:** 0123456789

### 4. Click "Lưu"
### 5. Kiểm tra kết quả:
- ✅ Thông báo: "Thêm nhân sự thành công!"
- ✅ User mới xuất hiện trong danh sách
- ✅ Không có lỗi trong Console

## ⚠️ LƯU Ý
- **Script này an toàn** - Có `ON CONFLICT DO UPDATE` nên không làm mất dữ liệu cũ
- **Chạy 1 lần duy nhất** là đủ
- **Nếu vẫn lỗi** sau khi chạy → Check RLS policies hoặc liên hệ để được hỗ trợ

## 🔍 TROUBLESHOOTING

### Nếu vẫn lỗi "Database error saving new user":
1. **Kiểm tra RLS Policies:**
   - Vào **Authentication** → **Policies**
   - Tìm bảng `profiles`
   - Đảm bảo có policy cho phép `INSERT`

2. **Kiểm tra trigger có enabled không:**
   ```sql
   SELECT tgname, tgenabled 
   FROM pg_trigger 
   WHERE tgname = 'on_auth_user_created';
   ```
   - `tgenabled` phải = 'O' (Origin = enabled)

3. **Xem chi tiết lỗi trong Supabase Logs:**
   - Vào **Database** → **Logs**
   - Xem lỗi khi insert vào `profiles`

## 📞 HỖ TRỢ
Nếu cần hỗ trợ, gửi thông tin:
- Screenshot kết quả query kiểm tra trigger
- Screenshot lỗi trong Console
- Screenshot RLS policies của bảng `profiles`
