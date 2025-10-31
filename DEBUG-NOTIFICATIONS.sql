-- KIỂM TRA NHANH: Tại sao chuông không có thông báo?
-- CHẠY TOÀN BỘ SCRIPT NÀY (chọn tất cả và Run)

-- 1. Lấy user_id từ email
DO $$
DECLARE
  uid uuid;
  total_notif int;
  user_notif int;
BEGIN
  -- Lấy user ID
  SELECT id INTO uid FROM public.profiles 
  WHERE lower(email) = lower('hohoangtien94@gmail.com');
  
  RAISE NOTICE '✅ User ID: %', uid;
  
  IF uid IS NULL THEN
    RAISE NOTICE '❌ Không tìm thấy user với email hohoangtien94@gmail.com';
    RETURN;
  END IF;
  
  -- Đếm tổng notifications trong hệ thống
  SELECT COUNT(*) INTO total_notif FROM public.notifications;
  RAISE NOTICE '📊 Tổng số notifications trong DB: %', total_notif;
  
  -- Đếm notifications của user này
  SELECT COUNT(*) INTO user_notif FROM public.notifications
  WHERE user_id = uid;
  RAISE NOTICE '🔔 Số notifications cho user này: %', user_notif;
  
  -- Hiển thị 10 notifications mới nhất (đơn giản hóa)
  RAISE NOTICE '📋 Danh sách 10 notifications mới nhất - xem bảng Results bên dưới';
  
END $$;

-- 2. Hiển thị 10 notifications mới nhất của user
WITH me AS (
  SELECT id uid FROM public.profiles 
  WHERE lower(email) = lower('hohoangtien94@gmail.com')
)
SELECT 
  to_char(n.created_at, 'YYYY-MM-DD HH24:MI:SS') as "Thời gian",
  n.type as "Loại",
  left(n.title, 30) as "Tiêu đề",
  left(n.message, 50) as "Nội dung",
  n.is_read as "Đã đọc"
FROM public.notifications n, me
WHERE n.user_id = me.uid
ORDER BY n.created_at DESC
LIMIT 10;

-- 3. Kiểm tra RLS policies
SELECT 
  policyname as "Policy Name",
  cmd as "Command",
  roles as "Roles",
  qual as "Using (Filter)",
  with_check as "With Check"
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications';

-- 4. Test query như frontend (authenticated role)
-- Kết quả này phải > 0 nếu muốn frontend load được
WITH me AS (
  SELECT id uid FROM public.profiles 
  WHERE lower(email) = lower('hohoangtien94@gmail.com')
)
SELECT COUNT(*) as "Frontend sẽ thấy bao nhiêu notifications"
FROM public.notifications n, me
WHERE n.user_id = me.uid;
