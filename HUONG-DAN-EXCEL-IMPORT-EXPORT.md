# Hướng dẫn Import/Export Excel

## 📋 Tổng quan

Hệ thống hỗ trợ import/export dữ liệu qua file Excel với tính năng **preview và chọn hàng/cột** trước khi thực hiện.

---

## 🚀 Tính năng chính

### ✅ Import Excel
- **Upload file**: Chọn file .xlsx hoặc .xls
- **Preview table**: Xem trước toàn bộ dữ liệu
- **Chọn hàng**: Checkbox để chọn hàng nào cần import
- **Chọn cột**: Checkbox để chọn cột nào cần import
- **Search**: Tìm kiếm trong dữ liệu
- **Pagination**: Phân trang nếu dữ liệu nhiều
- **Validation**: Kiểm tra dữ liệu trước khi import

### ✅ Export Excel
- **Chọn cột export**: Checkbox chọn cột
- **Đặt tên file**: Tùy chỉnh tên file output
- **Preview**: Xem trước 5 hàng đầu
- **Auto-size columns**: Tự động điều chỉnh độ rộng cột
- **Download**: Tải file .xlsx

---

## 📁 Template Excel

### Tasks Template (Công việc)

| Tiêu đề | Mô tả | Dự án | Người thực hiện | Độ ưu tiên | Ngày bắt đầu | Ngày hết hạn | Trạng thái |
|---------|-------|-------|-----------------|------------|--------------|--------------|------------|
| Thiết kế giao diện | Thiết kế UI/UX cho trang chủ | Dự án A | Nguyễn Văn A | cao | 2025-01-01 | 2025-01-15 | mới |
| Phát triển API | Xây dựng REST API | Dự án A | Trần Thị B | cao | 2025-01-05 | 2025-01-20 | đang làm |

**Lưu ý:**
- `Độ ưu tiên`: thấp, trung bình, cao, khẩn cấp
- `Trạng thái`: mới, đang làm, đang kiểm tra, hoàn thành, bị trì hoãn, quá hạn
- `Ngày`: Định dạng YYYY-MM-DD hoặc DD/MM/YYYY

### Projects Template (Dự án)

| Mã dự án | Tên dự án | Mô tả | Khách hàng | Ngày bắt đầu | Ngày kết thúc | Trạng thái | Ngân sách |
|----------|-----------|-------|------------|--------------|---------------|------------|-----------|
| DA-001 | Website bán hàng | Xây dựng website thương mại điện tử | Công ty ABC | 2025-01-01 | 2025-06-30 | đang tiến hành | 500000000 |
| DA-002 | App di động | Ứng dụng quản lý bán hàng | Công ty XYZ | 2025-02-01 | 2025-08-31 | đang lên kế hoạch | 800000000 |

**Lưu ý:**
- `Mã dự án`: Duy nhất, không trùng
- `Trạng thái`: đang lên kế hoạch, đang tiến hành, tạm dừng, hoàn thành, hủy bỏ
- `Ngân sách`: Số tiền (VNĐ)

### Staff Template (Nhân sự)

| Họ tên | Email | Số điện thoại | Ngày sinh | Ngày vào làm | Vai trò | Trạng thái |
|--------|-------|---------------|-----------|--------------|---------|------------|
| Nguyễn Văn A | nguyenvana@email.com | 0901234567 | 1990-01-15 | 2020-03-01 | user | Hoạt động |
| Trần Thị B | tranthib@email.com | 0907654321 | 1992-05-20 | 2021-06-15 | admin | Hoạt động |

**Lưu ý:**
- `Email`: Định dạng email hợp lệ, duy nhất
- `Vai trò`: user, admin, manager
- `Trạng thái`: Hoạt động, Vô hiệu

---

## 🎯 Hướng dẫn sử dụng

### Import dữ liệu

1. **Chuẩn bị file Excel**
   - Download template từ hệ thống
   - Điền đầy đủ dữ liệu theo format
   - Lưu file .xlsx

2. **Upload file**
   - Click nút **"Import Excel"**
   - Chọn file từ máy tính
   - Đợi hệ thống đọc file

3. **Preview và chọn dữ liệu**
   - Xem toàn bộ dữ liệu trong bảng
   - **Chọn cột**: Click checkbox ở header cột
   - **Chọn hàng**: Click checkbox ở đầu hàng
   - **Chọn tất cả**: Click nút "Chọn tất cả hàng" hoặc "Chọn tất cả cột"
   - **Tìm kiếm**: Gõ từ khóa vào ô search

4. **Xác nhận import**
   - Kiểm tra số hàng/cột đã chọn
   - Click **"Xác nhận import"**
   - Chờ hệ thống xử lý

5. **Kết quả**
   - Thông báo thành công/thất bại
   - Danh sách lỗi (nếu có)
   - Dữ liệu được thêm vào hệ thống

### Export dữ liệu

1. **Mở modal export**
   - Click nút **"Export Excel"**
   - Modal preview hiển thị

2. **Chọn cột cần export**
   - Click checkbox các cột muốn xuất
   - Hoặc click "Chọn tất cả"

3. **Đặt tên file**
   - Nhập tên file (không có đuôi .xlsx)
   - Mặc định: export, tasks, projects, staff...

4. **Preview (tùy chọn)**
   - Click "Hiện preview"
   - Xem 5 hàng đầu tiên

5. **Export**
   - Click **"Export Excel"**
   - File sẽ tự động download

---

## ⚙️ Tính năng nâng cao

### Validation tự động

Khi import, hệ thống tự động kiểm tra:
- ✅ Email đúng định dạng
- ✅ Số điện thoại hợp lệ
- ✅ Ngày tháng đúng format
- ✅ Trường bắt buộc không để trống
- ✅ Giá trị trong danh sách cho phép
- ✅ Độ dài ký tự

### Column mapping

Hệ thống tự động map cột Excel với field database:
- Tiêu đề → title
- Mô tả → description
- Dự án → project_id (tự động tìm project)
- Người thực hiện → assigned_to (tự động tìm user)
- Ngày bắt đầu → start_date
- Ngày hết hạn → due_date

### Error handling

Nếu có lỗi khi import:
- Hiển thị danh sách lỗi chi tiết
- Vị trí hàng bị lỗi
- Loại lỗi
- Giá trị không hợp lệ
- Hướng dẫn sửa lỗi

---

## 💡 Tips & Tricks

### Import
- ✅ **Chuẩn bị data**: Làm sạch dữ liệu Excel trước khi import
- ✅ **Kiểm tra format**: Đảm bảo ngày tháng đúng định dạng
- ✅ **Test nhỏ**: Import vài hàng test trước khi import hàng loạt
- ✅ **Backup**: Backup dữ liệu trước khi import để tránh mất data
- ✅ **Chọn cột cần thiết**: Không nhất thiết phải import hết các cột

### Export
- ✅ **Chọn cột**: Chỉ export những cột cần thiết để file nhẹ
- ✅ **Preview**: Luôn preview trước khi export
- ✅ **Đặt tên rõ ràng**: tasks_2025-01-15.xlsx
- ✅ **Export thường xuyên**: Backup định kỳ

---

## 🐛 Troubleshooting

### Lỗi "Không thể đọc file"
→ Đảm bảo file là .xlsx hoặc .xls (không phải .csv)

### Lỗi "File không có dữ liệu"
→ Kiểm tra Sheet đầu tiên có dữ liệu không

### Lỗi validation
→ Xem chi tiết lỗi trong danh sách errors, sửa data và thử lại

### Import chậm
→ File quá lớn, chia nhỏ thành nhiều file < 1000 hàng

### Export thiếu cột
→ Kiểm tra đã chọn đủ các cột chưa trong modal

---

## 📊 Giới hạn

- **File size**: Tối đa 10MB
- **Số hàng**: Khuyến nghị < 5000 hàng/lần import
- **Format**: Chỉ hỗ trợ .xlsx và .xls
- **Sheets**: Chỉ đọc sheet đầu tiên

---

## 🔧 Technical

### Libraries
- **xlsx** (SheetJS): Xử lý file Excel
- **React**: UI components
- **Tailwind CSS**: Styling

### API
```javascript
// Import
import ExcelService from '../utils/excelService'
const result = await ExcelService.readExcelFile(file)

// Export
ExcelService.exportToExcel(data, fileName, options)
```

### Components
- `ExcelImportButton`: Nút import với preview
- `ExcelExportButton`: Nút export với chọn cột
- `ExcelPreviewModal`: Modal preview data
- `ExcelExportModal`: Modal chọn cột export
- `ExcelService`: Service xử lý Excel

---

## 📞 Support

Nếu gặp vấn đề:
1. Đọc lại hướng dẫn này
2. Kiểm tra format Excel template
3. Xem console log để debug
4. Liên hệ admin hệ thống

---

**Cập nhật:** October 2025  
**Version:** 1.0.0
