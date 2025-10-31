# Phần mềm Quản lý Dự án - Tư vấn Giám sát Xây dựng

## 🚀 Tính năng Auto-Clear Cache

App giờ đã tích hợp **tự động clear cache** khi cần thiết, không cần phải manual clear site data nữa!

### Các tình huống auto-clear:

1. **Version Update** - Khi app version thay đổi → Clear toàn bộ cache
2. **Session Expired** - Khi session hết hạn → Clear auth cache + auto logout
3. **Stale Session** - Khi không hoạt động > 24 giờ → Clear auth cache + auto logout
4. **Auth Errors** - Khi gặp lỗi xác thực → Clear auth cache
5. **Manual Logout** - Khi đăng xuất → Clear toàn bộ auth data

### Components mới:

#### 1. **AppInitializer** (`src/components/AppInitializer.jsx`)
- Check app version và clear cache nếu cần
- Validate session trước khi load app
- Track user activity để detect stale sessions
- Auto-logout sessions cũ (>24h không dùng)

#### 2. **ErrorBoundary** (`src/components/ErrorBoundary.jsx`)
- Catch mọi lỗi trong React app
- Detect auth errors và auto-clear cache
- Hiển thị UI lỗi thân thiện với user
- Nút "Tải lại và đăng nhập" để clear + redirect

#### 3. **Updated AuthContext**
- Cleanup listeners đúng cách với `mounted` flag
- Clear localStorage khi có session errors
- Handle SIGNED_OUT event riêng biệt
- Better error handling

### Flow hoạt động:

```
Page Load
  ↓
ErrorBoundary wraps everything
  ↓
AppInitializer checks:
  - App version → Clear if changed
  - Session validity → Clear if expired
  - Last activity → Clear if stale (>24h)
  ↓
AuthProvider loads:
  - Get session from Supabase
  - Load user profile
  - Set up auth listeners
  ↓
App renders normally
```

### Activity Tracking:

App tự động track user activity:
- Click events
- Keypress events
- Lưu timestamp trong `localStorage.last_activity`
- Nếu > 24h không dùng → Auto logout khi mở lại

### Version Management:

Mỗi khi update app, tăng version trong `AppInitializer.jsx`:

```javascript
const APP_VERSION = '1.0.1' // Increment this
```

Khi user load app với version mới → Auto clear cache cũ!

### Testing:

1. **Test auto-clear on version change:**
   ```javascript
   // In Console
   localStorage.setItem('app_version', '0.9.0')
   window.location.reload()
   // Should clear cache and update to 1.0.0
   ```

2. **Test stale session:**
   ```javascript
   // In Console
   const yesterday = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
   localStorage.setItem('last_activity', yesterday.toString())
   window.location.reload()
   // Should logout and clear cache
   ```

3. **Test error boundary:**
   - Force an error trong component
   - Should show error UI with "Tải lại và đăng nhập" button

### Benefits:

✅ **No manual clear needed** - App tự động xử lý
✅ **Better UX** - Không còn "stuck" ở loading screen
✅ **Auto-logout old sessions** - Bảo mật tốt hơn
✅ **Version migration** - Clear cache khi update app
✅ **Error recovery** - ErrorBoundary handle mọi lỗi

### Troubleshooting:

Nếu vẫn gặp vấn đề:

1. Open DevTools Console
2. Check logs:
   - `🔄 App version changed` → Version mismatch
   - `⚠️ Session expired` → Session hết hạn
   - `⚠️ Stale session` → Không dùng > 24h
3. Force clear bằng Console:
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   location.reload()
   ```

---

## 📊 Tính năng đã hoàn thành:

- ✅ Authentication (Login/Logout with auto-clear)
- ✅ Dashboard with optimized loading
- ✅ Projects Management (CRUD)
- ✅ Tasks Management (CRUD with assignments)
- ✅ Staff Management
- ✅ Reports & Analytics (with lightweight API)
- ✅ Real-time Notifications (Supabase Realtime)
- ✅ Auto-clear cache system
- ✅ Error boundary
- ✅ Loading skeletons
- ✅ Activity tracking

## 🔜 Tính năng sắp triển khai:

- ⏳ Excel Import/Export
- ⏳ Voice Input (Web Speech API)
- ⏳ Vietnamese OCR (Tesseract.js)
- ⏳ Birthday/Anniversary Reminders
- ⏳ Email Notifications

---

**Developed with ❤️ for Construction Project Management**
