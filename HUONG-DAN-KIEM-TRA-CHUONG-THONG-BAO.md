# Hướng dẫn kiểm tra chuông thông báo

## ✅ Đã hoàn tất

1. **File `.env.local`**: Đã có sẵn với thông tin Supabase đúng
   - Project: `emdlwigmrwypudpsmslp.supabase.co`
   - Đã có 18 notifications type='task_reminder' trong DB cho tài khoản của bạn

2. **Dev server**: Đang chạy tại http://localhost:5173/
   - Đã nạp biến môi trường từ `.env.local`
   - Kết nối đúng project Supabase

3. **Code đã sửa**:
   - `src/lib/supabase.js`: Bắt buộc dùng env vars, không còn fallback sang project khác
   - `src/contexts/NotificationContext.jsx`: Tải và subscribe realtime ngay khi đăng nhập
   - `src/pages/DashboardPage.jsx`: Tự động refresh sau khi gửi nhắc việc

## 🔍 Các bước kiểm tra

### Bước 1: Xóa cache và reload trang
1. Mở http://localhost:5173/ trong trình duyệt
2. Mở DevTools (F12)
3. Tab **Application** → **Service Workers** → bấm **Unregister** (nếu có)
4. Tab **Application** → **Storage** → chọn **Clear site data** (để xóa cache cũ)
5. **Hard reload**: Ctrl + Shift + R (hoặc Ctrl + F5)

### Bước 2: Đăng nhập và kiểm tra log
1. Đăng nhập với tài khoản: `hohoangtien94@gmail.com`
2. Mở DevTools → tab **Console**
3. Tìm dòng: `✅ Supabase connected: https://emdlwigmrwypudpsmslp.supabase.co`
   - Nếu thấy dòng này → Kết nối đúng project ✅
   - Nếu không thấy hoặc thấy project khác → Có vấn đề ❌

### Bước 3: Kiểm tra chuông ngay lập tức
1. Nhìn góc phải trên header, bấm vào **biểu tượng chuông** 🔔
2. **Kết quả mong đợi**:
   - Badge đỏ hiển thị số thông báo chưa đọc (ít nhất 18)
   - Dropdown mở ra, hiển thị danh sách thông báo "Nhắc việc"
   - Các thông báo về công việc "Báo cáo tuần" quá hạn

### Bước 4: Thử nghiệm Dashboard
1. Vào trang **Tổng quan** (Dashboard)
2. Tìm thẻ **"Nhắc việc (tạm thời)"**
3. Bấm nút **"Tải lại thông báo"**
   - Chuông sẽ cập nhật ngay
   - Toast hiển thị "Đã tải lại thông báo"

4. Bấm nút **"Tái tạo nhắc việc"** (nếu muốn backfill reminders mới)
   - Chờ toast "Đã tái tạo X nhắc việc"
   - "Số nhắc việc đến hạn chưa gửi" cập nhật

5. Bấm nút **"Gửi nhắc việc ngay"**
   - App tự động tải lại thông báo
   - Toast: "Đã chạy gửi nhắc việc! Đã tải lại thông báo."
   - Mở chuông → thấy thông báo mới xuất hiện ngay

## ❓ Nếu vẫn không thấy thông báo

### Kiểm tra 1: Console có lỗi không?
- Mở DevTools → Console
- Tìm dòng đỏ (error) liên quan đến Supabase, notifications, hoặc realtime
- Nếu có lỗi "function … does not exist", báo lại để kiểm tra RPC

### Kiểm tra 2: User đúng không?
```sql
-- Chạy trong Supabase SQL Editor
SELECT id, email, full_name, role 
FROM public.profiles 
WHERE lower(email) = lower('hohoangtien94@gmail.com');
```
- Ghi nhớ `id` (uuid) của user

### Kiểm tra 3: Có notifications cho user này không?
```sql
-- Thay YOUR_USER_ID bằng id từ bước trên
WITH me AS (SELECT id uid FROM public.profiles WHERE lower(email)=lower('hohoangtien94@gmail.com'))
SELECT COUNT(*) as total_notifications
FROM public.notifications, me
WHERE user_id = me.uid;
```
- Nếu = 0 → Chưa có thông báo nào cho user này
- Nếu > 0 → Có thông báo, vấn đề là frontend

### Kiểm tra 4: Realtime subscription
1. DevTools → tab **Network** → filter **WS** (WebSocket)
2. Tìm connection tới `realtime-v2.supabase.co`
3. Xem Messages → nên thấy các event `postgres_changes`

### Kiểm tra 5: Task có gán cho bạn không?
```sql
-- Liệt kê các task của bạn
WITH me AS (SELECT id uid FROM public.profiles WHERE lower(email)=lower('hohoangtien94@gmail.com'))
SELECT t.id, t.title, t.due_date, t.status
FROM public.tasks t, me
WHERE t.assigned_to = me.uid
   OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = me.uid)
ORDER BY t.due_date DESC
LIMIT 20;
```
- Nếu không có task nào → Bạn không phải người thực hiện → Không nhận nhắc việc

## 🎯 Kết quả cuối cùng

Sau khi làm theo các bước trên:
- ✅ Chuông hiển thị badge số thông báo chưa đọc
- ✅ Mở chuông thấy danh sách thông báo "Nhắc việc"
- ✅ Thông báo có nội dung về các task quá hạn (ví dụ: "Báo cáo tuần")
- ✅ Bấm "Gửi nhắc việc ngay" → thông báo mới xuất hiện tức thì

## 📞 Nếu cần hỗ trợ thêm

Nếu sau các bước trên vẫn không thấy thông báo, gửi mình:
1. Screenshot console log (có dòng "Supabase connected")
2. Kết quả các truy vấn kiểm tra (kiểm tra 2, 3, 5)
3. Screenshot tab Network → WS (WebSocket connection)

Mình sẽ viết truy vấn chi tiết hơn để debug từng bước: task → reminders → notifications.
