# Hướng dẫn Hệ thống Kiểm tra và Cập nhật Phiên bản

## Tổng quan
Hệ thống tự động kiểm tra phiên bản mới và thông báo cho người dùng cập nhật ứng dụng. Bao gồm:
- ✅ Kiểm tra phiên bản tự động mỗi 30 phút
- ✅ Thông báo banner khi có bản cập nhật
- ✅ Cập nhật bắt buộc (force update)
- ✅ Ghi log lỗi vào database
- ✅ Xóa cache tự động
- ✅ Trang quản lý hệ thống (chỉ Manager)

## Bước 1: Chạy SQL Script

Chạy file `create-version-system.sql` trong Supabase SQL Editor:

```sql
-- Tạo bảng error_logs
-- Tạo RLS policies
-- Tạo function cleanup_old_error_logs()
```

## Bước 2: Cấu trúc Files

### 1. `src/utils/versionControl.js`
Chứa tất cả logic quản lý phiên bản:
- `CURRENT_VERSION`: Phiên bản hiện tại (cập nhật khi release)
- `checkForUpdates()`: Kiểm tra phiên bản mới
- `compareVersions()`: So sánh 2 phiên bản
- `reloadApp()`: Reload và clear cache
- `logError()`: Ghi lỗi vào database
- `clearOldCache()`: Xóa cache cũ

### 2. `src/components/UpdateChecker.jsx`
Component tự động kiểm tra và hiển thị thông báo cập nhật:
- Kiểm tra ngay khi mount
- Kiểm tra định kỳ mỗi 30 phút
- Hiển thị banner ở top khi có update
- Xử lý force update (bắt buộc)

### 3. `src/pages/SystemSettingsPage.jsx`
Trang quản lý hệ thống (chỉ Manager):
- **Cập nhật phiên bản**: Phát hành phiên bản mới
- **Quản lý Cache**: Xóa cache và reload
- **Nhật ký lỗi**: Xem danh sách lỗi từ database

### 4. `src/components/ErrorBoundary.jsx` (Updated)
Đã tích hợp `logError()` để tự động ghi lỗi vào database khi có lỗi React.

## Bước 3: Cách sử dụng

### A. Kiểm tra phiên bản tự động
Component `<UpdateChecker />` đã được thêm vào `App.jsx`:
```jsx
<UpdateChecker />
```

Nó sẽ:
1. Kiểm tra phiên bản mới mỗi 30 phút
2. Hiển thị banner ở top khi có update
3. Cho phép user cập nhật hoặc nhắc lại sau

### B. Phát hành phiên bản mới (Manager)

1. Truy cập: **Cài đặt hệ thống** (`/system-settings`)
2. Nhập số phiên bản mới (ví dụ: `1.0.1`)
3. Nhập ghi chú cập nhật (tùy chọn)
4. Chọn "Bắt buộc cập nhật" nếu cần
5. Click **Phát hành phiên bản mới**

### C. Xem lỗi hệ thống (Manager)

1. Truy cập: **Cài đặt hệ thống**
2. Phần **Nhật ký lỗi**
3. Click **Hiển thị** để xem danh sách lỗi
4. Xem chi tiết stack trace của từng lỗi

## Bước 4: Quy trình Release

### 1. Cập nhật phiên bản trong code
File: `src/utils/versionControl.js`
```javascript
export const CURRENT_VERSION = '1.0.1' // Tăng phiên bản
export const BUILD_DATE = new Date('2025-10-08').getTime() // Cập nhật ngày build
```

### 2. Deploy lên production
- Build: `npm run build`
- Deploy lên hosting (Vercel, Netlify, etc.)

### 3. Phát hành qua Supabase
- Login với tài khoản Manager
- Vào **Cài đặt hệ thống**
- Phát hành phiên bản mới
- User sẽ nhận được thông báo tự động

## Bước 5: Format Phiên bản

Sử dụng Semantic Versioning:
```
MAJOR.MINOR.PATCH
```

Ví dụ: `1.2.3`
- **MAJOR (1)**: Thay đổi lớn, không tương thích ngược
- **MINOR (2)**: Thêm tính năng mới, tương thích ngược
- **PATCH (3)**: Sửa lỗi nhỏ

## Bước 6: Force Update

Khi chọn "Bắt buộc cập nhật":
- User không thể đóng thông báo
- User phải cập nhật để tiếp tục sử dụng
- Phù hợp cho: Critical bugs, security fixes

Khi không chọn:
- User có thể "Nhắc lại sau"
- Sẽ nhắc lại sau 1 giờ

## Bước 7: Quản lý Cache

### Tự động
- Cache cũ (>7 ngày) tự động xóa khi chạy `clearOldCache()`
- Service worker cache không match version sẽ bị xóa

### Thủ công
Manager có thể xóa cache thủ công:
1. Vào **Cài đặt hệ thống**
2. Phần **Quản lý Cache**
3. Click **Xóa cache và làm mới**

## Bước 8: Error Logging

### Tự động ghi lỗi
Mọi lỗi React trong ErrorBoundary sẽ tự động được ghi vào database:
```javascript
logError(error, {
  componentStack: errorInfo.componentStack,
  errorBoundary: true
})
```

### Thủ công ghi lỗi
Trong try-catch blocks:
```javascript
try {
  // Code có thể lỗi
} catch (error) {
  logError(error, {
    action: 'fetchData',
    userId: user.id
  })
}
```

### Xem lỗi
Manager xem lỗi trong **Cài đặt hệ thống**:
- Error message
- Error type (Error, TypeError, etc.)
- Stack trace
- Context (URL, version, user agent)
- Timestamp

### Tự động cleanup
Lỗi cũ hơn 30 ngày sẽ tự động xóa (nếu enable pg_cron):
```sql
SELECT cron.schedule('cleanup-error-logs', '0 2 * * *', 'SELECT cleanup_old_error_logs()');
```

## Bước 9: Testing

### Test Update Flow
1. Set `CURRENT_VERSION = '1.0.0'` trong code
2. Phát hành version `1.0.1` qua System Settings
3. Kiểm tra banner hiện ra
4. Click "Cập nhật ngay" → App reload

### Test Force Update
1. Phát hành version mới với checkbox "Bắt buộc cập nhật"
2. Kiểm tra banner không thể đóng
3. Kiểm tra toast notification hiện ra

### Test Error Logging
1. Tạo lỗi cố ý (throw new Error('Test'))
2. Kiểm tra ErrorBoundary bắt lỗi
3. Kiểm tra lỗi xuất hiện trong System Settings

## Bước 10: Best Practices

### 1. Version Numbering
- Tăng PATCH: Bug fixes (1.0.0 → 1.0.1)
- Tăng MINOR: New features (1.0.0 → 1.1.0)
- Tăng MAJOR: Breaking changes (1.0.0 → 2.0.0)

### 2. Release Notes
Viết rõ ràng những thay đổi:
```
✅ Thêm tính năng đề xuất công việc
🐛 Sửa lỗi thông báo không hiển thị
⚡ Cải thiện hiệu suất tải trang
```

### 3. Force Update
Chỉ dùng khi:
- Critical security fixes
- Breaking changes cần thiết
- Database schema changes

### 4. Error Monitoring
- Kiểm tra error logs định kỳ
- Fix các lỗi thường xuyên xuất hiện
- Monitor performance issues

## Troubleshooting

### Lỗi: "duplicate key value violates unique constraint"
**Nguyên nhân**: Đã có phiên bản trong database
**Giải pháp**: Script đã có `onConflict: 'key'`, đảm bảo dùng code mới nhất

### Banner không hiện
**Kiểm tra**:
1. `<UpdateChecker />` có trong App.jsx?
2. Version trong database > CURRENT_VERSION?
3. Console có lỗi không?

### Lỗi không được ghi vào database
**Kiểm tra**:
1. Đã chạy `create-version-system.sql`?
2. RLS policies đúng chưa?
3. User đã login chưa?

## Tóm tắt

✅ Đã tạo hệ thống kiểm tra phiên bản tự động
✅ Đã tạo trang quản lý hệ thống cho Manager
✅ Đã tích hợp error logging tự động
✅ Đã thêm quản lý cache
✅ Đã thêm force update support

Manager có thể phát hành phiên bản mới và theo dõi lỗi hệ thống một cách dễ dàng!
