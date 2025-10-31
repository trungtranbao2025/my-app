# Hướng dẫn cài đặt Thông báo Realtime

## Tổng quan

Hệ thống thông báo realtime tự động cập nhật khi:
- 🔔 Có đề xuất công việc mới cần phê duyệt
- ✅ Đề xuất được chấp nhận
- ❌ Đề xuất bị từ chối
- 📋 Công việc mới được giao (sau khi duyệt)

## Cài đặt

### Bước 1: Chạy SQL Script

Chạy file `create-task-proposals.sql` trong Supabase SQL Editor. Script này đã bao gồm:

```sql
-- Triggers tự động tạo thông báo:
✅ notify_new_proposal() - Khi có đề xuất mới
✅ notify_proposal_status_change() - Khi đề xuất được duyệt/từ chối
```

### Bước 2: Kiểm tra Realtime

1. Vào Supabase Dashboard → **Database** → **Replication**
2. Đảm bảo các bảng sau đã bật Realtime:
   - ✅ `notifications`
   - ✅ `task_proposals`
   - ✅ `tasks`

3. Nếu chưa bật, click vào từng bảng và enable **Realtime**

### Bước 3: Thêm file âm thanh (Tùy chọn)

1. Tải file âm thanh thông báo (MP3):
   - Tên file: `notification.mp3`
   - Đặt vào thư mục: `public/notification.mp3`

2. Hoặc sử dụng âm thanh mặc định của trình duyệt

> **Lưu ý**: File âm thanh chỉ phát khi người dùng đã tương tác với trang (do chính sách trình duyệt)

## Cách hoạt động

### A. Luồng thông báo đề xuất mới

```
User tạo đề xuất
    ↓
INSERT vào task_proposals
    ↓
Trigger: notify_new_proposal()
    ↓
INSERT vào notifications (gửi cho approver)
    ↓
Realtime subscription phát hiện
    ↓
NotificationContext nhận event
    ↓
Toast notification hiển thị
    ↓
ProposalBadge tự động cập nhật số lượng
```

### B. Luồng thông báo phê duyệt

```
Manager phê duyệt/từ chối
    ↓
UPDATE task_proposals (status)
    ↓
Trigger: notify_proposal_status_change()
    ↓
INSERT notifications cho:
  - Người đề xuất (kết quả)
  - Người được giao việc (nếu duyệt)
    ↓
Realtime subscription phát hiện
    ↓
Toast notification hiển thị
    ↓
TasksPage tự động reload data
```

## Các loại thông báo

### 1. Đề xuất mới (Type: `proposal`)
- **Người nhận**: Manager/Admin của dự án
- **Màu sắc**: 🟡 Vàng
- **Icon**: Bell
- **Hành động**: Click để xem chi tiết và phê duyệt

### 2. Đề xuất được duyệt (Type: `success`)
- **Người nhận**: Người đề xuất
- **Màu sắc**: 🟢 Xanh lá
- **Icon**: CheckCircle
- **Thông tin**: Tên công việc đã được tạo

### 3. Đề xuất bị từ chối (Type: `error`)
- **Người nhận**: Người đề xuất
- **Màu sắc**: 🔴 Đỏ
- **Icon**: ExclamationTriangle
- **Thông tin**: Lý do từ chối

### 4. Công việc mới (Type: `task`)
- **Người nhận**: Người được giao việc
- **Màu sắc**: 🔵 Xanh dương
- **Icon**: Bell
- **Thông tin**: Chi tiết công việc

## Component Realtime

### ProposalBadge Component

Component này hiển thị số lượng đề xuất chờ duyệt với **realtime update**:

```jsx
<ProposalBadge onClick={() => setShowApprovalsModal(true)} />
```

**Tính năng:**
- ✅ Tự động cập nhật số lượng
- ✅ Chỉ hiển thị khi có đề xuất chờ
- ✅ Badge đỏ nổi bật với animation pulse
- ✅ Subscribe realtime vào task_proposals

### NotificationContext

Context quản lý thông báo realtime:

```jsx
const { notifications, unreadCount, markAsRead } = useNotifications()
```

**Chức năng:**
- ✅ Load notifications từ database
- ✅ Subscribe realtime changes
- ✅ Auto show toast khi có notification mới
- ✅ Play âm thanh (nếu có)
- ✅ Quản lý trạng thái đã đọc/chưa đọc

## Kiểm tra hoạt động

### Test 1: Thông báo đề xuất mới

1. **User A** (nhân viên):
   - Tạo đề xuất giao việc cho Manager
   - Gửi đề xuất

2. **Manager**:
   - ✅ Badge "Phê duyệt" tự động tăng
   - ✅ Toast notification xuất hiện
   - ✅ Âm thanh phát (nếu có)
   - ✅ Thông báo trong NotificationBell

### Test 2: Thông báo phê duyệt

1. **Manager**:
   - Nhấn nút "Phê duyệt"
   - Click "Duyệt"

2. **User A** (người đề xuất):
   - ✅ Toast "Đề xuất được chấp nhận"
   - ✅ Công việc xuất hiện trong danh sách

3. **User B** (người được giao):
   - ✅ Toast "Công việc mới"
   - ✅ Task xuất hiện trong "Công việc của tôi"

### Test 3: Thông báo từ chối

1. **Manager**:
   - Click "Từ chối"
   - Nhập lý do: "Cần bổ sung thông tin"

2. **User A**:
   - ✅ Toast "Đề xuất bị từ chối"
   - ✅ Hiển thị lý do trong notification
   - ✅ Có thể gửi lại đề xuất mới

## Tùy chỉnh

### Thay đổi thời gian hiển thị toast

Trong `NotificationContext.jsx`:

```javascript
toast.custom(..., {
  duration: 5000, // 5 giây (thay đổi số này)
  position: 'top-right' // Vị trí hiển thị
})
```

### Tắt âm thanh

Xóa hoặc comment đoạn code:

```javascript
// if (typeof Audio !== 'undefined') {
//   try {
//     const audio = new Audio('/notification.mp3')
//     audio.volume = 0.3
//     audio.play().catch(() => {})
//   } catch (e) {}
// }
```

### Thêm loại thông báo mới

1. Thêm vào `icons` và `styles` trong `showToastNotification()`
2. Tạo trigger trong database
3. Insert notification với type mới

## Xử lý lỗi thường gặp

### Q1: Thông báo không xuất hiện?

**Giải pháp:**
1. Kiểm tra Realtime đã bật trong Supabase
2. Mở Console (F12) → Network → WS → Xem WebSocket connection
3. Kiểm tra RLS policies cho bảng `notifications`

### Q2: Badge không cập nhật realtime?

**Giải pháp:**
1. Kiểm tra `ProposalBadge` đã import đúng
2. Xem Console có lỗi subscription không
3. Verify `approver_id` filter trong channel subscription

### Q3: Âm thanh không phát?

**Nguyên nhân:** Trình duyệt chặn autoplay audio

**Giải pháp:**
1. Người dùng cần click vào trang trước
2. Hoặc enable autoplay trong browser settings
3. Hoặc bỏ chức năng âm thanh

### Q4: Nhiều toast cùng lúc?

**Nguyên nhân:** Multiple subscriptions

**Giải pháp:**
1. Kiểm tra cleanup function trong useEffect
2. Đảm bảo `removeChannel()` được gọi
3. Kiểm tra dependencies array

## Performance

### Tối ưu hóa

1. **Limit notifications**: 
   ```sql
   .limit(50) -- Chỉ load 50 notifications gần nhất
   ```

2. **Debounce reload**:
   ```javascript
   const debouncedReload = debounce(loadData, 500)
   ```

3. **Unsubscribe khi không dùng**:
   ```javascript
   return () => supabase.removeChannel(channel)
   ```

## Bảo mật

- ✅ RLS policies đảm bảo user chỉ nhận notification của mình
- ✅ Realtime subscription filter theo `user_id`
- ✅ Không lộ thông tin người dùng khác
- ✅ Trigger chạy với SECURITY DEFINER

## Kết luận

Hệ thống thông báo realtime giúp:
- 📱 Cập nhật tức thì không cần refresh
- 🔔 Thông báo ngay lập tức khi có sự kiện
- 🚀 Tăng trải nghiệm người dùng
- ⚡ Giảm tải server (không cần polling)

Enjoy your realtime notifications! 🎉
