# 🔧 SỬA LỖI MÀN HÌNH TRẮNG - HƯỚNG DẪN CÀI ĐẶT LẠI

## ❌ Vấn đề: App mở ra màn hình trắng

**Nguyên nhân:** Phiên bản build cũ có lỗi đường dẫn load file index.html

**Đã fix:** Build mới đã sửa đường dẫn đúng

---

## ✅ CÁCH SỬA (Cài đặt lại phiên bản mới)

### Bước 1: Gỡ cài đặt phiên bản cũ

#### Cách 1: Qua Settings (Khuyến nghị)
1. Nhấn `Windows + I` để mở Settings
2. Vào **Apps** → **Installed apps**
3. Tìm "**IBST BIM - Quản lý Dự án**"
4. Click **...** (ba chấm) → **Uninstall**
5. Xác nhận uninstall

#### Cách 2: Qua Control Panel
1. Nhấn `Windows + R`
2. Gõ: `appwiz.cpl` → Enter
3. Tìm "**IBST BIM - Quản lý Dự án**"
4. Right-click → **Uninstall**

#### Cách 3: Chạy Uninstaller trực tiếp
1. Vào thư mục: `C:\Users\<YourName>\AppData\Local\Programs\ibst-bim-quan-ly-du-an\`
2. Chạy file: `Uninstall IBST BIM - Quản lý Dự án.exe`

### Bước 2: Xóa dữ liệu app cũ (Tùy chọn nhưng khuyến nghị)

```
Xóa thư mục này nếu tồn tại:
C:\Users\<YourName>\AppData\Roaming\IBST BIM - Quản lý Dự án
```

### Bước 3: Cài đặt phiên bản mới

1. Mở thư mục: `c:\Users\Windows\Downloads\app QLDA\dist-electron\`
2. Double-click: **`IBST BIM - Quản lý Dự án-1.0.0-Setup.exe`**
3. Làm theo wizard cài đặt:
   - Chọn thư mục cài đặt
   - Tick "Create Desktop shortcut" ✓
   - Tick "Create Start Menu shortcut" ✓
4. Click **Install**
5. Đợi cài đặt hoàn tất (~30 giây)
6. Click **Finish** (tick "Launch app" nếu muốn chạy ngay)

### Bước 4: Chạy app

- Double-click Desktop shortcut
- Hoặc tìm trong Start Menu: "IBST BIM - Quản lý Dự án"

---

## 🎯 Kết quả mong đợi

✅ App mở ra và hiển thị trang đăng nhập
✅ Logo IBST BIM hiển thị
✅ Có thể đăng nhập
✅ Xem các trang: Dashboard, Dự án, Nhiệm vụ, Nhân sự

---

## 🐛 Nếu vẫn bị lỗi

### Thử Portable version (không cần cài đặt):

1. Vào: `c:\Users\Windows\Downloads\app QLDA\dist-electron\`
2. Double-click: **`IBST BIM - Quản lý Dự án-1.0.0-Portable.exe`**
3. App sẽ chạy trực tiếp

### Kiểm tra lỗi:

Khi app mở (dù màn hình trắng), nhấn **F12** để mở DevTools:
- Xem tab **Console** có lỗi gì
- Chụp screenshot lỗi và gửi cho tôi

---

## 📍 Vị trí file mới

**Setup installer:**
```
c:\Users\Windows\Downloads\app QLDA\dist-electron\IBST BIM - Quản lý Dự án-1.0.0-Setup.exe
```

**Portable version:**
```
c:\Users\Windows\Downloads\app QLDA\dist-electron\IBST BIM - Quản lý Dự án-1.0.0-Portable.exe
```

---

## 📝 Thay đổi trong version mới

✅ **Fixed:** Đường dẫn load index.html trong production
✅ **Fixed:** App.asar path resolution
✅ **Improved:** Error handling khi load app

---

## 🚀 Chạy ngay

```powershell
# Mở thư mục chứa file .exe
explorer "c:\Users\Windows\Downloads\app QLDA\dist-electron"
```

**Chọn file Setup.exe và cài đặt!**
