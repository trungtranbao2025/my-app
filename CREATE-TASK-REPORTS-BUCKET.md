# Hướng dẫn tạo Storage Bucket "task_reports"

Để tính năng nộp báo cáo khi hoàn thành công việc định kỳ hoạt động, bạn cần tạo một bucket lưu trữ trong Supabase có tên là `task_reports`.

## Các bước thực hiện

### 1. Tạo Bucket mới

1.  Vào **Supabase Dashboard** > **Storage**.
2.  Click **"New bucket"**.
3.  Điền thông tin:
    *   **Name**: `task_reports` (Tên phải chính xác).
    *   **Public bucket**: ❌ **TẮT** (Đây là dữ liệu riêng tư).

### 2. Cài đặt Row Level Security (RLS) Policies

Vào **Storage** > click vào bucket `task_reports` > tab **"Policies"**. Tạo các policy sau:

#### Policy 1: Cho phép người dùng tải lên báo cáo cho công việc của họ

-   **Name**: `Allow own report upload`
-   **Policy type**: `INSERT`
-   **Target roles**: `authenticated`
-   **USING expression**: `true`
-   **WITH CHECK expression**:
    ```sql
    (bucket_id = 'task_reports' AND (
      SELECT count(*)
      FROM public.tasks
      WHERE (tasks.id = (string_to_array(storage.objects.name, '/'::text))[2]::uuid) AND (tasks.assigned_to = auth.uid())
    ) > 0)
    ```

#### Policy 2: Cho phép thành viên dự án xem báo cáo

-   **Name**: `Allow project members to view reports`
-   **Policy type**: `SELECT`
-   **Target roles**: `authenticated`
-   **USING expression**:
    ```sql
    (bucket_id = 'task_reports' AND (
      SELECT count(*)
      FROM public.project_members
      WHERE ((project_members.project_id = (string_to_array(storage.objects.name, '/'::text))[1]::uuid) AND (project_members.user_id = auth.uid()))
    ) > 0)
    ```

#### Policy 3: Cho phép Quản lý/Admin xóa báo cáo

-   **Name**: `Allow managers or admins to delete reports`
-   **Policy type**: `DELETE`
-   **Target roles**: `authenticated`
-   **USING expression**:
    ```sql
    (bucket_id = 'task_reports' AND (
      SELECT system_role_in_project
      FROM public.project_members
      WHERE ((project_members.project_id = (string_to_array(storage.objects.name, '/'::text))[1]::uuid) AND (project_members.user_id = auth.uid()))
    ) IN ('manager', 'admin'))
    ```

Sau khi tạo bucket và các policy này, tính năng tải file báo cáo sẽ hoạt động đúng với phân quyền.
