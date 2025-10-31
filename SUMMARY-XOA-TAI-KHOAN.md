# Tóm tắt: Tính năng Xóa tài khoản có 2 tùy chọn

## ✅ Đã hoàn thành

### 1. **UI Components - StaffPage.jsx**
- ✅ Thêm state `showDeleteModal` và `deletingUser`
- ✅ Thêm import `LockClosedIcon` từ Heroicons
- ✅ Thêm nút **Xóa** (TrashIcon màu đỏ) vào mỗi dòng trong bảng
- ✅ Tạo modal xác nhận xóa với 2 tùy chọn rõ ràng:
  - **Vô hiệu hóa tạm thời** (màu cam/orange)
  - **Xóa vĩnh viễn** (màu đỏ/red)
- ✅ Styling đặc biệt cho tài khoản đã vô hiệu:
  - Avatar có icon khóa overlay
  - Avatar grayscale nếu có ảnh
  - Tên bị gạch ngang và mờ đi
  - Nhãn "(Đã vô hiệu)" màu đỏ
  - Dòng có opacity 60% và background xám

### 2. **Business Logic - StaffPage.jsx**
- ✅ `handleOpenDeleteModal(user)` - Mở modal xác nhận
- ✅ `handleSoftDelete()` - Vô hiệu hóa tạm thời (set is_active = false)
- ✅ `handleHardDelete()` - Xóa vĩnh viễn (gọi API delete)
- ✅ Toast notifications cho từng hành động
- ✅ Reload danh sách sau khi thực hiện

### 3. **API Layer - api.js**
- ✅ Thêm hàm `usersApi.delete(id)` với logic:
  - Xóa profile từ bảng `profiles`
  - Thử gọi RPC function `delete_user` để xóa auth
  - Fallback gracefully nếu RPC không có
  - Error handling đầy đủ

### 4. **Database Function - SQL**
- ✅ Tạo file `create-delete-user-function.sql`
- ✅ Function `delete_user(user_id UUID)` với SECURITY DEFINER
- ✅ Grant permission cho authenticated users
- ✅ Comment và documentation

### 5. **Documentation**
- ✅ Tạo file `HUONG-DAN-XOA-TAI-KHOAN.md` với:
  - Hướng dẫn sử dụng chi tiết
  - So sánh 2 phương pháp
  - Quy trình đề xuất
  - Troubleshooting
  - Code reference

---

## 📋 Cách sử dụng

### Bước 1: Chạy SQL trong Supabase
```bash
# Mở Supabase SQL Editor
# Copy nội dung file: create-delete-user-function.sql
# Paste và chạy
```

### Bước 2: Test tính năng
1. Vào trang **Quản lý nhân sự**
2. Nhấn nút **Xóa** (icon thùng rác đỏ)
3. Chọn 1 trong 2 tùy chọn:
   - **Vô hiệu hóa tạm thời**: Tài khoản mờ đi, có icon khóa
   - **Xóa vĩnh viễn**: Tài khoản biến mất hoàn toàn

### Bước 3: Kiểm tra khôi phục
- Với tài khoản đã vô hiệu, nhấn nút **Kích hoạt** (icon check màu xanh)
- Tài khoản sẽ hoạt động trở lại ngay lập tức

---

## 🎨 UI/UX Features

### Modal Design
- **Header**: Icon thùng rác + tên/email người dùng
- **2 Card options**: 
  - Orange card (Vô hiệu hóa tạm thời)
  - Red card (Xóa vĩnh viễn)
- **Mỗi card có**:
  - Icon đặc trưng
  - Tiêu đề rõ ràng
  - 3 bullet points giải thích
  - Button action với màu tương ứng
- **Nút Hủy**: Màu xám ở dưới cùng

### Visual Indicators cho tài khoản vô hiệu
- Dòng trong table: `opacity-60 bg-gray-50`
- Avatar: Icon khóa overlay + grayscale
- Tên: `line-through text-gray-500`
- Label: "(Đã vô hiệu)" màu đỏ
- Badge: "Vô hiệu" với XCircleIcon

---

## 🔧 Technical Details

### State Management
```javascript
const [showDeleteModal, setShowDeleteModal] = useState(false)
const [deletingUser, setDeletingUser] = useState(null)
```

### API Calls
```javascript
// Soft delete
await usersApi.update(userId, { is_active: false })

// Hard delete
await usersApi.delete(userId)
```

### Database
```sql
-- RPC Function
CREATE OR REPLACE FUNCTION delete_user(user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;
```

---

## ⚠️ Important Notes

### Vô hiệu hóa tạm thời
- ✅ Có thể khôi phục
- ✅ Giữ toàn bộ dữ liệu
- ✅ Không thể đăng nhập
- ✅ Hiển thị rõ ràng trong danh sách

### Xóa vĩnh viễn
- ⚠️ KHÔNG THỂ khôi phục
- ⚠️ Xóa profile + auth
- ⚠️ Xóa tất cả dữ liệu liên quan
- ⚠️ Cần cảnh báo rõ ràng cho user

### Best Practices
1. **Ưu tiên soft delete** cho hầu hết trường hợp
2. **Hard delete** chỉ khi chắc chắn 100%
3. **Backup dữ liệu** trước khi hard delete
4. **Chuyển giao công việc** trước khi xóa nhân viên

---

## 🚀 Files Changed

### Modified Files
1. `src/pages/StaffPage.jsx` - Main UI and logic
2. `src/lib/api.js` - Added delete API function

### New Files
1. `create-delete-user-function.sql` - Database function
2. `HUONG-DAN-XOA-TAI-KHOAN.md` - User guide
3. `SUMMARY-XOA-TAI-KHOAN.md` - This file

---

## ✅ Testing Checklist

- [ ] Chạy SQL function trong Supabase
- [ ] Test vô hiệu hóa tạm thời
- [ ] Test kích hoạt lại
- [ ] Test xóa vĩnh viễn
- [ ] Kiểm tra UI với tài khoản vô hiệu
- [ ] Kiểm tra không xóa được tài khoản đang đăng nhập
- [ ] Kiểm tra quyền (chỉ Manager/Admin)
- [ ] Kiểm tra toast notifications
- [ ] Kiểm tra modal đóng đúng cách
- [ ] Kiểm tra reload danh sách sau thao tác

---

## 📞 Support

Nếu có vấn đề:
1. Đọc file `HUONG-DAN-XOA-TAI-KHOAN.md`
2. Kiểm tra SQL function đã chạy chưa
3. Xem console log để debug
4. Kiểm tra quyền trong database

---

**Hoàn thành:** Tất cả 5/5 tasks ✅
