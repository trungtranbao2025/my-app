# Hệ thống Nhắc việc Tự động

## Tổng quan

Hệ thống nhắc việc tự động cho phép người dùng cấu hình nhắc việc linh hoạt dựa trên:
1. **Ưu tiên 1**: Loại công việc (đột xuất/định kỳ)
2. **Ưu tiên 2**: Trạng thái công việc (đang thực hiện/sắp đến hạn/quá hạn)

## Luồng hoạt động

```
Tạo/Cập nhật công việc
    ↓
Xác định loại công việc (one_time/recurring)
    ↓
Lấy cấu hình nhắc việc của người dùng
    ↓
Xác định trạng thái nhắc việc (in_progress/nearly_due/overdue)
    ↓
Áp dụng cấu hình cho trạng thái tương ứng
    ↓
Tạo lịch nhắc việc cụ thể
    ↓
Lưu vào task_reminder_settings
    ↓
Cron job gửi nhắc việc theo lịch
```

## Cấu trúc Database

### 1. user_reminder_preferences
Lưu cấu hình nhắc việc của người dùng:
- `one_time_config`: Cấu hình cho công việc đột xuất
- `recurring_config`: Cấu hình cho công việc định kỳ

Mỗi config có cấu trúc:
```json
{
  "active": true,
  "by_status": {
    "in_progress": {
      "enabled": true,
      "specific_times": ["09:00", "15:00"],
      "repeat_every_hours": 4,
      "repeat_every_days": 1,
      "max_per_day": 3,
      "days_of_week": [1,2,3,4,5],
      // Chỉ cho recurring:
      "days_of_month": [],
      "months_of_quarter": [],
      "months_of_year": []
    },
    "nearly_due": { ... },
    "overdue": { ... }
  },
  "quiet_hours": {
    "start": "22:00",
    "end": "07:00"
  }
}
```

### 2. task_reminder_settings
Lưu các nhắc việc đã lên lịch:
- `task_id`: ID công việc
- `user_id`: Người nhận nhắc việc
- `scheduled_at`: Thời gian gửi
- `message`: Nội dung nhắc việc
- `type`: 'scheduled_time' hoặc 'repeat_interval'
- `sent`: Đã gửi chưa
- `sent_at`: Thời gian gửi thực tế

## Logic xác định trạng thái nhắc việc

```javascript
function getTaskReminderStatus(task) {
  const today = new Date()
  const dueDate = new Date(task.due_date)
  const daysDiff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24))

  if (daysDiff < 0) return 'overdue'        // Quá hạn
  if (daysDiff <= 3) return 'nearly_due'    // Sắp đến hạn (3 ngày)
  return 'in_progress'                       // Đang thực hiện
}
```

## Tạo lịch nhắc việc

### Từ specific_times
- Tạo nhắc việc vào các giờ cụ thể đã cấu hình
- Ví dụ: ["09:00", "15:00"] → 2 nhắc việc vào 9h và 15h

### Từ repeat_every_hours
- Tạo nhắc việc lặp lại theo số giờ
- Ví dụ: repeat_every_hours = 4 → Mỗi 4 giờ (từ 8:00 đến 20:00)

### Từ repeat_every_days
- Tạo nhắc việc lặp lại theo số ngày
- Ví dụ: repeat_every_days = 2 → Mỗi 2 ngày

### Giới hạn
- `max_per_day`: Số lượng nhắc việc tối đa mỗi ngày
- `days_of_week`: Chỉ nhắc vào các ngày trong tuần đã chọn
- `quiet_hours`: Không gửi nhắc việc trong khoảng thời gian này

## Tích hợp trong TasksPage

### Khi tạo công việc mới:
```javascript
const created = await tasksApi.create(taskData)
await createTaskReminders(created, taskData.assigned_to)

// Cho additional assignees
for (const userId of additionalAssignees) {
  await createTaskReminders(created, userId)
}
```

### Khi cập nhật công việc:
```javascript
const updated = await tasksApi.update(taskId, taskData)
await updateTaskReminders(updated, oldStatus, taskData.assigned_to)
```

### Khi xóa công việc:
```javascript
await deleteTaskReminders(taskId)
await tasksApi.delete(taskId)
```

## Gửi nhắc việc

### Sử dụng Edge Function hoặc Cron Job:

```javascript
// Gọi mỗi phút
await supabase.rpc('send_pending_reminders')

// Dọn dẹp hàng ngày
await supabase.rpc('cleanup_old_reminders')
```

### Function send_pending_reminders():
1. Lấy các nhắc việc có `sent = false` và `scheduled_at <= now()`
2. Tạo notification cho mỗi nhắc việc
3. Đánh dấu `sent = true`
4. Giới hạn 100 nhắc việc mỗi lần chạy

## Cấu hình người dùng

Người dùng có thể cấu hình tại: `/task-reminder-settings`

### Các tùy chọn:
- **Loại công việc**: Đột xuất / Định kỳ
- **Trạng thái**: Đang thực hiện / Sắp đến hạn / Quá hạn
- **Giờ nhắc cụ thể**: Thêm nhiều giờ (VD: 09:00, 15:00)
- **Lặp mỗi giờ**: 0-24 giờ
- **Số ngày lặp lại**: 1-365 ngày
- **Max/ngày**: 1-20 lần
- **Các ngày**: Chọn thứ 2-CN
- **Giờ im lặng**: Không gửi từ 22:00-07:00

### Tùy chọn nâng cao (chỉ định kỳ):
- **Ngày trong tháng**: 1-31
- **Tháng trong quý**: 1-3
- **Tháng trong năm**: 1-12

## Ví dụ

### Ví dụ 1: Công việc đột xuất, đang thực hiện
```json
{
  "enabled": true,
  "specific_times": ["09:00", "15:00"],
  "repeat_every_hours": 0,
  "repeat_every_days": 1,
  "max_per_day": 2,
  "days_of_week": [1,2,3,4,5]
}
```
→ Nhắc việc vào 9:00 và 15:00, chỉ từ T2-T6

### Ví dụ 2: Công việc định kỳ, quá hạn
```json
{
  "enabled": true,
  "specific_times": ["08:00"],
  "repeat_every_hours": 2,
  "repeat_every_days": 1,
  "max_per_day": 5,
  "days_of_week": [1,2,3,4,5,6,7]
}
```
→ Nhắc vào 8:00, sau đó mỗi 2 giờ, tối đa 5 lần/ngày, cả tuần

### Ví dụ 3: Công việc định kỳ, sắp đến hạn, chỉ vào ngày 1 và 15
```json
{
  "enabled": true,
  "specific_times": ["09:00", "16:00"],
  "repeat_every_hours": 0,
  "repeat_every_days": 1,
  "max_per_day": 2,
  "days_of_week": [1,2,3,4,5],
  "days_of_month": [1, 15]
}
```
→ Chỉ nhắc vào ngày 1 và 15 hàng tháng, lúc 9:00 và 16:00

## Triển khai

### Bước 1: Tạo bảng
```sql
-- Chạy file SQL
psql -f create-user-reminder-preferences.sql
psql -f create-task-reminder-settings.sql
```

### Bước 2: Tích hợp frontend
- Import `reminderScheduler.js` vào TasksPage ✅
- Gọi hàm khi tạo/cập nhật/xóa công việc ✅

### Bước 3: Thiết lập Cron Job
Tạo Supabase Edge Function hoặc sử dụng pg_cron:

```sql
-- Sử dụng pg_cron (nếu có)
SELECT cron.schedule(
  'send-reminders',
  '* * * * *', -- Mỗi phút
  $$SELECT public.send_pending_reminders()$$
);

SELECT cron.schedule(
  'cleanup-reminders',
  '0 2 * * *', -- 2:00 sáng hàng ngày
  $$SELECT public.cleanup_old_reminders()$$
);
```

Hoặc tạo Edge Function:
```javascript
// functions/send-reminders/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )

  await supabase.rpc('send_pending_reminders')
  
  return new Response('OK', { status: 200 })
})
```

### Bước 4: Thiết lập Cron trigger
Sử dụng GitHub Actions, Vercel Cron, hoặc external service để gọi Edge Function mỗi phút.

## Testing

### Test 1: Tạo công việc mới
1. Vào trang Công việc
2. Tạo công việc đột xuất với hạn 2 ngày sau
3. Kiểm tra `task_reminder_settings` có nhắc việc không

### Test 2: Cấu hình cá nhân
1. Vào `/task-reminder-settings`
2. Bật nhắc việc cho "Đang thực hiện"
3. Thêm giờ nhắc: 09:00, 15:00
4. Tạo công việc mới
5. Kiểm tra nhắc việc được tạo đúng giờ

### Test 3: Gửi nhắc việc
1. Tạo nhắc việc với `scheduled_at` trong quá khứ
2. Chạy `SELECT send_pending_reminders()`
3. Kiểm tra notification được tạo
4. Kiểm tra `sent = true`

## Troubleshooting

### Nhắc việc không được tạo
- Kiểm tra user có `user_reminder_preferences` chưa
- Kiểm tra config có `enabled = true` không
- Kiểm tra console log trong TasksPage

### Nhắc việc không được gửi
- Kiểm tra `scheduled_at` có trong quá khứ không
- Kiểm tra Cron job có chạy không
- Kiểm tra RLS policies của `task_reminder_settings`

### Quá nhiều nhắc việc
- Giảm `max_per_day`
- Tắt `repeat_every_hours`
- Chỉ dùng `specific_times`

## Tài liệu liên quan

- `src/utils/reminderScheduler.js` - Logic tạo nhắc việc
- `src/pages/TaskReminderSettingsPage.jsx` - UI cấu hình
- `create-user-reminder-preferences.sql` - Schema cấu hình
- `create-task-reminder-settings.sql` - Schema nhắc việc
