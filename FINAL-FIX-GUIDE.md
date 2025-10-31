# ✅ HƯỚNG DẪN CHẠY ỨNG DỤNG - ĐÃ SỬA LỖI

## 🐛 **Lỗi đã sửa:**

### Vấn đề: Màn hình trắng khi mở app
**Nguyên nhân:** 
1. ❌ Vite config thiếu `base: './'`
2. ❌ Đường dẫn load index.html không đúng trong production

**Đã fix:**
1. ✅ Thêm `base: './'` vào `vite.config.js`
2. ✅ Sửa đường dẫn trong `electron/main.cjs` với `app.isPackaged`

---

## 🚀 **CÁCH CHẠY ỨNG DỤNG**

### **Option 1: Chạy file mới nhất (Khuyến nghị)**

```powershell
# Chạy app từ thư mục unpacked
Start-Process "c:\Users\Windows\Downloads\app QLDA\dist-electron\win-unpacked\IBST BIM - Quản lý Dự án.exe"
```

### **Option 2: Cài đặt Installer**

Sau khi build hoàn tất (đang chạy), file sẽ ở:
```
c:\Users\Windows\Downloads\app QLDA\dist-electron\
├── IBST BIM - Quản lý Dự án-1.0.0-Setup.exe (Installer)
└── IBST BIM - Quản lý Dự án-1.0.0-Portable.exe (Portable)
```

**Các bước cài đặt:**
1. Gỡ app cũ nếu có (Windows Settings → Apps)
2. Double-click file Setup.exe
3. Làm theo wizard cài đặt
4. Chạy app

---

## 🔍 **Kiểm tra kết quả**

### **Kết quả mong đợi:**
✅ App mở ra và hiển thị trang đăng nhập
✅ Logo "IBST BIM" hiển thị
✅ Có thể nhập email/password
✅ Các assets (CSS, JS) load đúng

### **Nếu vẫn màn hình trắng:**
1. Nhấn **F12** để mở DevTools
2. Xem tab **Console** - có lỗi gì?
3. Xem tab **Network** - file nào không load được?
4. Chụp screenshot và gửi cho tôi

---

## 📝 **Thay đổi đã thực hiện**

### 1. `vite.config.js`
```javascript
export default defineConfig({
  plugins: [react()],
  base: './',  // ← THÊM DÒNG NÀY (quan trọng!)
  // ...
})
```

### 2. `electron/main.cjs`
```javascript
const startUrl = process.env.ELECTRON_START_URL || 
  (app.isPackaged 
    ? `file://${path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html')}`
    : `file://${path.join(__dirname, '../dist/index.html')}`
  )
```

---

## 🧪 **Test Development Mode**

Để test app trong development (trước khi build):

```powershell
# Terminal 1: Chạy dev server
npm run dev

# Terminal 2: Chạy Electron
npm run electron:dev
```

Kết quả: App mở với hot-reload, có DevTools

---

## 📦 **Build Commands**

```powershell
# Build web app
npm run build

# Build Electron (unpacked - nhanh)
npx electron-builder --win --dir

# Build full installer
npm run electron:build:win
```

---

## ✅ **Checklist**

Trước khi chạy build:
- [ ] Đã có `base: './'` trong `vite.config.js`
- [ ] Đã sửa đường dẫn trong `electron/main.cjs`
- [ ] Đã tắt tất cả instance của app đang chạy
- [ ] Có đủ dung lượng disk (~500MB)

Sau khi cài đặt:
- [ ] App mở được
- [ ] Hiển thị trang đăng nhập
- [ ] Nhập email/password được
- [ ] Sau khi đăng nhập vào được Dashboard

---

## 🎯 **Kết luận**

**Lỗi chính:** Vite config thiếu `base: './'` → Assets không load được → Màn hình trắng

**Fix:** Đã thêm `base: './'` và sửa đường dẫn load file

**Status:** ✅ Đã fix, đang build installer mới

**Next step:** Đợi build xong → Cài đặt → Test

---

## 📞 **Nếu cần hỗ trợ**

Gửi cho tôi:
1. Screenshot app (F12 → Console tab)
2. Phiên bản Windows (Win + R → winver)
3. Log lỗi (nếu có)
