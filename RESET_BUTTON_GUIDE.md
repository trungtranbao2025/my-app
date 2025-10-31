# 🔄 HƯỚNG DẪN SỬ DỤNG NÚT RESET

## Vấn đề đã giải quyết:
❌ **Trước:** Phải Clear Site Data → F5 → Đăng nhập lại  
✅ **Sau:** Chỉ cần click 1 nút hoặc nhấn phím tắt!

---

## 🎯 3 Cách Reset Ứng Dụng

### 1️⃣ Nút Reset trên Header (Khi đã đăng nhập)
- Vị trí: **Header bên phải**, giữa icon Reset và chuông thông báo
- Label: **"Reset"** (desktop) hoặc chỉ icon 🔄 (mobile)
- Click → Confirm → Tự động clear + reload + redirect login

### 2️⃣ Phím Tắt (Bất kỳ đâu trong app)
- Nhấn: **Ctrl + Shift + R**
- Confirm → Tự động clear + reload + redirect login
- Nhanh nhất cho power users!

### 3️⃣ Nút Reset trên Loading Screen (Khi bị stuck)
- Nếu màn hình "Đang tải..." quá **5 giây**
- Tự động hiện nút: **"🔄 Reset ứng dụng"**
- Click → Confirm → Tự động clear + reload

---

## 🛠️ Reset Function Chi Tiết

Khi bạn reset, hệ thống sẽ:

```
1. ✅ Clear localStorage (Tất cả key)
2. ✅ Clear sessionStorage (Tất cả session)
3. ✅ Clear Cookies (Tất cả cookies)
4. ✅ Clear IndexedDB (Supabase cache)
5. ✅ Redirect về /login
6. ✅ Force reload từ server (bypass cache)
```

---

## 📱 Giao Diện

### Desktop Header:
```
[Logo] [Nav] ... [Reset] [🔔 2] [👤 User] [Logout]
                   ↑
              Click đây
```

### Mobile Header:
```
[☰] ... [🔄] [🔔] [👤]
          ↑
     Click đây
```

### Loading Screen (sau 5s):
```
  [⏳ Loading...]
  Đang tải...

  Tải quá lâu?
  [🔄 Reset ứng dụng]
  Hoặc nhấn Ctrl+Shift+R
```

---

## 🔥 Khi Nào Cần Reset?

### ✅ Nên Reset Khi:
- App bị "stuck" ở màn hình loading
- Sau khi đăng xuất mà không redirect
- Session hết hạn nhưng chưa logout
- Thấy lỗi "Session error" trong console
- App load chậm bất thường
- Dữ liệu không sync đúng

### ⚠️ Lưu Ý:
- Reset sẽ xóa **TẤT CẢ** dữ liệu local
- Bạn sẽ phải **đăng nhập lại**
- Notification chưa đọc sẽ mất (nếu chưa sync server)

---

## 🎮 Demo Flow

### Scenario 1: Bị Stuck Loading
```
1. Vào app → Loading... (quá 5s)
2. Thấy nút "Reset ứng dụng"
3. Click → Confirm OK
4. App tự động clear → reload → login screen
5. Đăng nhập → Vào app bình thường
```

### Scenario 2: Session Lỗi
```
1. Thấy lỗi trong console
2. Nhấn Ctrl+Shift+R
3. Confirm → Auto reset
4. Login lại → OK
```

### Scenario 3: Muốn Fresh Start
```
1. Click nút "Reset" trên header
2. Confirm → Clear all
3. Login lại với cache sạch
```

---

## 💡 Tips

### Power User Tip:
Ghi nhớ phím tắt: **Ctrl+Shift+R** = Reset nhanh nhất!

### Development Tip:
Nếu test features mới, reset trước để đảm bảo cache sạch:
```javascript
// In Console
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### Mobile Tip:
Trên mobile, icon Reset nhỏ hơn nhưng vẫn click được ở header.

---

## 🐛 Troubleshooting

**Q: Nhấn Reset nhưng vẫn bị lỗi?**  
A: Hard reload browser: Ctrl+Shift+Delete → Clear all → Close browser → Open lại

**Q: Phím tắt không hoạt động?**  
A: Đảm bảo focus vào app (click vào trang trước), không focus vào DevTools

**Q: Nút Reset không hiện?**  
A: Kiểm tra đã đăng nhập chưa. Nếu chưa login thì không có nút (dùng phím tắt thay thế)

**Q: Sau reset vẫn chậm?**  
A: Có thể do:
- Network chậm → Check connection
- Supabase API chậm → Check Supabase dashboard
- RLS policies phức tạp → Review policies

---

## 📊 Technical Details

### File Structure:
```
src/
  utils/
    resetApp.js         → forceResetApp(), devReset()
  components/
    ResetButton.jsx     → Button với keyboard shortcut
    LoadingSpinner.jsx  → Auto-show reset sau 5s
    Layout.jsx          → Chứa ResetButton trong header
```

### Functions:
```javascript
// Clear everything and reload
forceResetApp()

// Dev mode reset (with confirm)
devReset()
```

### Keyboard Shortcut Implementation:
```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault()
      handleReset()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

---

**🎉 Bây giờ bạn không cần Clear Site Data thủ công nữa!**

Just click, confirm, done! 🚀
