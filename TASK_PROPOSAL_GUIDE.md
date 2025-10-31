# Hướng dẫn sử dụng tính năng Đề xuất công việc

## Tổng quan

Tính năng này cho phép:
- **Nhân sự (user)** có thể giao việc trực tiếp cho người cùng vai trò hoặc thấp hơn
- **Nhân sự** phải gửi đề xuất khi muốn giao việc cho cấp cao hơn (Admin/Manager)
- **Manager/Admin** phê duyệt hoặc từ chối đề xuất

## Cài đặt Database

### Bước 1: Chạy SQL Script
```sql
-- Chạy file: create-task-proposals.sql trong Supabase SQL Editor
```

### Bước 2: Kiểm tra
- Vào Supabase Dashboard → Table Editor
- Kiểm tra bảng `task_proposals` đã được tạo
- Kiểm tra cột `proposal_id` đã được thêm vào bảng `tasks`

## Quy tắc phân quyền

### 1. Nhân sự (User) trong dự án

**Có thể giao việc trực tiếp:**
- ✅ Cho chính mình
- ✅ Cho nhân viên khác cùng cấp (user)

**Cần đề xuất (chờ phê duyệt):**
- 📝 Giao việc cho Admin của dự án
- 📝 Giao việc cho Manager của dự án
- 📝 Giao việc cho người không phải thành viên dự án

### 2. Admin trong dự án

**Có thể giao việc trực tiếp:**
- ✅ Cho chính mình
- ✅ Cho nhân viên (user) trong dự án
- ✅ Cho admin khác trong dự án

**Cần đề xuất:**
- 📝 Giao việc cho Manager của dự án

### 3. Manager (toàn hệ thống hoặc dự án)

**Có thể giao việc trực tiếp:**
- ✅ Cho bất kỳ ai trong dự án
- ✅ Không cần phê duyệt

## Cách sử dụng

### A. Giao việc trực tiếp (User)

1. Vào **Công việc** → **Thêm công việc**
2. Chọn dự án
3. Chọn người thực hiện (chỉ hiển thị người được phép giao trực tiếp)
4. Điền thông tin công việc
5. Nhấn **Tạo mới**

### B. Gửi đề xuất công việc (User)

1. Vào **Công việc** → **Thêm công việc**
2. Chọn dự án
3. Chọn người thực hiện (Admin/Manager)
4. Hệ thống tự động chuyển sang form **Đề xuất**
5. Thêm ghi chú (tùy chọn)
6. Nhấn **Gửi đề xuất**

**Kết quả:**
- Đề xuất được gửi đến Manager/Admin của dự án
- Người dùng có thể xem trạng thái đề xuất qua nút **"Đề xuất của tôi"**

### C. Phê duyệt đề xuất (Manager/Admin)

1. Khi có đề xuất mới, nút **"Phê duyệt (X)"** xuất hiện ở header
2. Nhấn vào nút để xem danh sách đề xuất
3. Xem chi tiết:
   - Tên công việc
   - Người đề xuất
   - Người được giao
   - Thời gian, ưu tiên
   - Ghi chú
4. Chọn hành động:
   - **Duyệt**: Tạo công việc tự động
   - **Từ chối**: Nhập lý do từ chối

**Kết quả sau khi duyệt:**
- Công việc được tạo tự động
- Người thực hiện nhận nhiệm vụ
- Người đề xuất được thông báo

### D. Xem đề xuất của mình

1. Nhấn nút **"Đề xuất của tôi (X)"**
2. Xem trạng thái:
   - 🟡 **Pending**: Chờ duyệt
   - ✅ **Approved**: Đã duyệt
   - ❌ **Rejected**: Bị từ chối (có lý do)

## Luồng hoạt động

```
User (Nhân sự)
    ↓
Chọn người nhận việc
    ↓
[Hệ thống kiểm tra phân quyền]
    ↓
┌─────────────────┬─────────────────┐
│  Được phép      │  Cần phê duyệt  │
│  trực tiếp      │                 │
└────────┬────────┴────────┬────────┘
         ↓                 ↓
    Tạo công việc    Tạo đề xuất
         │                 │
         │                 ↓
         │        Gửi đến Manager/Admin
         │                 │
         │                 ↓
         │          Phê duyệt?
         │           ↙    ↘
         │       Duyệt   Từ chối
         │         │         │
         │         ↓         ↓
         └─→ Công việc   Thông báo
                            lý do
```

## Thông báo

- ✉️ Người đề xuất: Nhận thông báo khi được duyệt/từ chối
- ✉️ Người phê duyệt: Badge số lượng đề xuất chờ duyệt
- ✉️ Người thực hiện: Nhận công việc sau khi được duyệt

## Lưu ý kỹ thuật

1. **Trigger tự động**: Khi đề xuất được duyệt, hệ thống tự động:
   - Tạo task mới
   - Gán `proposal_id` vào task
   - Cập nhật trạng thái đề xuất

2. **RLS Policies**:
   - User chỉ xem được đề xuất của mình
   - Approver xem được đề xuất cần duyệt
   - Manager xem được tất cả

3. **Xóa đề xuất**:
   - User chỉ xóa được đề xuất đang pending
   - Manager có thể xóa bất kỳ đề xuất nào

## Câu hỏi thường gặp

### Q1: Tôi là User, tại sao không thấy tên Manager trong danh sách?
**A:** Khi chọn Manager, hệ thống tự động chuyển sang form Đề xuất. Điền thông tin và gửi đề xuất.

### Q2: Đề xuất của tôi bị từ chối, làm gì tiếp?
**A:** Xem lý do từ chối, chỉnh sửa lại yêu cầu và gửi đề xuất mới.

### Q3: Tôi là Admin, có cần phê duyệt khi giao việc cho User không?
**A:** Không. Admin giao việc trực tiếp cho User mà không cần phê duyệt.

### Q4: Làm sao biết đề xuất đã được duyệt?
**A:** Kiểm tra qua nút "Đề xuất của tôi". Trạng thái sẽ hiển thị "Approved" và công việc xuất hiện trong danh sách.

## Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra phân quyền trong dự án
2. Đảm bảo đã chạy SQL script
3. Kiểm tra RLS policies trong Supabase
4. Liên hệ quản trị viên hệ thống
