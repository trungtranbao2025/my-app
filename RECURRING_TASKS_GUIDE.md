# Hướng dẫn Hệ thống Công việc Định kỳ và Nhắc việc Tự động

## Tổng quan
Hệ thống quản lý công việc đột xuất/định kỳ với nhắc việc tự động dựa trên:
- ✅ Loại công việc (đột xuất/định kỳ)
- ✅ Cấp độ ưu tiên (thấp/trung bình/cao/khẩn cấp)
- ✅ Trạng thái công việc
- ✅ Tần suất lặp lại (ngày/tuần/tháng/quý/năm)
- ✅ Nhắc việc tự động theo cấu hình

## Bước 1: Chạy SQL Script

Chạy file `create-task-recurring-reminders.sql` trong Supabase SQL Editor:

```sql
-- Tạo enum task_type, recurrence_frequency
-- Thêm cột vào bảng tasks
-- Tạo bảng task_reminders
-- Tạo bảng reminder_settings
-- Tạo functions và triggers
```

## Bước 2: Các tính năng mới

### A. Loại công việc

#### 1. Công việc Đột xuất (One-time)
- Công việc thực hiện một lần
- Có ngày bắt đầu và deadline cố định
- Sau khi hoàn thành hoặc hủy sẽ kết thúc

#### 2. Công việc Định kỳ (Recurring)
- Lặp lại theo lịch cố định
- Tự động tạo công việc mới khi đến hạn
- Cấu hình tần suất lặp:
  - **Hàng ngày**: Lặp mỗi N ngày
  - **Hàng tuần**: Lặp mỗi N tuần
  - **Hàng tháng**: Lặp mỗi N tháng
  - **Hàng quý**: Lặp mỗi N quý
  - **Hàng năm**: Lặp mỗi N năm

### B. Cài đặt công việc định kỳ

Khi tạo công việc định kỳ, cần thiết lập:

1. **Tần suất lặp lại**: Chọn daily/weekly/monthly/quarterly/yearly
2. **Lặp lại mỗi**: Số lượng (ví dụ: mỗi 2 tuần)
3. **Ngày kết thúc** (tùy chọn): Nếu không chọn sẽ lặp vô thời hạn

**Ví dụ**:
- Báo cáo tuần: Lặp mỗi 1 tuần
- Họp tháng: Lặp mỗi 1 tháng
- Review quý: Lặp mỗi 1 quý
- Kiểm tra 15 ngày: Lặp mỗi 15 ngày (chọn daily, interval = 15)

### C. Hệ thống nhắc việc tự động

#### 1. Loại nhắc việc

- **before_due**: Nhắc trước deadline (24h, 48h, 72h...)
- **on_due**: Nhắc đúng ngày deadline
- **overdue**: Nhắc khi quá hạn (1h, 24h, 72h...)
- **recurring**: Nhắc trước khi tạo công việc định kỳ mới

#### 2. Cấu hình nhắc việc

Trang **Cài đặt nhắc việc** (`/reminder-settings`) - Chỉ Manager:

**Tạo rule nhắc việc**:
1. Chọn điều kiện áp dụng:
   - Ưu tiên: high/medium/low/urgent
   - Trạng thái: not_started/in_progress/pending
   - Loại: one_time/recurring
2. Thiết lập thời gian nhắc:
   - Trước deadline: "24, 48, 72" (giờ)
   - Quá hạn: "1, 24, 72" (giờ)
3. Kích hoạt/Tắt rule

**Ví dụ cấu hình**:

```
Tên: High Priority Tasks
Ưu tiên: Cao
Nhắc trước deadline: 48, 24, 12, 6 giờ
Nhắc quá hạn: 1, 6, 24 giờ
→ Công việc ưu tiên cao sẽ nhắc nhiều lần
```

```
Tên: Low Priority Tasks
Ưu tiên: Thấp
Nhắc trước deadline: 24 giờ
Nhắc quá hạn: 48 giờ
→ Công việc ưu tiên thấp nhắc ít hơn
```

#### 3. Cách nhắc việc hoạt động

1. **Khi tạo/cập nhật công việc**:
   - Trigger tự động tạo reminders theo cấu hình
   - Tìm rule phù hợp nhất (ưu tiên + trạng thái + loại)
   
2. **Hệ thống kiểm tra định kỳ**:
   - Function `send_task_reminders()` chạy định kỳ
   - Gửi notification cho các reminder đến hạn
   - Đánh dấu reminder đã gửi

3. **Công việc định kỳ**:
   - Function `auto_create_recurring_task()` chạy hàng ngày
   - Tạo task mới khi đến ngày lặp lại
   - Cập nhật next_recurrence_date
   - Gửi notification cho người được giao

## Bước 3: Sử dụng trong UI

### A. Tạo công việc đột xuất

1. Vào trang **Công việc**
2. Click **Tạo công việc mới**
3. Điền thông tin cơ bản
4. **Loại công việc**: Chọn "Đột xuất (một lần)"
5. Chọn ngày bắt đầu và deadline
6. Lưu

→ Hệ thống tự động tạo reminders theo cấu hình

### B. Tạo công việc định kỳ

1. Vào trang **Công việc**
2. Click **Tạo công việc mới**
3. Điền thông tin cơ bản
4. **Loại công việc**: Chọn "Định kỳ (lặp lại)"
5. Hiện thêm các trường:
   - **Tần suất lặp lại**: weekly/monthly/...
   - **Lặp lại mỗi**: 1, 2, 3... tuần/tháng
   - **Ngày kết thúc lặp lại** (tùy chọn)
6. Lưu

**Ví dụ**: Báo cáo tuần
- Tên: "Báo cáo tiến độ tuần"
- Loại: Định kỳ
- Tần suất: Hàng tuần
- Lặp mỗi: 1 tuần
- Bắt đầu: 01/10/2025
- Deadline: 07/10/2025
- Kết thúc lặp: (để trống - lặp vô thời hạn)

→ Mỗi tuần hệ thống tự tạo task mới

### C. Quản lý nhắc việc (Manager)

1. Vào **Cài đặt nhắc việc**
2. Xem danh sách rules hiện tại
3. Tạo rule mới:
   - Click **Thêm cài đặt mới**
   - Điền tên và mô tả
   - Chọn điều kiện (priority/status/task_type)
   - Nhập thời gian nhắc
   - Bật/Tắt rule
4. Sửa/Xóa rule cũ

## Bước 4: Cấu hình Scheduled Jobs

Để tự động chạy reminders và tạo recurring tasks, cần cấu hình cron jobs:

### Option 1: Supabase pg_cron (Recommended)

Trong Supabase SQL Editor:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Chạy send_task_reminders mỗi 15 phút
SELECT cron.schedule(
  'send-task-reminders',
  '*/15 * * * *',
  $$SELECT send_task_reminders()$$
);

-- Chạy auto_create_recurring_task mỗi ngày lúc 6:00 AM
SELECT cron.schedule(
  'create-recurring-tasks',
  '0 6 * * *',
  $$SELECT auto_create_recurring_task()$$
);

-- Xem scheduled jobs
SELECT * FROM cron.job;
```

### Option 2: External Cron (Vercel Cron, etc.)

Tạo API endpoints:

```javascript
// pages/api/cron/reminders.js
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const { data, error } = await supabase.rpc('send_task_reminders')
  
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}

// pages/api/cron/recurring.js
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const { data, error } = await supabase.rpc('auto_create_recurring_task')
  
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}
```

Cấu hình trong `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/recurring",
      "schedule": "0 6 * * *"
    }
  ]
}
```

## Bước 5: Database Schema

### Bảng `tasks` - Cột mới

| Column | Type | Description |
|--------|------|-------------|
| task_type | enum | 'one_time' hoặc 'recurring' |
| recurrence_frequency | enum | 'daily', 'weekly', 'monthly', 'quarterly', 'yearly' |
| recurrence_interval | integer | Số lượng (mỗi N ngày/tuần/tháng) |
| recurrence_end_date | date | Ngày kết thúc lặp (null = vô thời hạn) |
| last_recurrence_date | date | Ngày tạo task lần trước |
| next_recurrence_date | date | Ngày tạo task tiếp theo |
| parent_task_id | uuid | ID task gốc (nếu là task con) |

### Bảng `task_reminders`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| task_id | uuid | Foreign key → tasks |
| reminder_type | text | 'before_due', 'on_due', 'overdue', 'recurring' |
| reminder_time | timestamptz | Thời điểm nhắc |
| is_sent | boolean | Đã gửi chưa |
| sent_at | timestamptz | Thời điểm đã gửi |

### Bảng `reminder_settings`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Tên cài đặt |
| description | text | Mô tả |
| priority | enum | Áp dụng cho priority (nullable) |
| status | enum | Áp dụng cho status (nullable) |
| task_type | enum | Áp dụng cho task_type (nullable) |
| reminder_config | jsonb | Cấu hình thời gian nhắc |
| is_active | boolean | Bật/tắt |

## Bước 6: Testing

### Test 1: Công việc đột xuất với nhắc việc

1. Tạo công việc mới:
   - Loại: Đột xuất
   - Ưu tiên: Cao
   - Deadline: Ngày mai
2. Kiểm tra bảng `task_reminders`:
   ```sql
   SELECT * FROM task_reminders WHERE task_id = 'xxx';
   ```
3. Chạy manual:
   ```sql
   SELECT send_task_reminders();
   ```
4. Kiểm tra notifications

### Test 2: Công việc định kỳ

1. Tạo công việc định kỳ:
   - Loại: Định kỳ
   - Tần suất: Hàng tuần
   - Lặp mỗi: 1 tuần
2. Kiểm tra `next_recurrence_date`
3. Chạy manual:
   ```sql
   SELECT auto_create_recurring_task();
   ```
4. Kiểm tra task mới được tạo

### Test 3: Cài đặt nhắc việc

1. Vào trang Cài đặt nhắc việc
2. Tạo rule mới cho High priority
3. Tạo task với priority High
4. Kiểm tra reminders được tạo theo rule

## Bước 7: Best Practices

### 1. Cấu hình nhắc việc hợp lý

- **Cao/Khẩn cấp**: Nhắc nhiều lần (48h, 24h, 12h, 6h)
- **Trung bình**: Nhắc vừa phải (24h, 12h)
- **Thấp**: Nhắc ít (24h)

### 2. Công việc định kỳ

- Đặt tên rõ ràng: "Báo cáo tuần - Tự động"
- Thiết lập ngày kết thúc nếu có giới hạn thời gian
- Review định kỳ để tắt/xóa tasks không còn cần

### 3. Performance

- Xóa reminders đã gửi cũ (>30 ngày)
- Index đã được tạo sẵn cho performance
- Chạy cron jobs vào giờ thấp điểm

## Troubleshooting

### Lỗi: Reminders không được tạo
**Kiểm tra**:
1. Trigger có hoạt động?
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%reminder%';
   ```
2. Có reminder_settings nào active không?
   ```sql
   SELECT * FROM reminder_settings WHERE is_active = true;
   ```

### Lỗi: Recurring task không tự tạo
**Kiểm tra**:
1. Cron job có chạy không?
   ```sql
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
   ```
2. `next_recurrence_date` đã đến chưa?
   ```sql
   SELECT * FROM tasks 
   WHERE task_type = 'recurring' 
   AND next_recurrence_date <= CURRENT_DATE;
   ```

### Lỗi: Notification không hiện
**Kiểm tra**:
1. Realtime có bật cho bảng `notifications`?
2. NotificationContext có subscribe không?
3. RLS policies cho notifications đúng chưa?

## Tóm tắt

✅ Công việc đột xuất và định kỳ
✅ Tự động tạo công việc định kỳ
✅ Nhắc việc tự động theo cấu hình
✅ Cài đặt linh hoạt theo priority/status/type
✅ Giao diện quản lý đầy đủ
✅ Scheduled jobs với pg_cron

Hệ thống sẵn sàng giúp quản lý công việc hiệu quả hơn! 🚀
