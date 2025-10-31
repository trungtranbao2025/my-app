# 🔧 Hướng dẫn khắc phục lỗi "Cannot be closed"

## ⚠️ Lỗi gặp phải

```
IBST BIM - Quản lý Dự án cannot be closed.
Please close it manually and click Retry to continue.
```

**Nguyên nhân:** Có nhiều instance của ứng dụng đang chạy trong background và không tự đóng được khi cài đặt.

## ✅ Đã xử lý xong!

Tôi đã đóng tất cả các process sau:
- Process ID: 3300
- Process ID: 4776  
- Process ID: 6084
- Process ID: 14980
- Process ID: 5800 (installer)

## 🎯 Bây giờ hãy làm theo các bước sau:

### Bước 1: Đóng cửa sổ installer hiện tại
- Click **Cancel** trong cửa sổ installer đang báo lỗi
- Đóng tất cả cửa sổ liên quan đến IBST BIM

### Bước 2: Chạy lại installer
Có 2 cách:

#### Cách 1: Dùng file Portable (KHUYẾN NGHỊ - Không cần cài đặt)
```
Double-click: IBST BIM - Quản lý Dự án-1.0.0-Portable.exe
```
- ✅ Không cần cài đặt
- ✅ Không gặp lỗi conflict
- ✅ Chạy ngay lập tức
- ✅ Không cần quyền admin

#### Cách 2: Cài đặt lại bằng Setup.exe
```
Double-click: IBST BIM - Quản lý Dự án-1.0.0-Setup.exe
```
- Lần này sẽ không còn lỗi vì đã kill hết process
- Làm theo hướng dẫn cài đặt bình thường

## 🚀 Sau khi chạy ứng dụng

### Điều bạn sẽ thấy:
1. **Cửa sổ ứng dụng** - Giao diện chính
2. **DevTools** - Tự động mở để debug (có thể đóng)
3. **Màn hình đăng nhập** - Nhập thông tin để vào hệ thống

### Nếu gặp màn hình trắng:
1. Nhấn **F12** để mở DevTools
2. Xem Console tab - sẽ có thông báo lỗi
3. Chụp màn hình và báo lại để tôi khắc phục

## 🔍 Nếu vẫn gặp lỗi "Cannot be closed"

Chạy lệnh sau trong PowerShell (với quyền Admin):

```powershell
# Đóng tất cả process IBST BIM
Get-Process | Where-Object {$_.ProcessName -like "*IBST*"} | Stop-Process -Force

# Xóa các file tạm nếu có
Remove-Item "$env:TEMP\*IBST*" -Recurse -Force -ErrorAction SilentlyContinue
```

Sau đó chạy lại installer.

## 📝 Tips quan trọng

### ✅ KHUYÊN DÙNG: File Portable
- Không gặp vấn đề về conflict
- Chạy độc lập
- Dễ test và debug
- Có thể copy sang máy khác dễ dàng

### ⚠️ File Setup.exe
- Cần đảm bảo không có instance nào đang chạy
- Cài vào thư mục cố định
- Tạo shortcut Desktop và Start Menu
- Khuyến nghị cho triển khai cuối cùng

## 🎯 Checklist trước khi cài đặt

- [ ] Đã đóng TẤT CẢ cửa sổ IBST BIM
- [ ] Đã check Task Manager không còn process nào
- [ ] Đã đóng cửa sổ installer cũ (nếu có)
- [ ] Có file .exe mới nhất trong dist-electron

## 💡 Lưu ý

Phiên bản hiện tại (**1.0.0**) đã được sửa lỗi:
- ✅ Đường dẫn file index.html
- ✅ Load từ app.asar chính xác
- ✅ DevTools tự động mở để debug
- ✅ Error handling tốt hơn

---

**Hãy thử chạy file Portable trước để xem ứng dụng có hoạt động không nhé!** 🚀
