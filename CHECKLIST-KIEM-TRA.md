# ✅ CHECKLIST KIỂM TRA NOTIFICATIONS

## Bước 1: Chạy SQL Script ✅ (ĐÃ LÀM)
- [x] Đã có 10 notifications trong database
- [x] Email: hohoangtien94@gmail.com
- [ ] **CẦN LÀM:** Chạy SIMPLE-FIX-NOTIFICATIONS.sql để fix RLS policies

## Bước 2: Kiểm tra Console Logs

### 2.1. Mở Browser Console
1. Mở ứng dụng trong browser
2. Nhấn **F12** để mở DevTools
3. Chọn tab **Console**
4. Refresh page (F5)

### 2.2. Tìm các logs sau:
- [ ] `✅ Supabase connected: https://...`
- [ ] `✅ Supabase client exposed to window.supabase`
- [ ] `👤 NotificationContext useEffect - user: xxx`
- [ ] `🔔 Loading notifications for user: xxx`
- [ ] `✅ Notifications loaded: X items`
- [ ] `📊 Notification data: [...]`

### 2.3. Nếu KHÔNG thấy logs trên:
1. Copy nội dung file `test-console-logs.js`
2. Paste vào Browser Console
3. Nhấn Enter
4. Xem kết quả

## Bước 3: Kiểm tra Debug Panel

1. Tìm nút **"🐛 Debug Notifications"** ở góc dưới bên phải màn hình
2. Click vào nút
3. Kiểm tra thông tin:

### Thông tin cần xem:
- [ ] **User ID** có hiển thị?
- [ ] **Context State - Notifications**: Số lượng = ?
- [ ] **Direct Query - Count**: Số lượng = ?
- [ ] **Diagnosis**: "Context matches DB" hay "mismatch"?

### Kết quả mong đợi:
```
User Info:
  ID: 81640e0f-77cb-48ab-a9db-56eff467bc00
  Email: hohoangtien94@gmail.com

Context State:
  Notifications: 10
  Unread: 10
  Loading: No

Direct Query:
  Count: 10
  Total (DB): 10

Diagnosis:
  ✅ Context matches DB
```

## Bước 4: Kiểm tra Chuông Thông báo

- [ ] Icon chuông 🔔 ở góc phải trên header có hiển thị?
- [ ] Badge đỏ hiển thị số **10**?
- [ ] Click vào chuông → Dropdown mở ra?
- [ ] Dropdown hiển thị 10 notifications?

## Bước 5: Phân tích kết quả

### ✅ Trường hợp 1: Mọi thứ hoạt động
- Context = 10 notifications
- Direct Query = 10 notifications
- Chuông hiển thị badge số 10
- Click chuông thấy danh sách notifications

➡️ **XONG!** Đóng Debug Panel và sử dụng bình thường.

### ❌ Trường hợp 2: Context = 0, Direct Query = 10
**Nguyên nhân:** NotificationContext không load hoặc RLS policies chặn

**Giải pháp:**
1. Chạy `SIMPLE-FIX-NOTIFICATIONS.sql` (nếu chưa chạy)
2. Kiểm tra console có error không
3. Chụp màn hình console error và gửi lại

### ❌ Trường hợp 3: Context = 10, nhưng chuông không hiển thị
**Nguyên nhân:** NotificationBell component có vấn đề

**Giải pháp:**
1. Kiểm tra console có error về NotificationBell không
2. Refresh lại page (Ctrl+Shift+R - hard refresh)
3. Clear cache và reload

### ❌ Trường hợp 4: Direct Query = 0
**Nguyên nhân:** RLS policies chặn hoặc user_id không khớp

**Giải pháp:**
Chạy query này trong SQL Editor:
```sql
-- Kiểm tra user_id có khớp không
SELECT 
  (SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com') as auth_user_id,
  (SELECT DISTINCT user_id FROM public.notifications LIMIT 1) as notif_user_id,
  (SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com') = 
  (SELECT DISTINCT user_id FROM public.notifications LIMIT 1) as matched;
```

Nếu `matched = false`, cần update:
```sql
UPDATE public.notifications
SET user_id = (SELECT id FROM auth.users WHERE email = 'hohoangtien94@gmail.com');
```

## 📸 SCREENSHOTS CẦN GỬI (nếu vẫn lỗi)

1. [ ] Screenshot Debug Panel (đầy đủ)
2. [ ] Screenshot Console logs (toàn bộ tab Console)
3. [ ] Screenshot kết quả `SIMPLE-FIX-NOTIFICATIONS.sql`
4. [ ] Screenshot test trong Browser Console (`test-console-logs.js`)

## 🎯 HÀNH ĐỘNG TIẾP THEO

**NGAY BÂY GIỜ:**
1. Refresh browser (F5)
2. Mở Console (F12)
3. Click nút "🐛 Debug Notifications"
4. Chụp màn hình và báo kết quả
