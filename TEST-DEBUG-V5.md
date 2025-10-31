# 🔍 TEST VỚI 3 PHƯƠNG PHÁP TÌM FILE (V5 - Debug)

## 📋 Mục đích

Phiên bản này sẽ thử **3 phương pháp khác nhau** để tìm file index.html và hiển thị log chi tiết để chúng ta tìm ra phương pháp nào đúng.

## 🚀 HƯỚNG DẪN TEST

### Bước 1: Đóng tất cả app cũ

```powershell
Get-Process | Where-Object {$_.ProcessName -like "*IBST*"} | Stop-Process -Force
```

### Bước 2: Chạy file Portable MỚI

1. Refresh thư mục `dist-electron` (F5)
2. Double-click: **IBST BIM - Quản lý Dự án-1.0.0-Portable.exe**
3. Đợi cửa sổ hiện (3-5 giây)

### Bước 3: XEM LOG TRONG DIALOG

Khi dialog "Load Error" hiện ra, hãy đọc kỹ phần **"All paths tried"**:

```
All paths tried:
1. C:\...\Temp\...\electron\..\dist\index.html
2. C:\...\Temp\...\app.asar\dist\index.html  
3. C:\...\resources\app.asar\dist\index.html
```

### Bước 4: CHỤP TOÀN BỘ DIALOG

📸 **QUAN TRỌNG:** Chụp màn hình toàn bộ dialog lỗi và gửi cho tôi, đặc biệt chú ý:
- Dòng "Method 1 - __dirname based:"
- Dòng "Method 2 - getAppPath based:"
- Dòng "Method 3 - resourcesPath based:"
- Dòng "Final URL:"

## 🔍 Điều tôi cần biết

Từ log, tôi sẽ biết:
1. **Đường dẫn nào đúng** trong 3 methods
2. **File có tồn tại không** tại các đường dẫn đó
3. **Cấu trúc thư mục** thực tế của app.asar

## 📝 Thông tin cần gửi

Hãy gửi cho tôi screenshot dialog lỗi có đầy đủ các dòng:
- ✅ Method 1 path
- ✅ Method 2 path
- ✅ Method 3 path
- ✅ Final URL
- ✅ __dirname value
- ✅ app.getAppPath() value
- ✅ process.resourcesPath value

## 🎯 Sau khi có log

Tôi sẽ:
1. Xem path nào đúng
2. Sửa code chỉ dùng path đó
3. Build lại lần cuối
4. App sẽ chạy được!

---

**👉 Hãy test và gửi cho tôi screenshot dialog lỗi đầy đủ!**

Đây là bước cuối cùng để tìm ra đường dẫn chính xác. 🔍
