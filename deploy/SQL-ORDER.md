# Thứ tự chạy SQL (khuyến nghị)

Chạy trong Supabase SQL Editor theo thứ tự sau để tránh xung đột enum/constraint:

1) supabase-schema.sql
2) create-project-documents.sql
3) create-task-reports-storage.sql
4) create-task-multi-assignees.sql
5) create-task-recurring-reminders.sql
6) enable-realtime.sql (nếu muốn realtime)
7) (tùy chọn) create-demo-users.sql, insert-sample-projects.sql, insert-sample-tasks.sql

Lưu ý:
- Nếu enum/type đã tồn tại ở instance khác, các script đều idempotent hoặc có DO $$ BEGIN/EXCEPTION nhằm tránh lỗi trùng.
- Nếu gặp lỗi về RLS/Policy đã tồn tại, xóa policy cũ hoặc bỏ qua thông báo trùng lặp.
- Storage buckets có thể khác nhau giữa phiên bản Supabase; script đã có nhánh fallback.
