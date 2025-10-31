-- ============================================
-- TEST: TẠO NOTIFICATION MỚI
-- ============================================
-- Script này sẽ tạo một notification test cho user hiện tại

-- Tạo notification test
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  message,
  is_read,
  created_at
)
SELECT 
  id as user_id,
  'task_reminder' as type,
  'Test Notification - ' || to_char(NOW(), 'HH24:MI:SS') as title,
  'Đây là notification test để kiểm tra hệ thống. Thời gian: ' || to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS') as message,
  false as is_read,
  NOW() as created_at
FROM auth.users 
WHERE email = 'hohoangtien94@gmail.com'
RETURNING *;

-- Kiểm tra xem notification đã được tạo chưa
SELECT 
  id,
  type,
  title,
  message,
  is_read,
  created_at,
  user_id
FROM public.notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com')
ORDER BY created_at DESC
LIMIT 5;
