-- ============================================
-- TEST RLS POLICIES TRỰC TIẾP
-- ============================================
-- Script này test xem RLS policies có hoạt động đúng không

-- 1. Kiểm tra RLS có được bật không
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'notifications';

-- 2. Liệt kê tất cả policies
SELECT 
  policyname,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY cmd, policyname;

-- 3. Test query WITHOUT RLS (as admin)
-- Đếm tổng số notifications
SELECT 
  'Total notifications (admin view)' as description,
  COUNT(*) as count
FROM public.notifications;

-- 4. Test query WITH RLS simulation
-- Giả lập như user đang đăng nhập
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Get user_id
  SELECT id INTO test_user_id 
  FROM auth.users 
  WHERE email = 'hohoangtien94@gmail.com';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing RLS as authenticated user';
  RAISE NOTICE 'User ID: %', test_user_id;
  RAISE NOTICE '========================================';
  
  -- This should work with RLS
  PERFORM COUNT(*) 
  FROM public.notifications 
  WHERE user_id = test_user_id;
  
  RAISE NOTICE '✅ Query completed successfully';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error: %', SQLERRM;
END $$;

-- Reset role
RESET ROLE;

-- 5. Direct SELECT test (should show notifications)
SELECT 
  id,
  type,
  title,
  left(message, 50) as message,
  is_read,
  created_at
FROM public.notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com')
ORDER BY created_at DESC
LIMIT 10;
