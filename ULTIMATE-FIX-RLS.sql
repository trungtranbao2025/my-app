-- ============================================
-- ULTIMATE FIX - Kiểm tra và sửa type mismatch
-- ============================================

-- 1. Kiểm tra kiểu dữ liệu của user_id trong bảng notifications
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'notifications'
  AND column_name = 'user_id';

-- 2. Kiểm tra kiểu dữ liệu trong auth.users
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'auth' 
  AND table_name = 'users'
  AND column_name = 'id';

-- 3. Test với cả UUID và TEXT
SELECT 
  'Test với UUID' as test_type,
  COUNT(*) as count
FROM public.notifications
WHERE user_id = '81640e0f-77cb-48ab-a9db-56eff467bc00'::uuid;

SELECT 
  'Test với TEXT' as test_type,
  COUNT(*) as count
FROM public.notifications
WHERE user_id::text = '81640e0f-77cb-48ab-a9db-56eff467bc00';

-- 4. Drop ALL policies và tạo lại ĐƠN GIẢN NHẤT
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable read access for users" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notifications;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.notifications;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
DROP POLICY IF EXISTS "select_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "delete_own_notifications" ON public.notifications;

-- 5. Tạo policies ĐƠN GIẢN với cả 2 cách cast
CREATE POLICY "select_own_notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  auth.uid()::text = user_id::text
);

CREATE POLICY "insert_notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "update_own_notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  auth.uid()::text = user_id::text
);

CREATE POLICY "delete_own_notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  auth.uid()::text = user_id::text
);

-- 6. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 7. Verify policies
SELECT 
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd;

-- 8. Final test
SELECT 
  '🎯 Final Test Result' as info,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE is_read = false) as unread_count
FROM public.notifications
WHERE user_id = '81640e0f-77cb-48ab-a9db-56eff467bc00'::uuid;
