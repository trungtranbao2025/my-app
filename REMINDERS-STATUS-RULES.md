# Cảnh báo tự động theo trạng thái (in-app)

Tài liệu này bật nhắc việc qua thông báo của app cho các trạng thái:
- ⚠️ Sắp đến hạn (upcoming)
- ⏳ Chờ xử lý (pending)
- Mức ưu tiên: Trung bình (medium), Thấp (low)

## Thành phần
- Edge Function `reminder-scheduler` (đã có) đọc bảng `public.task_reminder_settings` và ghi `public.notifications` (Realtime push).
- Script `create-status-reminder-rules.sql` tạo bảng cấu hình `status_reminder_rules` và tự đồng bộ xuống `task_reminder_settings` theo trạng thái/priority.

## Cách bật
1) Chạy các migration một lần:
   - `migrations/create-reminder-scheduler.sql`
   - `create-status-reminder-rules.sql`
2) Lên lịch Edge Function `reminder-scheduler` trong Supabase → Edge Functions → Schedules (ví dụ: */10 * * * *).
3) Tạo/cập nhật công việc. Trigger sẽ thêm/điều chỉnh record trong `task_reminder_settings` cho người được giao (và các đồng thực hiện nếu có).

## Mặc định đã cấu hình
- upcoming + medium → nhắc mỗi 6 giờ (start: on_upcoming)
- upcoming + low → nhắc mỗi 12 giờ
- pending + medium → nhắc mỗi 24 giờ (start: on_create)
- pending + low → nhắc mỗi 48 giờ

Bạn có thể sửa trực tiếp trong bảng `status_reminder_rules` (cột `repeat_hours`, `start_mode`) hoặc tắt hàng bằng `active=false`.

## Chính sách bảo mật
- Bảng `status_reminder_rules` bật RLS: ai cũng đọc; chỉ `manager/admin` được sửa.
- `notifications` có policy đọc thông báo của chính mình.

## Kiểm tra nhanh
- Chạy `seed-reminder-demo.sql` để tạo task và 1 notification test.
- Chạy `create-status-reminder-rules.sql` để đổ rules và đồng bộ. Kiểm tra `task_reminder_settings` có record tương ứng.
- Đợi cron chạy, kiểm tra `public.notifications` xuất hiện dòng mới theo lịch.
