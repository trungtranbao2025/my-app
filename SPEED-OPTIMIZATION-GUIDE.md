# HƯỚNG DẪN TỐI ƯU TỐC ĐỘ LOAD

## ✅ Đã tối ưu

### 1. **Lazy Loading Routes** 
Tất cả các trang được load theo yêu cầu (lazy load):
- ✅ DashboardPage
- ✅ ProjectsPage  
- ✅ TasksPage
- ✅ StaffPage
- ✅ ReportsPage
- ✅ ProfilePage
- ✅ CompanySettingsPage
- ✅ SystemSettingsPage
- ✅ ReminderSettingsPage

**Chỉ LoginPage được eager load** (cần ngay lúc đầu)

### 2. **Defer Non-Critical Data**
- ✅ Notifications: delay 1 giây sau khi load xong
- ✅ Profile: chỉ load thông tin cơ bản (bỏ project_members join)
- ✅ Realtime subscriptions: khởi tạo sau khi UI hiển thị

### 3. **Vite Config Optimization**
- ✅ Single-file inlining (no code splitting)
- ✅ Keep console.error (chỉ remove console.log)
- ✅ Exclude heavy libs từ pre-bundling
- ✅ Increase chunk size warning limit
- ✅ HMR overlay enabled

## 📊 Kết quả mong đợi

### Trước (slow):
```
- Load tất cả pages cùng lúc: ~3-5s
- Load profile với joins: ~500ms
- Load notifications ngay: ~300ms
- Total: ~4-6s
```

### Sau (fast):
```
- Load LoginPage only: ~500ms
- Load profile cơ bản: ~150ms  
- Defer notifications: +0ms (background)
- Lazy load pages: chỉ khi cần
- Total initial: ~650ms (8-10x nhanh hơn!)
```

## 🚀 Cách test

### 1. Dev mode:
```bash
npm run dev
```
- Mở http://localhost:5173
- Mở DevTools (F12) → Network tab
- Hard refresh (Ctrl+Shift+R)
- Xem thời gian load các file

### 2. Production build:
```bash
npm run build
npm run preview
```

### 3. Electron:
```bash
npm run electron:build:win
```
Chạy file portable và xem tốc độ

## 🔍 Debug Performance

### Chrome DevTools:
1. F12 → Performance tab
2. Click Record
3. Reload page (Ctrl+R)
4. Stop recording
5. Xem:
   - Loading time
   - Scripting time  
   - Rendering time
   - Parse HTML/CSS

### Lighthouse:
1. F12 → Lighthouse tab
2. Generate report
3. Xem Performance score
4. Follow suggestions

## 📝 Chi tiết thay đổi

### File: `src/App.jsx`
```jsx
// Before: eager imports
import DashboardPage from './pages/DashboardPage'
import ProjectsPage from './pages/ProjectsPage'
// ... tất cả pages

// After: lazy imports
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
// ... với Suspense wrapper
```

### File: `src/contexts/AuthContext.jsx`
```jsx
// Before: complex profile query
.select(`
  *,
  project_members(
    id,
    role_in_project,
    ...
  )
`)

// After: simple profile query
.select('*')
```

### File: `src/contexts/NotificationContext.jsx`
```jsx
// Before: load ngay
useEffect(() => {
  loadNotifications()
  setupRealtimeSubscription()
}, [user])

// After: defer 1 second
useEffect(() => {
  const timer = setTimeout(() => {
    loadNotifications()
    setupRealtimeSubscription()
  }, 1000)
  setLoading(false) // Don't block UI
  return () => clearTimeout(timer)
}, [user])
```

### File: `vite.config.js`
```js
// Added:
optimizeDeps: {
  exclude: ['lucide-react'] // Don't pre-bundle heavy icons
}
```

## 💡 Tips thêm (nếu vẫn chậm)

### 1. CDN cho heavy libraries:
```html
<!-- index.html -->
<script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
```

### 2. Service Worker caching:
```js
// Đã có sw.js - đảm bảo nó hoạt động
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

### 3. Image optimization:
- Dùng WebP thay vì PNG/JPG
- Lazy load images
- Use responsive images

### 4. Database indexing:
```sql
-- Tạo indexes cho queries thường dùng
CREATE INDEX idx_profiles_user_id ON profiles(id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
```

### 5. Supabase Connection Pooling:
- Dùng connection pooler của Supabase
- Tối ưu RLS policies

## ✅ Checklist

- [x] Lazy load all routes
- [x] Defer notifications loading
- [x] Simplify profile query
- [x] Optimize Vite config
- [x] Add static logo component
- [x] Keep console.error for debugging
- [x] Exclude heavy libs from pre-bundling

## 🎯 Next Steps

Nếu vẫn chậm:
1. Check Network tab → xem request nào lâu
2. Check Performance tab → xem giai đoạn nào chậm
3. Check Supabase Dashboard → xem query performance
4. Optimize specific bottleneck

---

**Lưu ý**: Sau khi chỉnh, cần:
- Clear browser cache (Ctrl+Shift+Del)
- Hard refresh (Ctrl+Shift+R)
- Rebuild Electron app (npm run electron:build:win)
