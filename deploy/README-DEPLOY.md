# Triển khai nhanh dự án mới (Supabase + Electron/React)

Tài liệu này giúp bạn sao chép hệ thống sang một dự án Supabase mới nhanh chóng, tối ưu và ít lỗi nhất.

## 1) Chuẩn bị Supabase Project
- Tạo Project mới trong Supabase.
- Lấy 2 biến môi trường:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
- Cập nhật file `.env` của ứng dụng (xem `.env.example`).

```powershell
# Windows PowerShell
Copy-Item .env.example .env -Force
notepad .env  # cập nhật URL và ANON_KEY
```

## 2) Cài đặt Database schema + logic
- Mở Supabase > SQL Editor.
- Dán toàn bộ nội dung file `deploy/MASTER-INSTALL.sql` và chạy một lần.
  - Script này tạo đầy đủ bảng, enum, RLS, trigger, function:
    - profiles, projects, project_members, tasks (kèm định kỳ), task_assignees,
      task_attachments, notifications, reminder_settings, task_reminders…
    - logic định kỳ, nhắc việc, bắt buộc PDF trước khi hoàn thành tuần/tháng,
      auto-uncomplete khi xóa PDF, copy multi-assignees qua kỳ sau.
  - Tự tạo Storage buckets cơ bản: `project-docs`, `task-reports`, `task-attachments`.
- Kết thúc: Kiểm tra không có lỗi đỏ trong SQL Editor.

## 3) Lên lịch nhiệm vụ định kỳ (tùy chọn nhưng nên bật)
Script đã cố gắng bật `pg_cron` và tạo 2 lịch:
- Gửi nhắc việc: mỗi 15 phút → `send_task_reminders()`
- Tạo công việc định kỳ: 05:00 mỗi ngày → `auto_create_recurring_task()`

Nếu dự án không hỗ trợ `pg_cron`, bạn có 2 cách thay thế:
- Supabase Scheduled Functions (Edge Functions Scheduler) gọi RPC PostgREST:
  - POST /rest/v1/rpc/send_task_reminders
  - POST /rest/v1/rpc/auto_create_recurring_task
- Hoặc một worker ngoài (CI, Windows Task Scheduler) gọi endpoints trên định kỳ.

## 4) Tạo user và phân quyền
- Tạo users trong Supabase Auth (Dashboard > Authentication > Users).
- Trigger `handle_new_user` sẽ tự tạo dòng trong bảng `profiles`.
- Gán role trong metadata (manager, admin, user) nếu cần.

## 5) Chạy ứng dụng
- Cập nhật `.env` đã xong ở bước 1.
- Dev:
```powershell
npm install
npm run dev
```
- Đóng gói Windows:
```powershell
npm run win:rebuild   # sạch dữ liệu cũ + build mới
# hoặc chỉ build lại (giữ appdata):
npm run electron:build:win
```

## 6) Dữ liệu mẫu (tùy chọn)
- Có thể dùng các script mẫu trong thư mục gốc:
  - `insert-sample-projects.sql`
  - `insert-sample-tasks.sql`
- Chạy trong Supabase SQL Editor khi cần demo nhanh.

## 7) Lưu ý & Nâng cao
- Storage Policies hiện đặt ở mức an toàn cơ bản cho user đăng nhập; xem thêm `storage-policies.sql` để siết chặt hơn theo dự án/công việc.
- Nếu muốn dùng logo riêng: đặt `public/ibst-logo.png` (512×512) rồi:
```powershell
npm run icon:prep
npm run icon:gen
npm run electron:build:win
```
- Tuân thủ RLS: mọi truy vấn cần user có quyền theo `project_members`/`tasks`.

---
Hoàn tất! Bạn đã có gói triển khai nhanh cho dự án Supabase mới. Nếu gặp lỗi khi chạy script, chụp lại thông báo và gửi để mình hỗ trợ.
