# 📋 Hướng dẫn Import/Export Nhân sự

## 🎯 Tổng quan

Trang **Quản lý nhân sự** hỗ trợ import/export danh sách nhân viên qua Excel với đầy đủ thông tin bao gồm:
- Thông tin cá nhân
- Liên hệ
- Vai trò hệ thống
- Phân công dự án
- Trạng thái

---

## 📥 Import Nhân sự từ Excel

### 1. Download Template

Click nút **"Template"** (màu tím) để tải file Excel mẫu.

Template bao gồm 2 nhân viên mẫu với đầy đủ cột cần thiết:
- Họ tên (*)
- Email (*) 
- Mật khẩu
- Số điện thoại
- Ngày sinh
- Ngày vào làm
- Vai trò (user/admin/manager)
- Trạng thái (Hoạt động/Vô hiệu)

(*) = Bắt buộc

### 2. Chuẩn bị dữ liệu

Mở file template và điền thông tin nhân viên:

```
| Họ tên       | Email                  | Mật khẩu        | Số điện thoại | Ngày sinh  | Ngày vào làm | Vai trò | Trạng thái |
|--------------|------------------------|-----------------|---------------|------------|--------------|---------|------------|
| Nguyễn Văn A | nguyenvana@company.com | Password123!    | 0901234567    | 1990-01-15 | 2020-03-01   | user    | Hoạt động  |
| Trần Thị B   | tranthib@company.com   | SecurePass456!  | 0907654321    | 1992-05-20 | 2021-06-15   | admin   | Hoạt động  |
```

**Lưu ý quan trọng:**
- ✅ **Email**: Phải duy nhất, không trùng với nhân viên đã có
- ✅ **Email format**: user@domain.com (hợp lệ)
- ✅ **Mật khẩu**: Ít nhất 6 ký tự, nếu để trống sẽ dùng `TempPassword123!`
- ✅ **Ngày tháng**: Format `YYYY-MM-DD` hoặc `DD/MM/YYYY`
- ✅ **Vai trò**: `user`, `admin`, hoặc `manager` (không phân biệt hoa thường)
- ✅ **Trạng thái**: `Hoạt động` hoặc `Vô hiệu`

### 3. Import file

1. Click nút **"Import Excel"** (màu xanh dương)
2. Chọn file Excel đã chuẩn bị
3. Hệ thống đọc và hiển thị preview
4. **Chọn hàng**: Tick checkbox nhân viên nào cần import
5. **Chọn cột**: Tick checkbox cột nào cần import
6. Click **"Xác nhận import"**

### 4. Kết quả

Hệ thống sẽ:
- ✅ Validate từng nhân viên
- ✅ Tạo tài khoản auth mới
- ✅ Tạo profile trong database
- ✅ Hiển thị số nhân viên thành công/thất bại
- ✅ Log lỗi vào console nếu có

**Thông báo thành công:**
```
✅ Import thành công 10 nhân sự!
```

**Có lỗi:**
```
❌ Có 2 nhân sự import thất bại. Xem console để biết chi tiết.
```

### 5. Kiểm tra lỗi

Nếu có nhân viên import thất bại, mở **Console** (F12) để xem chi tiết:

```javascript
{
  row: 3,
  error: "Email không hợp lệ",
  data: { ... }
}
```

Các lỗi phổ biến:
- ❌ Email không hợp lệ
- ❌ Email đã tồn tại
- ❌ Thiếu họ tên hoặc email
- ❌ Vai trò không hợp lệ

---

## 📤 Export Nhân sự ra Excel

### 1. Mở modal export

Click nút **"Export Excel"** (màu xanh lá)

Modal hiển thị với:
- Danh sách tất cả cột có thể export
- Input tên file
- Preview data

### 2. Chọn cột cần export

Tick checkbox các cột muốn xuất:
- ☑ Họ tên
- ☑ Email
- ☑ Số điện thoại
- ☑ Ngày sinh
- ☑ Ngày vào làm
- ☑ Vai trò hệ thống
- ☑ Trạng thái
- ☑ Số dự án tham gia
- ☑ Dự án
- ☑ Chức vụ trong dự án
- ☑ Vai trò trong dự án

**Mẹo:** Click **"Chọn tất cả"** để chọn hết các cột.

### 3. Đặt tên file

Mặc định: `DanhSachNhanSu.xlsx`

Có thể đổi thành:
- `NhanSu_2025-01-15.xlsx`
- `Employees_Q1_2025.xlsx`
- `Staff_Report.xlsx`

### 4. Preview (tùy chọn)

Click **"Hiện preview"** để xem 5 hàng đầu tiên

Kiểm tra:
- ✅ Dữ liệu đúng format
- ✅ Các cột cần thiết đã có
- ✅ Không có dữ liệu bị cắt

### 5. Download file

Click **"Export Excel"**

File sẽ tự động download với:
- ✅ Tất cả nhân viên đang hiển thị (sau filter)
- ✅ Các cột đã chọn
- ✅ Format đẹp, auto-size columns
- ✅ Có thể mở bằng Excel/Google Sheets

---

## 🔄 Quy trình đề xuất

### Nhập nhân viên hàng loạt

```
1. Download template
2. Điền thông tin 10-50 nhân viên
3. Save file Excel
4. Import vào hệ thống
5. Kiểm tra kết quả
6. Sửa lỗi (nếu có) và import lại
```

### Backup định kỳ

```
1. Export toàn bộ nhân viên mỗi tháng
2. Lưu file với tên: NhanSu_YYYY-MM.xlsx
3. Lưu trữ an toàn (cloud/local backup)
```

### Update thông tin hàng loạt

```
1. Export danh sách hiện tại
2. Sửa thông tin trong Excel
3. Xóa nhân viên cũ (hoặc vô hiệu hóa)
4. Import lại với thông tin mới
```

---

## 📊 Thông tin Export

### Dữ liệu cơ bản

| Cột | Mô tả | Ví dụ |
|-----|-------|-------|
| Họ tên | Tên đầy đủ | Nguyễn Văn A |
| Email | Email đăng nhập | nvana@company.com |
| Số điện thoại | SĐT liên hệ | 0901234567 |
| Ngày sinh | DD/MM/YYYY | 15/01/1990 |
| Ngày vào làm | DD/MM/YYYY | 01/03/2020 |
| Vai trò hệ thống | user/admin/manager | Nhân viên |
| Trạng thái | Hoạt động/Vô hiệu | Hoạt động |

### Dữ liệu dự án

| Cột | Mô tả | Ví dụ |
|-----|-------|-------|
| Số dự án tham gia | Tổng số dự án | 3 |
| Dự án | Danh sách tên dự án | Dự án A, Dự án B, Dự án C |
| Chức vụ trong dự án | Chức vụ | Kỹ sư giám sát, Trưởng nhóm |
| Vai trò trong dự án | Vai trò/nhiệm vụ | Giám sát thi công, Quản lý chất lượng |

**Lưu ý:** Nếu nhân viên tham gia nhiều dự án, các giá trị sẽ được nối bằng dấu phẩy.

---

## ⚙️ Tính năng nâng cao

### Validation tự động

Khi import, hệ thống kiểm tra:

✅ **Email:**
- Đúng format: `user@domain.com`
- Không trùng với email đã có
- Không để trống

✅ **Họ tên:**
- Không để trống
- Không ký tự đặc biệt lạ

✅ **Vai trò:**
- Chỉ chấp nhận: user, admin, manager
- Không phân biệt hoa thường
- Default: user nếu không hợp lệ

✅ **Trạng thái:**
- "Hoạt động" → is_active = true
- "Vô hiệu" → is_active = false
- Default: Hoạt động

✅ **Mật khẩu:**
- Tối thiểu 6 ký tự
- Default: `TempPassword123!` nếu để trống

### Column Mapping

| Excel Column | Database Field | Transform |
|--------------|----------------|-----------|
| Họ tên | full_name | trim() |
| Email | email | trim().toLowerCase() |
| Mật khẩu | password | default if empty |
| Số điện thoại | phone | trim() or null |
| Ngày sinh | birthday | date or null |
| Ngày vào làm | join_date | date or today |
| Vai trò | role | toLowerCase() |
| Trạng thái | is_active | "Hoạt động" = true |

### Error Handling

Format lỗi trong console:

```javascript
{
  success: 8,    // Số nhân viên thành công
  failed: 2,     // Số nhân viên thất bại
  errors: [
    {
      row: 3,
      error: "Email không hợp lệ",
      data: { "Họ tên": "...", "Email": "invalid" }
    },
    {
      row: 5,
      error: "Email đã tồn tại",
      data: { ... }
    }
  ]
}
```

---

## 💡 Tips & Best Practices

### Import

✅ **DO:**
- Test với 2-3 nhân viên trước
- Kiểm tra email không trùng
- Dùng password mạnh cho admin/manager
- Backup trước khi import hàng loạt
- Import theo batch 50-100 người

❌ **DON'T:**
- Import file quá lớn (> 1000 người)
- Dùng email không hợp lệ
- Để trống họ tên
- Import duplicate emails

### Export

✅ **DO:**
- Export định kỳ để backup
- Chọn đủ cột cần thiết
- Đặt tên file rõ ràng với ngày tháng
- Lưu file ở nơi an toàn

❌ **DON'T:**
- Export quá nhiều cột không cần
- Quên backup trước khi xóa nhân viên
- Share file có mật khẩu

---

## 🐛 Troubleshooting

### Lỗi: "Email không hợp lệ"
**Nguyên nhân:** Email sai format  
**Giải pháp:** Sửa thành `user@domain.com`

### Lỗi: "Email đã tồn tại"
**Nguyên nhân:** Email đã được dùng  
**Giải pháp:** Đổi email khác hoặc xóa user cũ trước

### Lỗi: "Thiếu họ tên hoặc email"
**Nguyên nhân:** Cột bắt buộc để trống  
**Giải pháp:** Điền đầy đủ họ tên và email

### Import chậm
**Nguyên nhân:** File quá lớn  
**Giải pháp:** Chia nhỏ thành nhiều file < 100 người

### Mật khẩu không work
**Nguyên nhân:** Password quá yếu hoặc để trống  
**Giải pháp:** Dùng password mạnh ít nhất 6 ký tự

---

## 🎨 UI Buttons

### Template Button (Tím)
- **Icon:** ⬇️ DocumentArrowDownIcon
- **Text:** Template
- **Action:** Download Excel template mẫu
- **Gradient:** purple-500 → pink-600

### Import Excel Button (Xanh dương)
- **Icon:** ⬆️ DocumentArrowUpIcon
- **Text:** Import Excel
- **Action:** Mở modal import với preview
- **Gradient:** blue-500 → indigo-600

### Export Excel Button (Xanh lá)
- **Icon:** ⬇️ DocumentArrowDownIcon
- **Text:** Export Excel
- **Action:** Mở modal chọn cột và export
- **Gradient:** green-500 → emerald-600
- **Disabled:** Khi không có nhân viên nào

### Thêm nhân sự Button (Cyan)
- **Icon:** ➕ PlusIcon
- **Text:** Thêm nhân sự
- **Action:** Mở modal thêm nhân viên thủ công
- **Gradient:** cyan-500 → blue-600

---

## 📞 Support

### Liên hệ
- Email: support@company.com
- Hotline: 1900-xxxx

### Resources
- Hướng dẫn chi tiết: `HUONG-DAN-EXCEL-IMPORT-EXPORT.md`
- Technical docs: `SUMMARY-EXCEL-IMPORT-EXPORT.md`
- Video tutorial: [Link]

---

**Cập nhật:** October 2025  
**Version:** 1.0.0  
**Trang:** Quản lý nhân sự
