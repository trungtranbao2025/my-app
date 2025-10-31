-- ============================================
-- FIX RLS POLICIES - FINAL VERSION
-- ============================================
-- Script này sẽ fix RLS policies để frontend có thể query được

-- 1. Drop ALL existing policies
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

-- 2. Tạo policies MỚI với cách tiếp cận ĐÚNG
-- Policy cho SELECT: Dùng (auth.uid())::text thay vì auth.uid()
CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
USING ((auth.uid())::text = user_id::text);

-- Policy cho INSERT: Cho phép tất cả authenticated users tạo
CREATE POLICY "notifications_insert_all"
ON public.notifications
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy cho UPDATE: Chỉ update notifications của mình
CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
USING ((auth.uid())::text = user_id::text);

-- Policy cho DELETE: Chỉ delete notifications của mình
CREATE POLICY "notifications_delete_own"
ON public.notifications
FOR DELETE
USING ((auth.uid())::text = user_id::text);

-- 3. Đảm bảo RLS được bật
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Kiểm tra policies đã tạo
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY cmd, policyname;

-- 5. Test query
SELECT 
  '✅ Test thành công! Số notifications:' as message,
  COUNT(*) as count
FROM public.notifications
WHERE user_id = '81640e0f-77cb-48ab-a9db-56eff467bc00'::uuid;

-- 6. Hiển thị sample notifications
SELECT 
  id,
  type,
  title,
  is_read,
  created_at
FROM public.notifications
WHERE user_id = '81640e0f-77cb-48ab-a9db-56eff467bc00'::uuid
ORDER BY created_at DESC
LIMIT 5;
