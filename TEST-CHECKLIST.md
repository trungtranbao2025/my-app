# ✅ Checklist Test Ứng Dụng Windows Desktop

## 🖥️ **Test 1: Cửa sổ ứng dụng**

### Kiểm tra cửa sổ đã mở
- [ ] Cửa sổ Electron đã mở và hiển thị giao diện
- [ ] Kích thước cửa sổ: 1400x900
- [ ] Cửa sổ tự động maximize khi khởi động
- [ ] Thanh tiêu đề hiển thị "Quản lý Dự án"
- [ ] Có nút minimize, maximize, close

### Kiểm tra giao diện
- [ ] Giao diện web hiển thị đầy đủ
- [ ] Màu sắc và font chữ hiển thị đúng
- [ ] Không có lỗi layout
- [ ] Responsive khi resize cửa sổ

---

## 🎛️ **Test 2: Menu Bar**

### Menu "File"
- [ ] Click vào "File" menu
- [ ] Có mục "Thoát"
- [ ] Nhấn "Thoát" → App đóng
- [ ] Shortcut Alt+F4 hoạt động

### Menu "Chỉnh sửa"
- [ ] Có các mục: Hoàn tác, Làm lại, Cắt, Sao chép, Dán, Chọn tất cả
- [ ] Ctrl+C để copy
- [ ] Ctrl+V để paste
- [ ] Ctrl+Z để undo

### Menu "Xem"
- [ ] Ctrl+R để reload
- [ ] Ctrl+Shift+R để force reload
- [ ] Ctrl++ để zoom in
- [ ] Ctrl+- để zoom out
- [ ] Ctrl+0 để reset zoom
- [ ] F11 để toggle fullscreen

### Menu "Trợ giúp"
- [ ] Click "Về ứng dụng"
- [ ] Dialog hiển thị thông tin version

### Menu "Developer" (chỉ có khi dev)
- [ ] F12 để toggle DevTools
- [ ] DevTools mở/đóng đúng

---

## 🔐 **Test 3: Chức năng đăng nhập**

- [ ] Trang đăng nhập hiển thị
- [ ] Nhập email/password
- [ ] Nút "Đăng nhập" hoạt động
- [ ] Đăng nhập thành công → chuyển trang
- [ ] Đăng nhập sai → hiển thị lỗi
- [ ] Session được lưu (refresh vẫn đăng nhập)

---

## 📊 **Test 4: Các trang chính**

### Trang Dashboard
- [ ] Hiển thị đúng số liệu
- [ ] Biểu đồ render đúng
- [ ] Không có lỗi console

### Trang Dự án
- [ ] Danh sách dự án hiển thị
- [ ] Filter hoạt động
- [ ] Search hoạt động
- [ ] Thêm/Sửa/Xóa dự án

### Trang Nhiệm vụ
- [ ] Danh sách nhiệm vụ hiển thị
- [ ] Drag & drop hoạt động
- [ ] Thay đổi trạng thái
- [ ] Export Excel hoạt động

### Trang Nhân sự
- [ ] Danh sách nhân sự hiển thị
- [ ] Import Excel hoạt động
- [ ] Export Excel hoạt động
- [ ] Thêm/Sửa/Xóa nhân sự

---

## 📁 **Test 5: Excel Import/Export**

### Export Excel
- [ ] Click nút "Export Excel"
- [ ] File .xlsx được tải xuống
- [ ] Mở file Excel → có formatting đẹp
- [ ] Header màu xanh, chữ trắng, đậm
- [ ] Các hàng xen kẽ màu xám/trắng
- [ ] Border rõ ràng
- [ ] Cột tự động rộng vừa đủ
- [ ] Có auto-filter
- [ ] Header đóng băng khi scroll

### Import Excel
- [ ] Click nút "Import Excel"
- [ ] Chọn file .xlsx
- [ ] Modal preview hiển thị
- [ ] Chọn hàng/cột để import
- [ ] Click "Import" → dữ liệu được thêm vào
- [ ] Validation lỗi hiển thị đúng

---

## 🔔 **Test 6: Notifications**

- [ ] Toast notifications hiển thị
- [ ] Vị trí: top-right
- [ ] Success (xanh), Error (đỏ), Info (xám)
- [ ] Tự động đóng sau vài giây
- [ ] Có thể đóng bằng tay

---

## 🚀 **Test 7: Performance**

### Tốc độ
- [ ] App khởi động trong < 3 giây
- [ ] Chuyển trang mượt mà
- [ ] Không lag khi scroll
- [ ] Smooth animations

### Memory
- [ ] Mở Task Manager
- [ ] Kiểm tra RAM usage
- [ ] Không tăng RAM liên tục (memory leak)

### DevTools Console
- [ ] Mở DevTools (F12)
- [ ] Kiểm tra tab Console
- [ ] Không có lỗi đỏ (errors)
- [ ] Chỉ có warnings về Autofill (OK)

---

## 🔄 **Test 8: Reload & Refresh**

- [ ] Ctrl+R để reload → App không mất state
- [ ] F5 để refresh → Login vẫn giữ
- [ ] Hot reload (dev mode) → Code thay đổi tự động update

---

## 📱 **Test 9: Window Controls**

### Resize
- [ ] Kéo góc cửa sổ để resize
- [ ] Min size: 1024x768
- [ ] Layout responsive khi resize

### Minimize/Maximize
- [ ] Click nút Minimize → Ẩn vào taskbar
- [ ] Click icon taskbar → Hiện lại
- [ ] Click nút Maximize → Toàn màn hình
- [ ] Double-click title bar → Toggle maximize

### Close
- [ ] Click nút X → App đóng hoàn toàn
- [ ] Alt+F4 → App đóng
- [ ] Không có process nào còn chạy

---

## 🌐 **Test 10: Supabase Integration**

- [ ] Kết nối database thành công
- [ ] Fetch data từ Supabase
- [ ] Insert/Update/Delete hoạt động
- [ ] Real-time updates (nếu có)
- [ ] Authentication hoạt động
- [ ] Storage upload/download (nếu có)

---

## 🐛 **Test 11: Error Handling**

### Mất kết nối Internet
- [ ] Ngắt wifi
- [ ] App hiển thị lỗi thân thiện
- [ ] Bật wifi lại → App hoạt động bình thường

### Lỗi API
- [ ] API trả về 500 error
- [ ] Toast hiển thị lỗi
- [ ] App không crash

### Invalid Input
- [ ] Nhập email sai format
- [ ] Validation hiển thị lỗi
- [ ] Form highlight field lỗi

---

## ✅ **Kết quả tổng thể**

### Critical Issues (Phải fix ngay)
- [ ] Không có lỗi critical nào

### Minor Issues (Fix sau)
- [ ] Liệt kê các lỗi nhỏ (nếu có)

### Performance
- [ ] Tốt ✅
- [ ] Trung bình ⚠️
- [ ] Cần cải thiện ❌

### UI/UX
- [ ] Đẹp và chuyên nghiệp ✅
- [ ] Cần điều chỉnh ⚠️
- [ ] Cần redesign ❌

---

## 📝 **Ghi chú**

### Bugs phát hiện:
1. 
2. 
3. 

### Cải tiến đề xuất:
1. 
2. 
3. 

### Tính năng thiếu:
1. 
2. 
3. 

---

## 🎯 **Kết luận**

- **Tổng số test cases**: 100+
- **Passed**: ___ / ___
- **Failed**: ___ / ___
- **Blocked**: ___ / ___

**App sẵn sàng để build .exe**: ✅ YES / ❌ NO

---

## 📞 **Hỗ trợ**

Nếu gặp lỗi, kiểm tra:
1. DevTools Console (F12)
2. Terminal output
3. File log (nếu có)

Chạy lệnh để xem log chi tiết:
```bash
npm run electron:dev
```
