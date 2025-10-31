# Hướng dẫn Build Ứng dụng Windows Desktop

## 📦 Build đã hoàn tất!

Ứng dụng React của bạn đã được cấu hình để build thành ứng dụng Windows Desktop với Electron.

---

## 🚀 Các lệnh sử dụng

### 1. Chạy ứng dụng ở chế độ phát triển (Development)
```bash
npm run electron:dev
```
- Mở app trong Electron với hot-reload
- Thay đổi code sẽ tự động cập nhật
- Có DevTools để debug

### 2. Build ứng dụng Windows (.exe)
```bash
npm run electron:build:win
```
Tạo file cài đặt tại: `dist-electron/`
- **Installer (.exe)**: File cài đặt với wizard
- **Portable (.exe)**: File chạy trực tiếp không cần cài

### 3. Build nhanh để test (không nén)
```bash
npm run electron:build:dir
```
Tạo thư mục app unpacked để test nhanh

---

## 📁 Cấu trúc đã thêm

```
app QLDA/
├── electron/
│   ├── main.js          # Entry point của Electron
│   ├── preload.js       # Bridge script
│   └── icon.ico         # Icon ứng dụng (CẦN TẠO)
├── electron-builder.json # Cấu hình build
├── LICENSE.txt          # Giấy phép MIT
└── package.json         # Đã cập nhật scripts
```

---

## 🎨 Tạo Icon cho Windows

**Bạn CẦN tạo file icon:**
1. Chuẩn bị ảnh PNG kích thước **256x256** hoặc **512x512**
2. Convert sang file `.ico` tại: https://icoconvert.com/
3. Lưu file với tên `icon.ico` vào thư mục `electron/`

**Hoặc sử dụng icon mặc định:**
- Tạm thời có thể build không có icon (sẽ dùng icon Electron mặc định)

---

## ✨ Tính năng đã có

### App Desktop
✅ Cửa sổ 1400x900, tự động maximize
✅ Menu tiếng Việt (File, Chỉnh sửa, Xem, Trợ giúp)
✅ Shortcuts: Ctrl+C, Ctrl+V, F11 (fullscreen), Alt+F4 (thoát)
✅ DevTools trong development mode
✅ Auto-reload khi code thay đổi

### Build Options
✅ **NSIS Installer**: File .exe cài đặt đầy đủ
✅ **Portable**: File .exe chạy trực tiếp
✅ Tạo shortcut trên Desktop và Start Menu
✅ Cho phép chọn thư mục cài đặt

---

## 🎯 Hướng dẫn Build lần đầu

### Bước 1: Tạo icon (QUAN TRỌNG)
```bash
# Tạo thư mục nếu chưa có
mkdir electron

# Đặt file icon.ico vào electron/icon.ico
```

### Bước 2: Build ứng dụng
```bash
npm run electron:build:win
```

### Bước 3: Kiểm tra output
```bash
cd dist-electron
dir
```

Bạn sẽ thấy:
- `Quản lý Dự án-1.0.0-x64.exe` (Installer)
- `Quản lý Dự án-1.0.0-Portable.exe` (Portable)

### Bước 4: Cài đặt và test
1. Chạy file Installer
2. Làm theo wizard cài đặt
3. Mở app từ Desktop hoặc Start Menu

---

## 🔧 Tùy chỉnh

### Đổi tên ứng dụng
Sửa trong `electron-builder.json`:
```json
{
  "productName": "Tên Mới Của Bạn"
}
```

### Đổi thông tin công ty
Sửa trong `package.json`:
```json
{
  "author": "Tên Công Ty",
  "description": "Mô tả ứng dụng"
}
```

### Thay đổi kích thước cửa sổ
Sửa trong `electron/main.js`:
```javascript
mainWindow = new BrowserWindow({
  width: 1600,  // Thay đổi
  height: 1000, // Thay đổi
  ...
})
```

---

## 🐛 Xử lý lỗi thường gặp

### Lỗi: "icon.ico not found"
**Giải pháp:**
1. Tạo file icon.ico và đặt vào `electron/icon.ico`
2. Hoặc xóa dòng `"icon"` trong `electron-builder.json`

### Lỗi: Build thất bại
**Giải pháp:**
```bash
# Xóa cache và node_modules
rm -rf node_modules dist dist-electron
npm install
npm run electron:build:win
```

### App không mở được
**Giải pháp:**
- Kiểm tra log trong: `C:\Users\YourName\AppData\Roaming\Quản lý Dự án\logs`
- Chạy `npm run electron:dev` để xem lỗi chi tiết

---

## 📦 Phân phối ứng dụng

### Installer (.exe)
- **Ưu điểm**: Cài đặt chuyên nghiệp, có uninstaller
- **Phân phối**: Gửi file .exe cho người dùng cài đặt
- **Kích thước**: ~150-200MB

### Portable (.exe)
- **Ưu điểm**: Chạy trực tiếp, không cần cài
- **Phân phối**: Giải nén và chạy file .exe
- **Kích thước**: ~150-200MB

### Microsoft Store (Nâng cao)
- Cần đăng ký tài khoản Developer ($19)
- Build target: "appx"
- Phân phối qua Windows Store

---

## 🎉 Hoàn thành!

Bây giờ bạn có thể:
1. ✅ Chạy app ở chế độ dev: `npm run electron:dev`
2. ✅ Build app Windows: `npm run electron:build:win`
3. ✅ Phân phối file .exe cho người dùng

**Lưu ý:** 
- Nhớ tạo icon trước khi build để app trông chuyên nghiệp!
- File build đầu tiên sẽ mất ~5-10 phút
- Lần build sau sẽ nhanh hơn (~2-3 phút)
