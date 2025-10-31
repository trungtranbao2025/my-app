-- ============================================
-- FIX NOTIFICATIONS RLS POLICIES
-- ============================================
-- Script này sẽ kiểm tra và sửa RLS policies cho bảng notifications

-- 1. Kiểm tra các policies hiện tại
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications';

-- 2. Xóa tất cả policies cũ
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable read access for users" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notifications;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.notifications;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.notifications;

-- 3. Tạo policies mới đơn giản và rõ ràng
-- Policy cho SELECT: User chỉ thấy notifications của mình
CREATE POLICY "notifications_select_policy" 
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy cho INSERT: Bất kỳ authenticated user nào cũng có thể tạo notification
CREATE POLICY "notifications_insert_policy" 
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy cho UPDATE: User chỉ update notifications của mình
CREATE POLICY "notifications_update_policy" 
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy cho DELETE: User chỉ delete notifications của mình
CREATE POLICY "notifications_delete_policy" 
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Đảm bảo RLS được bật
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Đảm bảo realtime được bật cho bảng này (bỏ qua nếu đã tồn tại)
DO $$
BEGIN
  -- Try to add table to publication, ignore if already exists
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Table notifications already in publication, skipping...';
  END;
END $$;

-- 6. Test query như frontend sẽ chạy
-- Thay 'hohoangtien94@gmail.com' bằng email của bạn
DO $$
DECLARE
  test_user_id uuid;
  notification_count int;
BEGIN
  -- Lấy user_id từ email
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email = 'hohoangtien94@gmail.com';
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE '❌ Không tìm thấy user với email này';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ User ID: %', test_user_id;
  
  -- Đếm notifications
  SELECT COUNT(*) INTO notification_count
  FROM public.notifications
  WHERE user_id = test_user_id;
  
  RAISE NOTICE '📊 Số notifications: %', notification_count;
  
  -- Hiển thị 5 notifications mới nhất sẽ được show ở query cuối
  RAISE NOTICE '📋 Xem 5 notifications mới nhất ở bảng Results bên dưới';
  
END $$;

-- 7. Hiển thị kết quả chi tiết
SELECT 
  id,
  type,
  title,
  left(message, 50) as message_preview,
  is_read,
  created_at
FROM public.notifications
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com'
)
ORDER BY created_at DESC
LIMIT 10;
