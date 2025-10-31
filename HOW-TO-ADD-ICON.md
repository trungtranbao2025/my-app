# 🎨 TẠO ICON CHO ỨNG DỤNG WINDOWS

## Cách 1: Tạo icon từ logo công ty (Khuyến nghị)

### Bước 1: Chuẩn bị logo
1. Lấy logo công ty (file PNG hoặc JPG)
2. Kích thước khuyến nghị: **256x256** hoặc **512x512** pixels
3. Nền trong suốt (transparent) là tốt nhất

### Bước 2: Convert sang .ico
Truy cập một trong các website sau:
- 🌐 https://icoconvert.com/
- 🌐 https://cloudconvert.com/png-to-ico
- 🌐 https://convertio.co/png-ico/

**Các bước:**
1. Upload file logo (PNG/JPG)
2. Chọn size: 256x256 (hoặc Multiple sizes)
3. Convert
4. Download file `.ico`

### Bước 3: Đặt file vào project
```
Đặt file icon.ico vào thư mục: public/icon.ico
```

### Bước 4: Cập nhật config
File `electron-builder.json`:
```json
"win": {
  "icon": "public/icon.ico"
}
```

File `electron/main.cjs`:
```javascript
icon: path.join(__dirname, '../public/icon.ico')
```

### Bước 5: Build lại
```bash
npm run electron:build:win
```

---

## Cách 2: Tạo icon text-based (Tạm thời)

### Tạo icon với text "IBST BIM"
1. Truy cập: https://www.favicon.cc/
2. Hoặc: https://realfavicongenerator.net/
3. Tạo icon với text "IB" hoặc logo đơn giản
4. Download dạng .ico
5. Đặt vào `public/icon.ico`

---

## Cách 3: Sử dụng tool tạo icon

### Online:
- **Canva**: https://www.canva.com/
- **Figma**: https://www.figma.com/
- **Photopea**: https://www.photopea.com/

### Offline (Windows):
- **GIMP**: Free, powerful
- **Paint.NET**: Free
- **IcoFX**: Chuyên dụng cho icon

---

## ⚡ Nhanh: Tạo icon text với PowerShell

Tôi sẽ tạo một icon đơn giản cho bạn ngay bây giờ!

---

## 📋 Checklist

- [ ] Có file logo công ty (PNG/JPG)
- [ ] Convert sang .ico (256x256)
- [ ] Đặt vào `public/icon.ico`
- [ ] Build lại: `npm run electron:build:win`

---

## 🎯 File hiện tại

**Icon location:** `public/icon.ico`

**Nếu không có icon:** App sẽ dùng icon mặc định của Electron (logo Electron)

**Để thêm icon:** Đặt file `icon.ico` vào thư mục `public/` và build lại!
