# Kiểm tra tính năng nhắc việc (in-app, email, SMS)

Tài liệu này giúp bạn tự kiểm tra nhanh tính năng nhắc việc đã hoạt động end-to-end hay chưa.

## 1) Kiểm tra schema và cấu hình

Chạy file SQL sau trong Supabase SQL Editor (hoặc copy từ `verify-reminders.sql`):

- Kiểm tra bảng/column cần thiết có tồn tại (task_reminders với `scheduled_at`/`sent`, reminder_logs, notifications, user_reminder_preferences).
- Phát hiện và cảnh báo nếu còn cột cũ (`is_sent`, `reminder_time`).

Nếu phát hiện schema cũ, chạy script chuẩn hóa trong repo:
- `create-task-reminder-settings.sql`
- `fix-user-reminder-preferences.sql`

## 2) Tạo dữ liệu test

- Tạo 1 task giả lập, gán cho tài khoản của bạn.
- Chèn 2 reminder vào `task_reminders` với `scheduled_at <= now()` (1 cái dạng gần hạn, 1 cái quá hạn — thực chất severity được tính khi gửi dựa trên due_date của task).

Mẫu (có trong `verify-reminders.sql`):
- Insert 2 reminders sẵn sàng gửi.

## 3) Kích hoạt bộ gửi (sender)

Khuyến nghị: dùng Supabase Edge Scheduler để gọi function `reminder-scheduler` mỗi 5 phút. Để test ngay bạn có thể:

- Dùng Dashboard → Functions → Invoke → chọn `reminder-scheduler`.
- Hoặc gọi HTTP endpoint của function (yêu cầu cấu hình và token phù hợp).

Lưu ý quan trọng: Nếu đang dùng Edge Function để xử lý hàng đợi, KHÔNG gọi function SQL cũ `send_task_reminders()` để tránh tạo thông báo trùng lặp. Đường đi chuẩn hiện tại là Edge Function.

## 4) Xem kết quả

- Bảng `notifications`: có dòng mới type `task_reminder` cho user của bạn.
- Bảng `task_reminders`: 2 dòng test chuyển `sent = true`, có `sent_at`.
- Bảng `reminder_logs`: ghi nhận 1 bản ghi kênh `push` (success), và có thể thêm `email` (success/skipped) và `sms` (success/skipped) tùy cấu hình secret.

## 5) Kiểm tra giao diện

- Chạy web app (npm run dev) → đăng nhập bằng user test → kiểm tra toast thông báo và danh sách thông báo (Notification Center) hiện bản ghi vừa tạo.

## Ghi chú kênh gửi (tối ưu chi phí)

- In-app: luôn gửi (rẻ và tức thời).
- Email (Resend): gửi khi gần hạn/qua hạn nếu có email người dùng.
- SMS (Twilio): chỉ gửi khi quá hạn nếu có số điện thoại (giảm chi phí).

## Khắc phục sự cố

- Không thấy thông báo: kiểm tra `task_reminders` có bản ghi `scheduled_at <= now()` và `sent = false` chưa; kiểm tra Edge Function có được invoke chưa; xem `reminder_logs` để biết trạng thái.
- Email/SMS không gửi: kiểm tra secret cấu hình (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`) và domain/email verified.
- Trùng thông báo: đảm bảo không đồng thời dùng cả Edge Function và function SQL cũ `send_task_reminders()`.
