# Hệ Thống Phân Quyền Công Việc Theo Dự Án

## 🎯 Tổng Quan

Hệ thống phân quyền dựa trên **vai trò của nhân sự trong từng dự án cụ thể**. Mỗi nhân sự có thể có vai trò khác nhau ở các dự án khác nhau.

---

## 📋 Bảng Phân Quyền Chi Tiết

| Vai trò trong dự án | Xem tasks | Tạo task (cho mình) | Tạo task (cho người khác) | Sửa task | Xóa task |
|---------------------|-----------|---------------------|---------------------------|----------|----------|
| **Manager** (Toàn hệ thống) | ✅ Tất cả | ✅ | ✅ | ✅ Tất cả | ✅ Tất cả |
| **Manager** (Dự án) | ✅ Dự án đó | ✅ | ✅ | ✅ Dự án đó | ✅ Dự án đó |
| **Admin** (Dự án) | ✅ Dự án đó | ✅ | ✅ | ✅ Dự án đó | ❌ |
| **User** (Dự án) | ✅ Dự án đó | ✅ | ❌ | ✅ Của mình | ❌ |
| **Không thuộc dự án** | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🔐 Chi Tiết Quyền Hạn

### 1. **Manager Toàn Hệ Thống** (role = 'manager')
```
✅ Xem tất cả tasks của tất cả dự án
✅ Tạo task cho bất kỳ ai trong bất kỳ dự án nào
✅ Sửa bất kỳ task nào
✅ Xóa bất kỳ task nào
```

**Ví dụ:** Giám đốc, Quản lý chung

---

### 2. **Manager Dự Án** (system_role_in_project = 'manager')
```
✅ Xem tất cả tasks trong dự án này
✅ Tạo task cho bất kỳ ai trong dự án
✅ Sửa bất kỳ task nào trong dự án
✅ Xóa bất kỳ task nào trong dự án
❌ Không thấy tasks của dự án khác (nếu không tham gia)
```

**Ví dụ:** Quản lý dự án, Project Manager

**UI:**
- Dropdown "Người thực hiện": Hiển thị tất cả nhân viên active
- Nút "Thêm công việc": Hiển thị
- Nút "Sửa/Xóa": Hiển thị cho tất cả tasks trong dự án

---

### 3. **Admin Dự Án** (system_role_in_project = 'admin')
```
✅ Xem tất cả tasks trong dự án này
✅ Tạo task cho bất kỳ ai trong dự án
✅ Sửa bất kỳ task nào trong dự án
❌ KHÔNG xóa task (chỉ Manager mới xóa được)
❌ Không thấy tasks của dự án khác (nếu không tham gia)
```

**Ví dụ:** Phó quản lý dự án, Team Lead

**UI:**
- Dropdown "Người thực hiện": Hiển thị tất cả nhân viên active
- Nút "Thêm công việc": Hiển thị
- Nút "Sửa": Hiển thị cho tất cả tasks
- Nút "Xóa": KHÔNG hiển thị

---

### 4. **User Dự Án** (system_role_in_project = 'user')
```
✅ Xem tất cả tasks trong dự án này
✅ Tạo task cho CHÍNH MÌNH
❌ KHÔNG tạo task cho người khác
✅ Sửa CHÍNH tasks của mình
❌ KHÔNG sửa tasks của người khác
❌ KHÔNG xóa task
❌ Không thấy tasks của dự án khác (nếu không tham gia)
```

**Ví dụ:** Nhân viên thực hiện, Kỹ sư, Kiến trúc sư

**UI:**
- Dropdown "Người thực hiện": 
  * **DISABLED** (bị khóa)
  * Chỉ hiển thị: "Tên của mình (Tôi)"
  * **Tự động chọn** khi chọn dự án
- Nút "Thêm công việc": Hiển thị
- Nút "Sửa": Chỉ hiển thị cho tasks được giao cho mình
- Nút "Xóa": KHÔNG hiển thị
- Thông báo: "Bạn chỉ có thể tạo công việc cho chính mình"

---

### 5. **Không Thuộc Dự Án**
```
❌ KHÔNG thấy dự án trong dropdown filter
❌ KHÔNG thấy bất kỳ task nào của dự án
❌ KHÔNG thể tạo/sửa/xóa task
```

**UI:**
- Dự án không xuất hiện trong danh sách
- Nếu không thuộc dự án nào: Hiển thị warning màu vàng
  ```
  ⚠️ Bạn chưa được phân công vào dự án nào. 
     Vui lòng liên hệ quản lý để được phân quyền.
  ```

---

## 🎮 Workflow Thực Tế

### Scenario 1: User tạo công việc cho mình
```
1. User "Nguyễn Văn A" (role=user trong "Dự án X")
2. Click "Thêm công việc"
3. Chọn "Dự án X"
4. → Dropdown "Người thực hiện" TỰ ĐỘNG chọn "Nguyễn Văn A (Tôi)"
5. → Dropdown bị DISABLE (không thay đổi được)
6. Nhập tên công việc, hạn, ưu tiên...
7. Click "Tạo mới"
8. ✅ Thành công: Task được tạo với assigned_to = Nguyễn Văn A
```

### Scenario 2: User cố gắng tạo cho người khác
```
1. User "Nguyễn Văn A" (role=user)
2. Mở DevTools, thay đổi assigned_to = người khác
3. Submit form
4. ❌ Backend validation: "Bạn chỉ có thể tạo công việc cho chính mình"
5. Task KHÔNG được tạo
```

### Scenario 3: Admin tạo công việc cho team
```
1. Admin "Trần Văn B" (role=admin trong "Dự án Y")
2. Click "Thêm công việc"
3. Chọn "Dự án Y"
4. → Dropdown "Người thực hiện" hiển thị TẤT CẢ nhân viên
5. Chọn "Lê Thị C"
6. Nhập chi tiết công việc
7. Click "Tạo mới"
8. ✅ Thành công: Task giao cho Lê Thị C
```

### Scenario 4: User cố sửa task của người khác
```
1. User "Nguyễn Văn A" xem danh sách tasks
2. Thấy task của "Lê Thị C"
3. → Nút "Sửa" KHÔNG hiển thị
4. → Chỉ thấy text "Chỉ xem"
5. Nếu dùng API trực tiếp:
6. ❌ Backend validation: "Bạn không có quyền sửa công việc này"
```

### Scenario 5: Manager xóa task
```
1. Manager "Trần Văn B" (role=manager trong dự án)
2. Xem danh sách tasks
3. → Nút "Xóa" hiển thị cho TẤT CẢ tasks
4. Click "Xóa" → Confirm
5. ✅ Thành công: Task bị xóa
```

### Scenario 6: Admin cố xóa task
```
1. Admin "Phạm Văn D" (role=admin)
2. Xem danh sách tasks
3. → Nút "Xóa" KHÔNG hiển thị
4. Nếu dùng API trực tiếp:
5. ❌ Backend validation: "Bạn không có quyền xóa công việc này"
```

---

## 🔧 Implementation Details

### Frontend Validation (TasksPage.jsx)

#### Helper Functions:
```javascript
// 1. Lấy vai trò của user trong dự án
getUserRoleInProject(projectId)
  → 'manager' | 'admin' | 'user' | null

// 2. Kiểm tra quyền xem dự án
canViewProject(projectId)
  → true | false

// 3. Kiểm tra quyền tạo task
canCreateTask(projectId)
  → true (manager/admin/user) | false

// 4. Kiểm tra quyền giao việc cho người khác
canAssignToOthers(projectId)
  → true (manager/admin) | false (user)

// 5. Kiểm tra quyền sửa task
canEditTask(task)
  → true | false

// 6. Kiểm tra quyền xóa task
canDeleteTask(task)
  → true (only manager) | false
```

#### UI Logic:
```javascript
// Nút "Thêm công việc"
{accessibleProjects.some(p => canCreateTask(p.id)) && (
  <button>Thêm công việc</button>
)}

// Dropdown "Người thực hiện"
<select 
  disabled={!canAssignToOthers(formData.project_id)}
>
  {canAssignToOthers(projectId) ? (
    // Hiển thị tất cả users
    users.map(...)
  ) : (
    // Chỉ hiển thị bản thân
    <option value={profile.id}>{profile.full_name} (Tôi)</option>
  )}
</select>

// Nút "Sửa"
{canEditTask(task) && (
  <button>Sửa</button>
)}

// Nút "Xóa"
{canDeleteTask(task) && (
  <button>Xóa</button>
)}
```

#### Validation khi Submit:
```javascript
// 1. Kiểm tra quyền tạo
if (!canCreateTask(formData.project_id)) {
  toast.error('Bạn không có quyền tạo công việc trong dự án này')
  return
}

// 2. Kiểm tra quyền assign
if (formData.assigned_to !== profile.id && !canAssignToOthers(formData.project_id)) {
  toast.error('Bạn chỉ có thể tạo công việc cho chính mình')
  return
}

// 3. Kiểm tra quyền sửa
if (editingTask && !canEditTask({ ...editingTask, ...formData })) {
  toast.error('Bạn không có quyền sửa công việc này')
  return
}
```

---

### Backend Validation (RLS Policies)

#### Tasks Table Policies:
```sql
-- SELECT: Chỉ xem tasks của dự án mình tham gia
CREATE POLICY "tasks_select" ON tasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = tasks.project_id
      AND pm.user_id = auth.uid()
  ) OR
  -- Global manager xem tất cả
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'manager'
  )
);

-- INSERT: Manager/Admin tạo cho bất kỳ ai, User chỉ tạo cho mình
CREATE POLICY "tasks_insert" ON tasks
FOR INSERT WITH CHECK (
  -- Global manager
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager') OR
  
  -- Project manager/admin tạo cho bất kỳ ai
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = tasks.project_id
      AND pm.user_id = auth.uid()
      AND pm.system_role_in_project IN ('manager', 'admin')
  ) OR
  
  -- User chỉ tạo cho mình
  (
    tasks.assigned_to = auth.uid() AND
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = tasks.project_id
        AND pm.user_id = auth.uid()
        AND pm.system_role_in_project = 'user'
    )
  )
);

-- UPDATE: Manager/Admin sửa tất cả, User sửa của mình
CREATE POLICY "tasks_update" ON tasks
FOR UPDATE USING (
  -- Global manager
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager') OR
  
  -- Project manager/admin
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = tasks.project_id
      AND pm.user_id = auth.uid()
      AND pm.system_role_in_project IN ('manager', 'admin')
  ) OR
  
  -- User sửa của mình
  (
    tasks.assigned_to = auth.uid() AND
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = tasks.project_id
        AND pm.user_id = auth.uid()
    )
  )
);

-- DELETE: Chỉ Manager mới xóa được
CREATE POLICY "tasks_delete" ON tasks
FOR DELETE USING (
  -- Global manager
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager') OR
  
  -- Project manager
  EXISTS (
    SELECT 1 FROM project_members pm
    WHERE pm.project_id = tasks.project_id
      AND pm.user_id = auth.uid()
      AND pm.system_role_in_project = 'manager'
  )
);
```

---

## 📊 Test Cases

### Test 1: User tạo task cho mình ✅
```
User: Nguyễn Văn A (user trong Dự án X)
Action: Tạo task với assigned_to = Nguyễn Văn A
Expected: ✅ Thành công
```

### Test 2: User tạo task cho người khác ❌
```
User: Nguyễn Văn A (user trong Dự án X)
Action: Tạo task với assigned_to = Lê Thị B
Expected: ❌ Lỗi "Bạn chỉ có thể tạo công việc cho chính mình"
```

### Test 3: Admin tạo task cho bất kỳ ai ✅
```
User: Trần Văn C (admin trong Dự án X)
Action: Tạo task với assigned_to = Bất kỳ ai
Expected: ✅ Thành công
```

### Test 4: User sửa task của mình ✅
```
User: Nguyễn Văn A (user)
Action: Sửa task được giao cho mình
Expected: ✅ Thành công
```

### Test 5: User sửa task của người khác ❌
```
User: Nguyễn Văn A (user)
Action: Sửa task của Lê Thị B
Expected: ❌ Nút "Sửa" không hiển thị
```

### Test 6: Admin xóa task ❌
```
User: Trần Văn C (admin)
Action: Xóa task
Expected: ❌ Nút "Xóa" không hiển thị
```

### Test 7: Manager xóa task ✅
```
User: Phạm Văn D (manager)
Action: Xóa task
Expected: ✅ Thành công
```

### Test 8: User không trong dự án ❌
```
User: Nguyễn Văn E (không thuộc Dự án X)
Action: Xem tasks của Dự án X
Expected: ❌ Không thấy dự án trong filter, không thấy tasks
```

---

## 🎯 Best Practices

### 1. **Phân quyền rõ ràng:**
- Luôn kiểm tra quyền ở cả frontend VÀ backend
- Frontend: UX tốt (ẩn nút không có quyền)
- Backend: Security (RLS policies)

### 2. **User Experience:**
- User (role=user): Tự động chọn assigned_to = mình
- Hiển thị thông báo rõ ràng: "Bạn chỉ có thể tạo công việc cho chính mình"
- Disable dropdown thay vì ẩn (user biết tại sao không thay đổi được)

### 3. **Error Handling:**
- Toast messages rõ ràng
- Không crash app khi không có quyền
- Validation trước khi gọi API

### 4. **Maintainability:**
- Helper functions tập trung (getUserRoleInProject, canEditTask...)
- Comment rõ ràng
- Dễ mở rộng cho các role mới

---

## 🚀 Kết Luận

✅ **User (role=user) CÓ THỂ:**
- Xem tất cả tasks trong dự án mình tham gia
- **Tạo công việc cho CHÍNH MÌNH**
- Sửa công việc của chính mình
- Theo dõi tiến độ

❌ **User (role=user) KHÔNG THỂ:**
- Tạo/Giao công việc cho người khác
- Sửa công việc của người khác
- Xóa bất kỳ công việc nào
- Xem/Thao tác tasks của dự án không tham gia

🎯 **Mục đích:**
- Tăng tính tự chủ cho User (tự tạo task cho mình)
- Giữ quyền kiểm soát cho Manager/Admin
- Đảm bảo security và data integrity
