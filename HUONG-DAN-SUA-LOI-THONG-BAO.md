# 🔧 HƯỚNG DẪN SỬA LỖI KHÔNG CÓ THÔNG BÁO

## ❌ Vấn đề
- Có notifications trong database (đã confirm: 5 notifications)
- Notifications KHÔNG hiển thị trên frontend (chuông thông báo trống)

## ✅ Các file đã tạo/sửa

### 1. Scripts SQL để debug và fix
- ✅ `FIX-NOTIFICATIONS-RLS.sql` - Fix RLS policies (đã sửa lỗi publication)
- ✅ `CHECK-AUTH-MISMATCH.sql` - Kiểm tra user_id có khớp không
- ✅ `TEST-RLS-POLICIES.sql` - Test RLS policies
- ✅ `TEST-CREATE-NOTIFICATION.sql` - Tạo notification test

### 2. Code changes
- ✅ `src/lib/supabase.js` - Expose supabase to window for debugging
- ✅ `src/contexts/NotificationContext.jsx` - Thêm logging chi tiết
- ✅ `src/components/NotificationDebugPanel.jsx` - Component debug UI (MỚI)
- ✅ `src/components/Layout.jsx` - Thêm NotificationDebugPanel

### 3. Browser test script
- ✅ `test-notifications-browser.js` - Test script để chạy trong Browser Console

## 📋 CÁC BƯỚC THỰC HIỆN

### Bước 1: Chạy SQL Scripts trong Supabase Dashboard

#### 1.1. Fix RLS Policies
```sql
-- Copy nội dung FIX-NOTIFICATIONS-RLS.sql và run trong SQL Editor
-- Script này sẽ:
-- - Xóa policies cũ
-- - Tạo policies mới đúng chuẩn
-- - Enable RLS
-- - Enable realtime
```

#### 1.2. Kiểm tra Auth Mismatch
```sql
-- Copy nội dung CHECK-AUTH-MISMATCH.sql và run
-- Kiểm tra output xem user_id có khớp giữa auth.users và notifications không
```

#### 1.3. Test RLS Policies
```sql
-- Copy nội dung TEST-RLS-POLICIES.sql và run
-- Kiểm tra RLS policies có hoạt động đúng không
```

### Bước 2: Refresh ứng dụng

```bash
# Trong terminal
npm run dev

# Hoặc nếu đã chạy rồi, refresh browser: Ctrl+R hoặc F5
```

### Bước 3: Kiểm tra Debug Panel

1. Sau khi refresh, bạn sẽ thấy nút **"🐛 Debug Notifications"** ở góc dưới bên phải
2. Click vào nút đó
3. Xem thông tin debug:
   - **User Info**: ID và email của user
   - **Context State**: Số notifications trong NotificationContext
   - **Direct Query**: Số notifications query trực tiếp từ DB
   - **Diagnosis**: So sánh Context vs DB

### Bước 4: Phân tích kết quả

#### ✅ Trường hợp 1: Context matches DB
```
✅ Context matches DB
Context: 5 notifications
Direct Query: 5 notifications
```
➡️ **Notifications hoạt động bình thường!** Kiểm tra lại chuông thông báo.

#### ❌ Trường hợp 2: Context và DB không khớp
```
❌ Context and DB mismatch!
Context: 0 notifications
Direct Query: 5 notifications
⚠️ Notifications exist in DB but NOT in Context!
```
➡️ **Vấn đề ở NotificationContext** - Kiểm tra console logs

### Bước 5: Kiểm tra Console Logs

Mở DevTools Console (F12) và tìm các log:

#### Expected logs:
```
✅ Supabase connected: https://xxx.supabase.co
✅ Supabase client exposed to window.supabase for debugging
👤 NotificationContext useEffect - user: xxx, email@example.com
✅ User found, loading notifications...
🔔 Loading notifications for user: xxx
🔑 User object: {...}
✅ Notifications loaded: 5 items
📊 Notification data: [...]
📊 Unread count: 5
```

#### Error logs to watch for:
```
❌ Error loading notifications: {...}
❌ Error details: {...}
```

### Bước 6: Test trong Browser Console

Nếu vẫn có vấn đề, chạy test script:

1. Copy toàn bộ nội dung `test-notifications-browser.js`
2. Paste vào Browser Console và Enter
3. Xem output chi tiết

## 🔍 TROUBLESHOOTING

### Vấn đề 1: RLS Policy chặn query
**Triệu chứng**: Direct Query có data, nhưng Context = 0

**Giải pháp**:
```sql
-- Chạy lại FIX-NOTIFICATIONS-RLS.sql
-- Đảm bảo policy dùng auth.uid() = user_id
```

### Vấn đề 2: user_id không khớp
**Triệu chứng**: user_id trong notifications khác với auth.users

**Giải pháp**:
```sql
-- Chạy CHECK-AUTH-MISMATCH.sql để xác định
-- Update user_id nếu cần:
UPDATE public.notifications
SET user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com')
WHERE user_id = 'old-wrong-uuid';
```

### Vấn đề 3: NotificationContext không load
**Triệu chứng**: Không thấy log `🔔 Loading notifications`

**Giải pháp**:
- Kiểm tra NotificationProvider có được wrap trong App không
- Kiểm tra useAuth() có trả về user không
- Refresh lại trang

### Vấn đề 4: Supabase connection error
**Triệu chứng**: Error "relation does not exist" hoặc connection timeout

**Giải pháp**:
- Kiểm tra .env.local có đúng VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY không
- Restart dev server: `npm run dev`

## 📊 EXPECTED RESULTS

Sau khi fix xong, bạn sẽ thấy:

1. ✅ Debug Panel hiển thị: "Context matches DB"
2. ✅ Console log: "✅ Notifications loaded: 5 items"
3. ✅ Chuông thông báo hiển thị badge đỏ với số "5"
4. ✅ Click chuông thấy 5 notifications

## 🧹 SAU KHI FIX XONG

Xóa Debug Panel khỏi production:

```jsx
// Trong src/components/Layout.jsx
// Xóa hoặc comment dòng này:
// <NotificationDebugPanel />
```

Xóa hoặc comment log trong NotificationContext:
```jsx
// Trong src/contexts/NotificationContext.jsx
// Giữ lại log quan trọng, xóa log debug chi tiết
```

## 📝 GHI CHÚ

- Debug Panel chỉ hiển thị khi user đã đăng nhập
- Tất cả scripts SQL an toàn để chạy nhiều lần
- Có thể test với email khác bằng cách thay 'hohoangtien94@gmail.com' trong scripts
