-- ============================================
-- SIMPLE FIX: Chỉ fix policies và test
-- ============================================

-- 1. Drop old policies
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

-- 2. Tạo policies mới
CREATE POLICY "notifications_select_policy" 
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_policy" 
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "notifications_update_policy" 
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_delete_policy" 
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Kiểm tra user_id
SELECT 
  '🔍 Thông tin user từ email' as info,
  id as user_id_from_auth,
  email
FROM auth.users
WHERE email = 'hohoangtien94@gmail.com';

-- 5. Kiểm tra notifications của user này
SELECT 
  '📊 Thống kê notifications' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_read = false) as unread
FROM public.notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com');

-- 6. Hiển thị danh sách notifications
SELECT 
  id,
  type,
  title,
  left(message, 60) as message,
  is_read,
  to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM public.notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com')
ORDER BY created_at DESC
LIMIT 10;
