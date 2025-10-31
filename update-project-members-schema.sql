-- Cập nhật bảng project_members: Thêm cột position_in_project và system_role_in_project
-- Chạy script này trong Supabase SQL Editor

-- 1. Thêm cột position_in_project vào bảng project_members
ALTER TABLE project_members 
ADD COLUMN IF NOT EXISTS position_in_project VARCHAR(255);

-- 2. Thêm cột system_role_in_project để quản lý vai trò hệ thống theo từng dự án
ALTER TABLE project_members 
ADD COLUMN IF NOT EXISTS system_role_in_project VARCHAR(50) DEFAULT 'user';

-- 3. Thêm constraint cho system_role_in_project
ALTER TABLE project_members
ADD CONSTRAINT check_system_role_in_project 
CHECK (system_role_in_project IN ('user', 'admin', 'manager'));

-- 4. Thêm comment cho các cột
COMMENT ON COLUMN project_members.position_in_project IS 'Chức vụ của nhân sự trong dự án cụ thể (Kỹ sư, Giám sát viên, Trưởng nhóm, v.v.)';
COMMENT ON COLUMN project_members.system_role_in_project IS 'Vai trò hệ thống của nhân sự trong dự án này (user/admin/manager) - Mỗi người có thể có vai trò khác nhau ở các dự án khác nhau';

-- 5. Cập nhật dữ liệu hiện có - Sao chép vai trò từ bảng profiles
UPDATE project_members pm
SET system_role_in_project = COALESCE(
  (SELECT role FROM profiles WHERE id = pm.user_id),
  'user'
)
WHERE system_role_in_project IS NULL;

-- 6. Kiểm tra kết quả
SELECT 
  pm.id,
  u.full_name AS user_name,
  p.name AS project_name,
  pm.position_in_project,
  pm.role_in_project,
  pm.system_role_in_project,
  pm.created_at
FROM project_members pm
LEFT JOIN profiles u ON pm.user_id = u.id
LEFT JOIN projects p ON pm.project_id = p.id
ORDER BY pm.created_at DESC
LIMIT 10;

-- Hoàn thành!
-- Bây giờ bảng project_members đã có:
-- - position_in_project: Chức vụ trong dự án (VD: Kỹ sư giám sát, Trưởng nhóm)
-- - role_in_project: Vai trò/Nhiệm vụ (VD: Giám sát thi công, Quản lý chất lượng)
-- - system_role_in_project: Vai trò hệ thống trong dự án (user/admin/manager)
--
-- Một nhân sự có thể tham gia nhiều dự án với chức vụ/vai trò/quyền hạn khác nhau
-- VD: Anh A là Manager ở Dự án 1, nhưng chỉ là User ở Dự án 2
