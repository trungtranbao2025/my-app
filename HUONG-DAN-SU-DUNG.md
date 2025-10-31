# 📘 HƯỚNG DẪN SỬ DỤNG IBST BIM - QUẢN LÝ DỰ ÁN

## 🎯 Giới thiệu

**IBST BIM - Quản lý Dự án** là phần mềm quản lý dự án xây dựng chuyên nghiệp, được thiết kế dành riêng cho các công ty tư vấn và giám sát thi công.

### ✨ Tính năng chính:

- 📊 **Quản lý Dự án**: Theo dõi tiến độ, ngân sách, trạng thái dự án
- ✅ **Quản lý Nhiệm vụ**: Phân công công việc, tracking tiến độ
- 👥 **Quản lý Nhân sự**: Quản lý thông tin nhân viên, vai trò
- 📁 **Import/Export Excel**: Nhập xuất dữ liệu hàng loạt
- 🔔 **Thông báo**: Cập nhật real-time về công việc
- 📈 **Dashboard**: Báo cáo tổng quan trực quan

---

## 💻 Cài đặt

### Yêu cầu hệ thống:
- **Hệ điều hành**: Windows 10 trở lên (64-bit)
- **RAM**: Tối thiểu 4GB (khuyến nghị 8GB)
- **Ổ cứng**: 500MB trống
- **Kết nối Internet**: Cần thiết để đồng bộ dữ liệu

### Các bước cài đặt:

   - File: `IBST BIM - Quản lý Dự án-1.0.0-Setup.exe`
   - Kích thước: ~150-200MB

   - Double-click vào file `.exe`
   - Chọn thư mục cài đặt (mặc định theo người dùng: `%LOCALAPPDATA%\\Programs\\IBST BIM - Quản lý Dự án`)

   - Thời gian: ~2-5 phút

4. **Hoàn tất**
   - Chọn "Launch IBST BIM - Quản lý Dự án"
   - Hoặc tìm shortcut trên Desktop/Start Menu
5. **Bản Portable (không cần cài đặt)**
   - Sử dụng file `IBST BIM - Quản lý Dự án-1.0.0-Portable.exe`
   - Chạy trực tiếp, không tạo shortcut hay ghi cài đặt hệ thống

---

1. Mở ứng dụng
2. Nhập **Email** và **Mật khẩu**


   - Toàn quyền xem/chỉnh sửa dữ liệu
   - Tạo/sửa/xóa dự án, phân công nhân sự, cấu hình hệ thống
- Admin (Quản trị):
   - Gần như tương đương Manager (theo chính sách công ty), hỗ trợ quản trị người dùng
- User (Nhân viên):
   - Chỉ xem các dự án/công việc mình tham gia
   - Cập nhật tiến độ công việc được giao, tải báo cáo

Lưu ý: Quyền xem dữ liệu phụ thuộc RLS theo thành viên dự án.

---

## �📊 Các module chính

### 1. 📈 Dashboard (Trang chủ)

Hiển thị tổng quan:
- Tổng số dự án đang hoạt động
- Số lượng nhiệm vụ cần làm
- Tiến độ các dự án
- Biểu đồ thống kê

**Cách sử dụng:**
- Xem thông tin tổng quan
- Filter theo thời gian (Tuần, Tháng, Quý)

---

### 2. 📁 Quản lý Dự án

**Xem danh sách dự án:**
- Tìm kiếm theo tên/mã dự án

1. Click nút **"+ Thêm dự án"**
2. Điền thông tin:
   - Mã dự án (bắt buộc)
   - Tên dự án (bắt buộc)
   - Mô tả

**Sửa/Xóa dự án:**
- Click vào icon ✏️ để sửa
- Click vào icon 🗑️ để xóa (cần xác nhận)

**Tài liệu Dự án (Biên bản họp):**
- Xóa tài liệu: chỉ người tải lên, quản lý dự án, hoặc vai trò hệ thống admin/manager mới được xóa
- Lưu ý: Thư mục lưu trữ trực tuyến, có thể tạo link công khai để tải nhanh

---


**Xem nhiệm vụ:**
- Danh sách tất cả công việc
  - Trạng thái: Mới, Đang làm, Hoàn thành
  - Mức độ ưu tiên: Cao, Trung bình, Thấp
  - Dự án

**Thêm nhiệm vụ:**
1. Click **"+ Thêm công việc"**
2. Điền:
   - Tên công việc
   - Mô tả chi tiết
   - Chọn dự án
   - Người thực hiện (có thể chọn nhiều người)
   - Deadline
- Hoặc nhập % hoàn thành
- Thay đổi trạng thái

- Chọn 1 người thực hiện chính và có thể tick thêm nhiều người thực hiện phụ
- Trong bảng, cột "Người thực hiện" sẽ hiển thị tên chính + dấu "+N" (số phụ)

**Báo cáo Công việc (Task Reports):**
- Mở modal "Báo cáo" trong trang Công việc
**Công việc định kỳ & Nhắc việc:**
- Chọn loại công việc "Định kỳ" và cấu hình tần suất: tuần/tháng/quý…
- Hệ thống tạo mốc neo (ví dụ thứ trong tuần hoặc ngày trong tháng)
- Nhắc việc tự động: trước hạn (ví dụ 24h), đúng ngày hạn, và trước ngày chu kỳ tiếp theo
   - Cập nhật mốc kỳ kế tiếp để tránh trùng

**Ràng buộc PDF trước khi hoàn thành (tuần/tháng):**
- Nếu là công việc định kỳ tuần hoặc tháng, khi bấm hoàn thành, hệ thống sẽ kiểm tra:
   - Có ít nhất 1 file PDF báo cáo được đính kèm
   - Nếu xóa hết PDF sau khi hoàn thành, công việc sẽ tự động chuyển về chưa hoàn thành
- **Export**: Click nút **"Export Excel"** → Chọn cột cần xuất → Tải file
- **Import**: Click nút **"Import Excel"** → Chọn file → Preview → Import

### 4. 👥 Quản lý Nhân sự

**Xem danh sách:**
- Tất cả nhân viên
   - Cột "Hoạt động" (3-trong-1): hiển thị đồng thời số lần đăng nhập 7 ngày gần nhất, thời điểm đăng nhập cuối, và trạng thái trực tuyến (Online/Offline). Trạng thái được cập nhật tự động mỗi phút.
1. Click **"+ Thêm nhân sự"**
2. Điền:
   - Họ tên (bắt buộc)
   - Email (bắt buộc)
   - Ngày sinh
   - Ngày vào làm
1. Click **"Import Excel"**
2. Chọn file Excel (.xlsx)
3. Preview dữ liệu

**Export danh sách:**
1. Click **"Export Excel"**
3. Nhập tên file
4. Click **"Xuất file"**
5. File Excel được tải về với format đẹp

> Ghi chú (Admin): Để bật theo dõi hoạt động đăng nhập, hãy chạy file SQL `create-user-activity-tracking.sql` trong thư mục gốc (Supabase > SQL editor). File này sẽ tạo bảng `login_events`, `user_presence`, view `user_activity_summary` và RPC `record_login`, `heartbeat`. Sau khi chạy, ứng dụng sẽ tự ghi nhận đăng nhập và trạng thái trực tuyến.

---

## 🧭 Quy trình thao tác gợi ý (Step-by-step)

1) Tạo dự án mới
- Vào Quản lý Dự án → "+ Thêm dự án" → nhập mã, tên, thời gian, người quản lý → Lưu

2) Thêm nhân sự
- Vào Quản lý Nhân sự → "+ Thêm nhân sự" → nhập họ tên, email, vai trò → Lưu
- Hoặc Import Excel để thêm hàng loạt

3) Phân công nhân sự vào dự án
- Mở chi tiết nhân sự → Thêm vào dự án → chọn vai trò/chức vụ trong dự án → Lưu

4) Tạo công việc
- Vào Quản lý Nhiệm vụ → "+ Thêm công việc" → chọn dự án → chọn người thực hiện chính và phụ → đặt deadline/ưu tiên → Lưu

5) Báo cáo công việc (nếu định kỳ tuần/tháng)
- Mở công việc → "Báo cáo" → Upload PDF
- Sau khi có PDF hợp lệ, mới được đánh dấu Hoàn thành

6) Hoàn thành công việc định kỳ
- Bấm Hoàn thành → Hệ thống dừng nhắc việc, tạo kỳ tiếp theo tự động, sao chép người thực hiện phụ

7) Tài liệu dự án (Biên bản)
- Mở dự án → tab Tài liệu → Upload file → Tìm kiếm/sắp xếp/xóa khi cần

---

## 📁 Làm việc với Excel

### ✅ Xuất dữ liệu ra Excel

**Tính năng:**
- Header màu xanh dương, chữ trắng, đậm
- Các hàng xen kẽ màu xám/trắng
- Border rõ ràng cho tất cả ô
- Cột tự động rộng vừa đủ
- Đóng băng header khi scroll
- Auto-filter cho mỗi cột

**Cách xuất:**
1. Vào trang cần xuất (Nhiệm vụ, Nhân sự, Dự án)
2. Click nút **"Export Excel"**
3. Chọn các cột cần xuất (tick checkbox)
4. Nhập tên file (không cần .xlsx)
5. Click **"Xuất file"**
6. File được tải xuống thư mục Downloads

### 📥 Nhập dữ liệu từ Excel

**Yêu cầu file Excel:**
- Format: .xlsx hoặc .xls
- Hàng đầu tiên: Tên cột (header)
- Dữ liệu bắt đầu từ hàng 2

**Cách import:**
1. Click nút **"Import Excel"**
2. Chọn file từ máy tính
3. **Preview dữ liệu**:
   - Xem trước tất cả dữ liệu
   - Chọn/bỏ chọn hàng cần import (checkbox)
   - Chọn/bỏ chọn cột cần import (checkbox)
4. Click **"Import"**
5. Hệ thống validate:
   - Email đúng format
   - Các trường bắt buộc không trống
   - Hiển thị lỗi nếu có
6. Kết quả:
   - Toast thông báo số lượng thành công/thất bại
   - Dữ liệu được thêm vào hệ thống

**Ví dụ format Excel cho Nhân sự:**

| Họ tên | Email | Mật khẩu | Số điện thoại | Ngày sinh | Ngày vào làm | Vai trò | Trạng thái |
|--------|-------|----------|---------------|-----------|--------------|---------|------------|
| Nguyễn Văn A | nvana@example.com | Pass123! | 0901234567 | 1990-01-15 | 2020-03-01 | user | Hoạt động |
| Trần Thị B | ttb@example.com | Pass123! | 0907654321 | 1992-05-20 | 2021-06-15 | admin | Hoạt động |

---

## 🔔 Thông báo

**Các loại thông báo:**
- 🟢 **Success** (Xanh): Thao tác thành công
- 🔴 **Error** (Đỏ): Có lỗi xảy ra
- 🔵 **Info** (Xanh dương): Thông tin
- 🟡 **Warning** (Vàng): Cảnh báo

**Vị trí hiển thị:**
- Góc trên bên phải màn hình
- Tự động đóng sau 3-5 giây
- Có thể đóng bằng tay (click X)

---

## 🔎 Tìm kiếm, Lọc, Sắp xếp hiệu quả

- Ô tìm kiếm hỗ trợ tìm theo tên, email, mã dự án, tiêu đề công việc
- Bộ lọc theo Trạng thái/Ưu tiên/Người thực hiện/Dự án để thu hẹp danh sách
- Sắp xếp theo thời gian tạo, hạn cuối, ngày họp (với Tài liệu dự án)
- Mẹo: Kết hợp Tìm kiếm + Lọc để nhanh chóng tìm đúng bản ghi

---

## 🌐 Chế độ ngoại tuyến (Offline)

- Nếu mất kết nối Internet, ứng dụng hiển thị banner thông báo "Đang ngoại tuyến"
- Một số thao tác cần mạng sẽ bị trì hoãn; hãy kiểm tra kết nối trước khi thực hiện các thao tác ghi dữ liệu

---

## 🗣️ Nhập liệu bằng giọng nói & OCR tiếng Việt

- Nhập giọng nói (Voice): bật micro trong form mô tả công việc để nói – hệ thống sẽ nhận dạng và điền nội dung
- Nhận dạng văn bản (OCR): dùng tính năng OCR để trích xuất chữ từ ảnh/tài liệu scan và chèn vào mô tả/báo cáo
- Lưu ý: Cần kết nối Internet ổn định để cho độ chính xác cao

---

## ⏰ Cấu hình nhắc việc (Manager/Admin)

- Trang Cài đặt Nhắc việc cho phép đặt thời điểm nhắc trước hạn (12h/24h/48h...), đúng hạn, quá hạn
- Với công việc định kỳ, có thể cấu hình nhắc trước ngày đến mốc kỳ tiếp theo
- Chính sách mặc định phù hợp đa số trường hợp; chỉ Manager/Admin nên thay đổi

---

## ⌨️ Phím tắt

| Phím tắt | Chức năng |
|----------|-----------|
| `Ctrl + R` | Reload trang |
| `Ctrl + Shift + R` | Force reload |
| `F11` | Fullscreen |
| `F12` | Mở DevTools (debug) |
| `Ctrl + C` | Copy |
| `Ctrl + V` | Paste |
| `Ctrl + Z` | Undo |
| `Ctrl + +` | Zoom in |
| `Ctrl + -` | Zoom out |
| `Ctrl + 0` | Reset zoom |
| `Alt + F4` | Đóng ứng dụng |

---

## ❓ Câu hỏi thường gặp (FAQ)

### 1. Quên mật khẩu?
- Liên hệ Admin để reset mật khẩu

### 2. Làm sao để thay đổi mật khẩu?
1. Click vào avatar/tên user ở góc trên phải
2. Chọn "Đổi mật khẩu"
3. Nhập mật khẩu cũ
4. Nhập mật khẩu mới (2 lần)
5. Click "Lưu"

### 3. File Excel import bị lỗi?
- Kiểm tra format đúng (.xlsx)
- Hàng đầu phải là tên cột
- Email đúng format (có @)
- Các trường bắt buộc không trống

### 4. Dữ liệu không cập nhật?
- Click nút Refresh (⟳)
- Hoặc Ctrl + R để reload

### 5. App chạy chậm?
- Đóng DevTools (F12)
- Kiểm tra kết nối Internet
- Restart app

### 6. Làm sao xóa tài khoản?
- Chỉ Admin mới có quyền xóa
- Có 2 loại:
  - **Vô hiệu hóa**: Tạm thời không cho truy cập
  - **Xóa vĩnh viễn**: Xóa hoàn toàn khỏi hệ thống

### 7. Export Excel không có dữ liệu?
- Đảm bảo đã chọn ít nhất 1 cột
- Kiểm tra có dữ liệu trong bảng không
- Thử reload trang

8. Tại sao không thể hoàn thành công việc định kỳ tuần/tháng?
- Hãy kiểm tra đã tải lên ít nhất 1 file PDF báo cáo cho công việc đó
- Nếu đã hoàn thành và xóa hết PDF, hệ thống tự chuyển về trạng thái chưa hoàn thành – hãy upload lại PDF

9. Tôi bị mất quyền xem dữ liệu dự án?
- Kiểm tra bạn có còn là thành viên dự án không (Project Members)
- Liên hệ Manager/Admin để thêm vào dự án tương ứng

---

## 🐛 Báo lỗi

Nếu gặp lỗi, hãy:
1. Chụp màn hình lỗi
2. Ghi lại các bước để tái hiện lỗi
3. Gửi cho IT/Admin qua email hoặc ticket

**Thông tin cần cung cấp:**
- Phiên bản app (xem trong "Trợ giúp" → "Về ứng dụng")
- Màn hình/trang đang sử dụng
- Hành động đang làm
- Thông báo lỗi (nếu có)
- Screenshot

---

## 📞 Hỗ trợ

**Liên hệ:**
- 📧 Email: support@ibstbim.com
- 📱 Hotline: 1900-xxxx
- 🌐 Website: https://ibstbim.com
- ⏰ Giờ làm việc: 8:00 - 17:30 (Thứ 2 - Thứ 6)

---

## ⚙️ Tuỳ chỉnh logo công ty (Admin)

- Vào trang "Cài đặt hệ thống" (Company Settings)
- Tải lên logo công ty để hiển thị ở trang đăng nhập và tiêu đề ứng dụng
- Logo sẽ tự điều chỉnh kích thước phù hợp giao diện

---

## 📝 Lịch sử phiên bản

### Version 1.0.0 (10/10/2025)
- 🎉 Phát hành phiên bản đầu tiên
- ✅ Quản lý Dự án
- ✅ Quản lý Nhiệm vụ
- ✅ Quản lý Nhân sự
- ✅ Import/Export Excel
- ✅ Dashboard với biểu đồ
- ✅ Thông báo real-time
- ✅ Ứng dụng Windows Desktop

---

## 📜 Giấy phép

Copyright © 2025 IBST BIM. All rights reserved.

Phần mềm này được bảo vệ bởi luật bản quyền. Nghiêm cấm sao chép, phân phối lại mà không có sự cho phép.

---

**🎯 Chúc bạn sử dụng phần mềm hiệu quả!**
