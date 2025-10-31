# Hướng Dẫn Cập Nhật Schema Dự Án

## Các thay đổi đã thực hiện

### 1. Cấu trúc Database (Supabase)

**Các cột mới đã thêm vào bảng `projects`:**
- ✅ `end_date` (DATE) - Ngày hoàn thành dự kiến
- ✅ `total_days` (INTEGER) - Tổng số ngày thực hiện
- ✅ `extension_count` (INTEGER) - Số lần gia hạn hợp đồng
- ✅ `extension_date` (DATE) - Ngày gia hạn HĐ gần nhất

**Tính năng tự động:**
- Trigger tự động tính `total_days` từ `duration_months` hoặc `duration_days`
- Trigger tự động tính `end_date` từ `start_date + total_days`
- Đồng bộ hai chiều giữa tháng và ngày

### 2. Giao diện (ProjectsPage)

**Thay đổi trong bảng hiển thị:**
- ❌ Đã bỏ: Cột "Tiến độ" (progress bar)
- ✅ Thêm mới: Cột "Ngày hoàn thành"
- ✅ Thêm mới: Cột "Số ngày TH" (thực hiện)
- ✅ Thêm mới: Cột "Số lần GH" (gia hạn)

**Thay đổi trong form nhập liệu:**
1. **Nhập số tháng** → Tự động quy đổi ra số ngày (x30)
2. **Nhập số ngày** → Tự động quy đổi ra số tháng (÷30)
3. **Ngày hoàn thành** → Tự động tính = Ngày bắt đầu + Số ngày
4. **Thêm trường**: Số lần gia hạn HĐ
5. **Thêm trường**: Ngày gia hạn HĐ

## Cách thực hiện

### Bước 1: Chạy SQL Script trong Supabase

1. Mở Supabase Dashboard
2. Vào **SQL Editor**
3. Mở file `update-projects-schema.sql`
4. Copy toàn bộ nội dung và paste vào SQL Editor
5. Click **Run** để thực thi

### Bước 2: Kiểm tra kết quả

Sau khi chạy script, kiểm tra:

```sql
-- Kiểm tra cấu trúc bảng
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name IN ('end_date', 'total_days', 'extension_count', 'extension_date');

-- Kiểm tra dữ liệu mẫu
SELECT 
  code,
  name,
  start_date,
  duration_months,
  total_days,
  end_date,
  extension_count
FROM projects
LIMIT 5;
```

### Bước 3: Test giao diện

1. Mở trang **Quản lý dự án**
2. Thử thêm dự án mới:
   - Nhập số tháng → Xem số ngày tự động cập nhật
   - Hoặc nhập số ngày → Xem số tháng tự động cập nhật
   - Kiểm tra ngày hoàn thành tự động tính
3. Thử sửa dự án hiện có
4. Thử import/export Excel với các cột mới

## Công thức tính toán

### 1. Quy đổi Tháng ↔ Ngày
```
Số ngày = Số tháng × 30
Số tháng = ROUND(Số ngày ÷ 30)
```

### 2. Tính Ngày hoàn thành
```
Ngày hoàn thành = Ngày bắt đầu + Số ngày thực hiện
```

## Ví dụ

### Ví dụ 1: Nhập số tháng
- Input: `duration_months = 12`
- Tự động: `total_days = 360`
- Tự động: `duration_days = 360`
- Nếu `start_date = 2025-01-01` → `end_date = 2025-12-27`

### Ví dụ 2: Nhập số ngày
- Input: `total_days = 100`
- Tự động: `duration_months = 3` (làm tròn 100÷30)
- Tự động: `duration_days = 100`
- Nếu `start_date = 2025-01-01` → `end_date = 2025-04-11`

### Ví dụ 3: Gia hạn hợp đồng
- Dự án ban đầu: 12 tháng (360 ngày)
- Gia hạn lần 1: Thêm 3 tháng
  - `extension_count = 1`
  - `extension_date = 2025-12-27`
  - Cập nhật `total_days = 450` (360 + 90)

## Lưu ý quan trọng

1. **Trigger tự động**: Không cần tính toán thủ công, database sẽ tự động xử lý
2. **Dữ liệu cũ**: Script sẽ tự động cập nhật cho các dự án hiện có
3. **Validation**: Frontend đã có validate để đảm bảo dữ liệu đúng
4. **Performance**: Đã tạo index cho các cột mới để tăng tốc truy vấn

## Troubleshooting

### Lỗi: Trigger không hoạt động
```sql
-- Kiểm tra trigger
SELECT * FROM pg_trigger WHERE tgname LIKE '%calculate%';

-- Nếu không có, chạy lại phần tạo trigger trong script
```

### Lỗi: Dữ liệu không đồng bộ
```sql
-- Chạy lại phần update dữ liệu
UPDATE projects SET updated_at = NOW();
```

### Lỗi: Không thể cập nhật
```sql
-- Kiểm tra RLS policies
SELECT * FROM pg_policies WHERE tablename = 'projects';
```

## Liên hệ hỗ trợ

Nếu gặp vấn đề, vui lòng check:
1. Console log trong browser (F12)
2. Supabase logs trong Dashboard
3. File `update-projects-schema.sql` đã chạy thành công chưa
