-- ============================================
-- KIỂM TRA AUTH MISMATCH
-- ============================================
-- Script này kiểm tra xem user_id trong notifications có khớp với auth.users không

-- 1. Lấy thông tin user từ auth.users
SELECT 
  'auth.users' as source,
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'hohoangtien94@gmail.com';

-- 2. Lấy thông tin user từ public.profiles
SELECT 
  'public.profiles' as source,
  id as user_id,
  email,
  full_name,
  created_at
FROM public.profiles
WHERE email = 'hohoangtien94@gmail.com';

-- 3. Kiểm tra user_id trong notifications
SELECT DISTINCT
  'notifications.user_id' as source,
  user_id,
  COUNT(*) as notification_count
FROM public.notifications
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com'
  UNION
  SELECT id FROM public.profiles WHERE email = 'hohoangtien94@gmail.com'
)
GROUP BY user_id;

-- 4. Kiểm tra xem có notifications nào với user_id KHÔNG TỒN TẠI trong auth.users
SELECT 
  n.id,
  n.user_id,
  n.title,
  n.created_at,
  CASE 
    WHEN u.id IS NULL THEN '❌ User không tồn tại trong auth.users'
    ELSE '✅ User hợp lệ'
  END as status
FROM public.notifications n
LEFT JOIN auth.users u ON n.user_id = u.id
WHERE n.user_id = (SELECT id FROM public.profiles WHERE email = 'hohoangtien94@gmail.com')
ORDER BY n.created_at DESC
LIMIT 10;

-- 5. Test query CHÍNH XÁC như frontend (sử dụng auth.uid())
-- NOTE: Trong SQL Editor, chúng ta không thể dùng auth.uid() trực tiếp
-- Nhưng ta có thể simulate bằng cách set session
DO $$
DECLARE
  test_uid uuid;
  notif_count int;
BEGIN
  SELECT id INTO test_uid FROM auth.users WHERE email = 'hohoangtien94@gmail.com';
  
  -- Test query như RLS policy
  SELECT COUNT(*) INTO notif_count
  FROM public.notifications
  WHERE user_id = test_uid;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ User ID từ auth.users: %', test_uid;
  RAISE NOTICE '📊 Số notifications tìm thấy: %', notif_count;
  RAISE NOTICE '========================================';
  
  IF notif_count = 0 THEN
    RAISE NOTICE '❌ KHÔNG TÌM THẤY NOTIFICATIONS!';
    RAISE NOTICE '   Có thể user_id trong notifications không khớp với auth.users';
  ELSE
    RAISE NOTICE '✅ Tìm thấy % notifications', notif_count;
  END IF;
END $$;
