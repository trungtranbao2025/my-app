# Hướng dẫn: Vai trò hệ thống theo từng dự án

## 📋 Tổng quan

Hệ thống đã được cập nhật để cho phép **mỗi nhân sự có vai trò hệ thống riêng biệt trong từng dự án**. 

### Trước đây:
- Mỗi nhân sự chỉ có **1 vai trò hệ thống duy nhất** áp dụng cho tất cả dự án
- Anh A là Manager → Anh A có quyền Manager ở **TẤT CẢ** dự án

### Bây giờ:
- Mỗi nhân sự có **vai trò hệ thống khác nhau** ở mỗi dự án
- Anh A có thể là:
  - **Manager** ở Dự án A (có quyền quản lý dự án A)
  - **User** ở Dự án B (chỉ là nhân viên thông thường ở dự án B)
  - **Admin** ở Dự án C (có quyền quản trị ở dự án C)

## 🔧 Cấu trúc dữ liệu mới

### Bảng `project_members` đã được thêm:

| Cột | Mô tả | Ví dụ |
|-----|-------|-------|
| `position_in_project` | Chức vụ trong dự án | "Kỹ sư giám sát", "Trưởng nhóm" |
| `role_in_project` | Vai trò/Nhiệm vụ trong dự án | "Giám sát thi công", "Quản lý chất lượng" |
| `system_role_in_project` | **MỚI**: Vai trò hệ thống trong dự án | "user", "admin", "manager" |

### Bảng `profiles` (không thay đổi):

| Cột | Mô tả | Ghi chú |
|-----|-------|---------|
| `role` | Vai trò hệ thống chung | **VẪN TỒN TẠI** để tương thích ngược |

## 📊 Ví dụ thực tế

### Nhân sự: Nguyễn Văn A

| Dự án | Chức vụ | Vai trò/Nhiệm vụ | Vai trò hệ thống |
|-------|---------|------------------|-------------------|
| Dự án A | Giám đốc dự án | Quản lý toàn bộ dự án | **Manager** |
| Dự án B | Kỹ sư | Giám sát kỹ thuật | **User** |
| Dự án C | Phó giám đốc | Quản lý chất lượng | **Admin** |

→ Nguyễn Văn A có quyền **Manager** (toàn quyền) ở Dự án A, nhưng chỉ là **User** (hạn chế) ở Dự án B.

## 🚀 Cách sử dụng

### 1. Chạy SQL Migration

Trước tiên, chạy script SQL để cập nhật database:

```bash
# Mở Supabase SQL Editor và chạy file:
update-project-members-schema.sql
```

Script này sẽ:
- ✅ Thêm cột `position_in_project`
- ✅ Thêm cột `system_role_in_project` 
- ✅ Thiết lập constraint (chỉ cho phép: user/admin/manager)
- ✅ Sao chép vai trò từ bảng `profiles` làm giá trị mặc định

### 2. Thêm/Sửa nhân sự vào dự án

#### Trên trang Nhân sự:

1. **Chọn nhân sự** → Click nút "Sửa"
2. Trong phần "**Dự án tham gia**", click "**+ Thêm vào dự án**"
3. Điền các thông tin:
   - **Dự án**: Chọn dự án cần thêm
   - **Chức vụ trong dự án**: VD: "Kỹ sư giám sát"
   - **Vai trò/Nhiệm vụ**: VD: "Giám sát thi công"
   - **Vai trò hệ thống trong dự án**: Chọn **User** / **Admin** / **Manager**

4. Click "**Lưu**"

#### Sửa vai trò hệ thống:

1. Trong danh sách "Dự án tham gia", click icon **Sửa** (✏️) bên cạnh tên dự án
2. Thay đổi "**Vai trò hệ thống trong dự án**"
3. Click "**Lưu**"

### 3. Hiển thị trên giao diện

Trên trang **Nhân sự**, cột "**Dự án tham gia**" sẽ hiển thị:

```
Dự án ABC - Kỹ sư giám sát (Giám sát thi công)
[Quản lý]  ← Badge vai trò hệ thống

Dự án XYZ - Kỹ sư (Kiểm tra chất lượng)
[Nhân viên]  ← Badge vai trò hệ thống
```

### 4. Phân quyền theo dự án

Khi implement logic phân quyền, bạn có thể:

```javascript
// Kiểm tra quyền của user trong dự án cụ thể
const userRoleInProject = projectMember.system_role_in_project;

if (userRoleInProject === 'manager') {
  // Cho phép chỉnh sửa dự án, xóa task, etc.
} else if (userRoleInProject === 'admin') {
  // Cho phép chỉnh sửa task, thêm nhân sự
} else {
  // Chỉ xem và cập nhật task của mình
}
```

## 📁 Files đã thay đổi

### 1. **SQL Schema**
- `update-project-members-schema.sql` - Script migration database

### 2. **Backend API**
- `src/lib/api.js`
  - `projectsApi.addMember()` - Thêm parameter `systemRoleInProject`
  - `projectsApi.updateMemberRole()` - Thêm parameter `systemRoleInProject`
  - Tất cả SELECT queries đã include `system_role_in_project`

### 3. **Frontend Components**
- `src/pages/StaffPage.jsx`
  - Xóa "Vai trò hệ thống" khỏi form thông tin chung
  - Thêm "Vai trò hệ thống trong dự án" vào form thêm/sửa dự án
  - Hiển thị badge vai trò hệ thống trong danh sách dự án tham gia
  - Cập nhật state management cho `systemRoleInProject`

## ⚠️ Lưu ý quan trọng

1. **Tương thích ngược**: Cột `role` trong bảng `profiles` vẫn tồn tại để tương thích với code cũ.

2. **Giá trị mặc định**: Khi thêm nhân sự vào dự án, nếu không chọn vai trò hệ thống, mặc định là `user`.

3. **Constraint**: Chỉ chấp nhận 3 giá trị: `user`, `admin`, `manager` (lowercase).

4. **Migration**: Dữ liệu cũ sẽ được tự động sao chép từ `profiles.role` sang `project_members.system_role_in_project`.

## 🎯 Lợi ích

✅ **Linh hoạt hơn**: Một người có thể quản lý dự án này nhưng chỉ là thành viên ở dự án khác

✅ **Bảo mật tốt hơn**: Phân quyền chi tiết theo từng dự án

✅ **Phản ánh thực tế**: Trong thực tế, người quản lý dự án A không nhất thiết quản lý dự án B

✅ **Dễ quản lý**: Thêm/bớt quyền hạn theo dự án mà không ảnh hưởng dự án khác

## 🔍 Kiểm tra kết quả

Sau khi chạy migration, kiểm tra trong Supabase SQL Editor:

```sql
SELECT 
  u.full_name,
  p.name AS project_name,
  pm.position_in_project,
  pm.role_in_project,
  pm.system_role_in_project
FROM project_members pm
JOIN profiles u ON pm.user_id = u.id
JOIN projects p ON pm.project_id = p.id
ORDER BY u.full_name, p.name;
```

## 📞 Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra lại đã chạy SQL migration chưa
2. Kiểm tra console browser (F12) xem có lỗi API không
3. Kiểm tra Supabase logs xem có lỗi RLS policy không
