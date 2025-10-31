# Hướng dẫn Debug và Khắc phục lỗi Electron App

## 🔍 Các thay đổi đã thực hiện

### 1. **Cải thiện electron/main.cjs**
- ✅ Thêm xử lý đường dẫn file tốt hơn cho app đã được package
- ✅ Thêm kiểm tra file tồn tại trước khi load
- ✅ Thêm error handling chi tiết
- ✅ Tự động mở DevTools khi chạy production để debug
- ✅ Ghi log chi tiết vào file

### 2. **Cải thiện vite.config.js**
- ✅ Loại bỏ plugin `viteSingleFile` (gây vấn đề với Electron)
- ✅ Sử dụng build thông thường với các file assets riêng biệt
- ✅ Thêm hash vào tên file để tránh cache

## 📝 Cách kiểm tra Log file

Khi chạy ứng dụng .exe, Electron sẽ tự động ghi log vào file. Để xem log:

### Windows:
```
%APPDATA%\ibst-bim-quan-ly-du-an\app.log
```

Hoặc đường dẫn đầy đủ:
```
C:\Users\[TÊN_USER]\AppData\Roaming\ibst-bim-quan-ly-du-an\app.log
```

### Cách mở nhanh:
1. Nhấn `Windows + R`
2. Gõ: `%APPDATA%\ibst-bim-quan-ly-du-an`
3. Nhấn Enter
4. Mở file `app.log` bằng Notepad

## 🛠️ Debug khi ứng dụng không chạy

### Bước 1: Mở DevTools
Phiên bản mới sẽ **TỰ ĐỘNG MỞ DevTools** khi chạy. Bạn sẽ thấy:
- Cửa sổ chính của ứng dụng
- Cửa sổ DevTools (Console) bên cạnh

### Bước 2: Kiểm tra Console
Trong DevTools, kiểm tra:
- **Console tab**: Xem các lỗi JavaScript
- **Network tab**: Xem các file có load được không
- **Sources tab**: Xem cấu trúc file

### Bước 3: Kiểm tra Log file
Mở file log như hướng dẫn ở trên để xem:
- Đường dẫn file index.html
- Lỗi khi load file (nếu có)
- Các sự kiện của ứng dụng

## 🎯 Các phím tắt hữu ích

- **F12**: Bật/tắt DevTools thủ công
- **F5**: Hard reload (xóa cache và tải lại)
- **Ctrl+Shift+I**: Bật/tắt DevTools
- **Ctrl+R**: Reload thông thường

## 🔧 Các vấn đề thường gặp và giải pháp

### Vấn đề 1: Màn hình trắng
**Nguyên nhân:**
- File index.html không load được
- Lỗi JavaScript trong code React
- Vấn đề với đường dẫn file

**Giải pháp:**
1. Mở DevTools (F12) xem lỗi
2. Kiểm tra file log
3. Đảm bảo file `.env` có đầy đủ thông tin Supabase

### Vấn đề 2: App không kết nối Supabase
**Nguyên nhân:**
- Thiếu file `.env` hoặc thông tin cấu hình

**Giải pháp:**
1. Tạo file `.env` trong thư mục gốc với nội dung:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
2. Build lại: `npm run electron:build:win`

### Vấn đề 3: App chạy nhưng không hiển thị đúng
**Giải pháp:**
1. Nhấn F5 để hard reload
2. Xóa cache: 
   - Windows: Xóa thư mục `%APPDATA%\ibst-bim-quan-ly-du-an\Cache`
3. Cài đặt lại từ file Setup.exe

## 📦 Build lại sau khi sửa

Nếu bạn sửa code và muốn build lại:

```bash
# Build cho Windows
npm run electron:build:win

# Hoặc build thử nhanh (không tạo installer)
npm run electron:build:dir
```

## ✅ Checklist trước khi phân phối

- [ ] Đã test file Setup.exe trên máy sạch
- [ ] Đã test file Portable.exe
- [ ] Ứng dụng mở được và hiển thị đúng
- [ ] Có thể đăng nhập được
- [ ] Các chức năng chính hoạt động
- [ ] Icon hiển thị đúng
- [ ] Không có lỗi trong Console

## 🚀 Các file build

Sau khi build thành công, bạn có 2 file trong `dist-electron/`:

1. **IBST BIM - Quản lý Dự án-1.0.0-Setup.exe** (~100 MB)
   - File cài đặt đầy đủ
   - Tạo shortcut Desktop và Start Menu
   - Khuyến nghị cho người dùng cuối

2. **IBST BIM - Quản lý Dự án-1.0.0-Portable.exe** (~99 MB)
   - Chạy trực tiếp, không cần cài đặt
   - Phù hợp để test hoặc chạy từ USB

## 📞 Liên hệ hỗ trợ

Nếu vẫn gặp vấn đề, cung cấp thông tin sau:
- Nội dung file `app.log`
- Screenshot của DevTools Console
- Mô tả chi tiết vấn đề gặp phải
