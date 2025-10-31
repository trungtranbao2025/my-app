# 🔍 HƯỚNG DẪN DEBUG CHI TIẾT

## Vấn đề hiện tại:
- ✅ Database có 35 notifications
- ✅ Direct Query thành công (bypass RLS)
- ❌ Context State = 0 (NotificationContext KHÔNG load)

## Điều này có nghĩa:
**NotificationContext.loadNotifications() KHÔNG được gọi hoặc bị lỗi khi chạy.**

---

## 📋 BƯỚC 1: Kiểm tra Console Logs

### Mở Browser Console (F12) và tìm:

#### ✅ Logs mong đợi thấy:
```
✅ Supabase connected: https://...
✅ Supabase client exposed to window.supabase for debugging
👤 NotificationContext useEffect - user: 81640e0f-77cb-48ab-a9db-56eff467bc00, hohoangtien94@gmail.com
✅ User found, loading notifications...
🔔 Loading notifications for user: 81640e0f-77cb-48ab-a9db-56eff467bc00
🔑 User object: {...}
```

#### ❌ Nếu thấy error:
```
❌ Error loading notifications: {...}
❌ Error details: {...}
```

#### ⚠️ Nếu KHÔNG thấy bất kỳ log nào từ NotificationContext:
➡️ **NotificationContext không được khởi tạo!**

---

## 📋 BƯỚC 2: Chạy SQL Script (Quan trọng!)

1. Copy toàn bộ nội dung `ULTIMATE-FIX-RLS.sql`
2. Paste vào Supabase SQL Editor
3. Click **Run**
4. Xem kết quả:
   - Data type của user_id
   - Policies được tạo
   - Test result có 35 notifications không

---

## 📋 BƯỚC 3: Test với ForceLoadNotifications

Sau khi refresh page, bạn sẽ thấy:
- **Top right**: Nút "🐛 Debug Notifications" (góc dưới phải)
- **Below header**: Panel "🧪 Force Load Test" (góc trên phải)

### Trong panel "🧪 Force Load Test":
1. Click nút **"🔄 Force Reload"**
2. Xem kết quả:
   - ✅ Nếu success: Hiển thị số notifications
   - ❌ Nếu error: Hiển thị error details

---

## 🎯 PHÂN TÍCH KẾT QUẢ

### Scenario 1: Force Load SUCCESS ✅
**Nghĩa là:** Query hoạt động bình thường, RLS policies OK
**Vấn đề:** NotificationContext không được khởi tạo hoặc không chạy

**Giải pháp:**
- Kiểm tra xem NotificationProvider có wrap App không
- Kiểm tra useAuth() có trả về user không
- Kiểm tra useEffect trong NotificationContext có chạy không

### Scenario 2: Force Load ERROR ❌
**Nghĩa là:** RLS policies đang chặn query

**Error có thể:**
```json
{
  "code": "PGRST301",
  "message": "Row level security policy violation",
  "details": "..."
}
```

**Giải pháp:**
- Chạy ULTIMATE-FIX-RLS.sql
- Refresh và test lại

### Scenario 3: Force Load = 0 notifications
**Nghĩa là:** user_id không khớp

**Giải pháp:**
Chạy trong SQL Editor:
```sql
-- Kiểm tra user_id
SELECT 
  'auth.users' as source,
  id
FROM auth.users
WHERE email = 'hohoangtien94@gmail.com';

SELECT 
  'notifications' as source,
  DISTINCT user_id
FROM public.notifications
LIMIT 1;

-- Nếu khác nhau, update:
UPDATE public.notifications
SET user_id = (SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com');
```

---

## 📸 SCREENSHOTS CẦN GỬI

Nếu vẫn không fix được, hãy chụp:

1. **Console logs** (toàn bộ tab Console)
   - Đặc biệt chú ý logs có emoji: 🔔, ❌, ✅, 👤

2. **Force Load Test panel** (sau khi click Force Reload)
   - Success hoặc Error message

3. **Debug Panel** (click nút 🐛)
   - Context State
   - Direct Query
   - Diagnosis

4. **Kết quả SQL** của ULTIMATE-FIX-RLS.sql
   - Data types
   - Policies
   - Test result

---

## 🚀 HÀNH ĐỘNG NGAY:

1. **Chạy ULTIMATE-FIX-RLS.sql** trong Supabase
2. **Refresh browser** (Ctrl+Shift+R)
3. **Kiểm tra Console** - tìm logs NotificationContext
4. **Click Force Reload** trong panel test
5. **Chụp màn hình** và gửi kết quả

---

## 💡 TIP: Nếu không thấy panel test

Kiểm tra:
```javascript
// Trong Browser Console, chạy:
console.log('ForceLoadNotifications imported?', window.location.href)
```

Hoặc hard refresh: **Ctrl+Shift+R** để clear cache
