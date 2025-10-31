# Nhắc việc - Thiết lập mới (React + Supabase)

## 1) Tạo schema trên Supabase

Chạy file SQL sau trong Supabase SQL Editor hoặc CLI:

- `create-reminders.sql`

Nội dung:
- Tạo bảng `public.reminders`
- Bật RLS
- Policies cho phép người dùng CRUD dữ liệu của chính họ
- Tạo view `v_upcoming_reminders` (tuỳ chọn)

## 2) UI React

- Trang mới: `src/pages/RemindersPage.jsx`
- Điều hướng: mục "Nhắc việc" đã xuất hiện trong menu, trỏ tới `/reminders`
- Tuyến đường mới đã được cấu hình trong `src/App.jsx`

## 3) Kiểm thử nhanh

1. Đăng nhập, vào menu Nhắc việc → `/reminders`
2. Tạo một nhắc việc: nhập Tiêu đề + thời gian `remind_at`
3. Quan sát danh sách hiển thị.

## 4) Gợi ý mở rộng

- Cron Function (Edge Function) gửi email/push khi `remind_at` tới hạn
- Lọc/Phân trang, nhãn ưu tiên, đính kèm task liên quan
- Đồng bộ NotificationContext để hiển thị badge theo số nhắc việc chưa hoàn thành
