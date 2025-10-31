# Bắt buộc đính kèm PDF khi hoàn thành báo cáo định kỳ

## Yêu cầu
- Công việc định kỳ tuần/tháng (task_type = 'recurring' và recurrence_frequency IN ('weekly','monthly')).
- Khi bấm Hoàn thành phải có ít nhất 1 file PDF báo cáo đính kèm.

## Các thay đổi
- Frontend:
  - `src/pages/TasksPage.jsx`: thêm kiểm tra trước khi set is_completed=true. Nếu thiếu PDF, mở file-picker cho phép upload PDF lên Supabase Storage và tạo bản ghi `task_attachments`.
  - `src/lib/api.js`: thêm `getPdfReportCount`, `uploadPdfReport`.
- Backend/Storage:
  - `create-task-reports-storage.sql`: tạo bucket `task-reports` và policies cơ bản.

## Kích hoạt trên Supabase
1) Chạy SQL tạo bucket/policy:
   - File: `create-task-reports-storage.sql`
2) Đảm bảo bảng `task_attachments` đã tồn tại (xem `supabase-schema.sql`).
3) Nếu muốn bucket private: đổi public=>false và sử dụng `createSignedUrl` thay vì `getPublicUrl`.

## Lưu ý bảo mật
- Kiểm soát kích thước file, mime-type (hiện đã check application/pdf ở client; có thể bổ sung check ở Edge Function nếu cần).
- Có thể thêm RLS cho `task_attachments` để chỉ người trong dự án xem được (hiện dự án đã bật RLS trên bảng này).

## Kiểm thử nhanh
- Tạo một nhiệm vụ định kỳ tuần hoặc tháng.
- Bấm Hoàn thành → app yêu cầu chọn file PDF → upload thành công → nhiệm vụ được đánh dấu hoàn thành.
