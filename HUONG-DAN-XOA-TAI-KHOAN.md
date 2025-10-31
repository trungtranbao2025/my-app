# Hướng dẫn sử dụng tính năng Xóa tài khoản

## Tổng quan
Hệ thống hỗ trợ 2 cách xóa tài khoản nhân sự:
1. **Vô hiệu hóa tạm thời** - Có thể khôi phục
2. **Xóa vĩnh viễn** - KHÔNG THỂ khôi phục

---

## 1. Vô hiệu hóa tạm thời (Soft Delete)

### Đặc điểm:
- ✅ Tài khoản không thể đăng nhập
- ✅ Dữ liệu được giữ nguyên trong database
- ✅ Có thể kích hoạt lại bất cứ lúc nào
- ✅ Lịch sử công việc vẫn được lưu trữ

### Cách sử dụng:
1. Vào trang **Quản lý nhân sự**
2. Nhấn nút **Xóa** (biểu tượng thùng rác) ở nhân viên cần xóa
3. Trong modal xác nhận, chọn **"Vô hiệu hóa tạm thời"** (nút màu cam)
4. Tài khoản sẽ bị vô hiệu - hiển thị với:
   - Ảnh đại diện có biểu tượng khóa
   - Tên bị gạch ngang và mờ đi
   - Nhãn "(Đã vô hiệu)" màu đỏ
   - Badge "Vô hiệu" với icon X

### Khôi phục tài khoản:
- Nhấn nút **Kích hoạt** (biểu tượng check circle màu xanh)
- Tài khoản sẽ hoạt động trở lại ngay lập tức

---

## 2. Xóa vĩnh viễn (Hard Delete)

### Đặc điểm:
- ⚠️ Xóa hoàn toàn khỏi hệ thống
- ⚠️ Xóa tất cả dữ liệu liên quan
- ⚠️ **KHÔNG THỂ khôi phục**
- ⚠️ Tài khoản auth cũng bị xóa

### Cách sử dụng:
1. Vào trang **Quản lý nhân sự**
2. Nhấn nút **Xóa** (biểu tượng thùng rác)
3. Trong modal xác nhận, chọn **"Xóa vĩnh viễn"** (nút màu đỏ)
4. Đọc kỹ cảnh báo trước khi xác nhận
5. Tài khoản sẽ bị xóa hoàn toàn

### Lưu ý quan trọng:
- Chỉ sử dụng khi chắc chắn muốn xóa vĩnh viễn
- Nên backup dữ liệu trước khi xóa
- Không thể hoàn tác sau khi xóa

---

## 3. Thiết lập Database Function (Bắt buộc cho xóa vĩnh viễn)

### Chạy SQL trong Supabase:
```sql
-- Chạy file create-delete-user-function.sql trong Supabase SQL Editor
CREATE OR REPLACE FUNCTION delete_user(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user(UUID) TO authenticated;
```

### Kiểm tra function đã tạo thành công:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'delete_user';
```

---

## 4. So sánh 2 phương pháp

| Tiêu chí | Vô hiệu hóa tạm thời | Xóa vĩnh viễn |
|----------|----------------------|---------------|
| Đăng nhập | ❌ Không thể | ❌ Không thể |
| Dữ liệu | ✅ Giữ nguyên | ❌ Xóa hết |
| Khôi phục | ✅ Có thể | ❌ Không thể |
| Lịch sử | ✅ Giữ nguyên | ❌ Mất hết |
| Auth | ✅ Còn tài khoản | ❌ Xóa tài khoản |
| Phân công dự án | ✅ Còn | ❌ Xóa |

---

## 5. Quy trình đề xuất

### Khi nhân viên nghỉ việc tạm thời:
→ Sử dụng **Vô hiệu hóa tạm thời**

### Khi nhân viên nghỉ việc vĩnh viễn:
1. Chuyển giao công việc cho người khác
2. Backup dữ liệu nếu cần
3. **Vô hiệu hóa tạm thời** trước (để giữ lịch sử)
4. Sau 6-12 tháng, nếu chắc chắn không cần → **Xóa vĩnh viễn**

### Khi tài khoản test/spam:
→ Sử dụng **Xóa vĩnh viễn** ngay

---

## 6. Giao diện Modal

### Modal xác nhận có 2 phần:

#### Phần 1: Vô hiệu hóa tạm thời (Cam)
- Icon: XCircleIcon
- Màu nền: Orange/Cam
- 3 điểm đặc trưng:
  - Tài khoản không thể đăng nhập
  - Dữ liệu được giữ nguyên
  - Có thể kích hoạt lại sau

#### Phần 2: Xóa vĩnh viễn (Đỏ)
- Icon: TrashIcon
- Màu nền: Red/Đỏ
- 3 cảnh báo:
  - Xóa hoàn toàn khỏi hệ thống
  - Xóa tất cả dữ liệu liên quan
  - **KHÔNG THỂ khôi phục** (in đậm)

#### Nút Hủy:
- Ở dưới cùng, màu xám
- Đóng modal mà không thực hiện thao tác gì

---

## 7. Styling cho tài khoản vô hiệu

### Trong bảng danh sách:
- Dòng có `opacity-60` và `bg-gray-50`
- Avatar có biểu tượng khóa overlay
- Avatar có filter `grayscale` nếu có ảnh
- Tên có `line-through` và màu xám
- Nhãn "(Đã vô hiệu)" màu đỏ
- Badge "Vô hiệu" với XCircleIcon

### Dễ nhận biết:
- Tất cả thông tin bị mờ đi
- Icon khóa rõ ràng trên avatar
- Text màu xám và gạch ngang

---

## 8. Quyền hạn

- **Manager**: Có thể xóa tất cả user
- **Admin**: Có thể xóa user (tùy cấu hình)
- **User**: KHÔNG có quyền xóa

---

## 9. Troubleshooting

### Lỗi: "Không thể xóa vĩnh viễn"
→ Kiểm tra đã chạy SQL function `delete_user` chưa

### Lỗi: "RPC delete_user not available"
→ Function chưa được tạo, vẫn xóa được profile nhưng auth còn lại

### Tài khoản vẫn đăng nhập được sau khi vô hiệu
→ Kiểm tra trường `is_active` trong database

### Muốn khôi phục tài khoản đã xóa vĩnh viễn
→ Không thể khôi phục, cần tạo tài khoản mới

---

## 10. Code Reference

### API Functions:
```javascript
// Vô hiệu hóa tạm thời
await usersApi.update(userId, { is_active: false })

// Kích hoạt lại
await usersApi.update(userId, { is_active: true })

// Xóa vĩnh viễn
await usersApi.delete(userId)
```

### Component Functions:
```javascript
// Mở modal
handleOpenDeleteModal(user)

// Soft delete
handleSoftDelete()

// Hard delete
handleHardDelete()
```
