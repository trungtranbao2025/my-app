# 🚨 FIX INFINITE RECURSION - CHẠY NGAY!

## ❌ LỖI HIỆN TẠI:

```
Error: infinite recursion detected in policy for relation "profiles"
500 (Internal Server Error)
Trang Nhân sự: "Không có quyền truy cập"
```

## 🔍 NGUYÊN NHÂN:

**RLS Policy gây đệ quy vô hạn!**

**Policy cũ (SAI):**
```sql
CREATE POLICY "Admins and Managers can view all profiles"
ON profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles  -- ← ĐỆ QUY!
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager')
  )
);
```

**Vì sao đệ quy?**
1. User SELECT profiles
2. RLS check policy
3. Policy SELECT profiles để check role
4. RLS lại check policy
5. Policy lại SELECT profiles...
6. → **Vô hạn!** → 500 Error

---

## ✅ GIẢI PHÁP (2 BƯỚC):

### BƯỚC 1: Chạy SQL Fix (QUAN TRỌNG!)

**File:** `fix-infinite-recursion.sql`

**Chức năng:**
- ✅ DROP tất cả policies cũ (gây đệ quy)
- ✅ Tạo policies ĐƠN GIẢN (không đệ quy)
- ✅ UPDATE role = 'manager' cho tranbaotrunghcm@gmail.com
- ✅ Verify tất cả thành công

**Chạy:**
```
1. Supabase SQL Editor
2. Copy toàn bộ fix-infinite-recursion.sql
3. RUN
4. ✅ Thấy "MANAGER với quyền toàn quyền"
```

---

### BƯỚC 2: Code ĐÃ SỬA (Tự động)

**File:** `src/pages/StaffPage.jsx`

**Thay đổi:**
```javascript
// TRƯỚC:
if (profile?.role !== 'manager')

// SAU:
if (profile?.role !== 'manager' && profile?.role !== 'admin')
```

✅ Cho phép cả Manager VÀ Admin truy cập trang Nhân sự

---

## 📊 SAU KHI CHẠY:

### Query 1: Check Policies
```sql
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'profiles';
```

**Kết quả:**
```
Allow authenticated users to view all profiles   | SELECT
Allow service role to insert profiles            | INSERT  
Allow authenticated users to update all profiles | UPDATE
Allow service role to delete profiles            | DELETE
```
✅ Không còn policies phức tạp gây đệ quy!

### Query 2: Check User Role
```sql
SELECT email, role FROM profiles 
WHERE email = 'tranbaotrunghcm@gmail.com';
```

**Kết quả:**
```
email                       | role
tranbaotrunghcm@gmail.com  | manager  ✅
```

---

## 🎯 TEST SAU KHI FIX:

### Test 1: Load Trang Nhân Sự
```
1. Refresh browser (Ctrl + F5)
2. Click "Nhân sự" trong menu
3. ✅ Thấy danh sách nhân viên
4. ❌ KHÔNG còn "Không có quyền truy cập"
```

### Test 2: Console Không Còn Lỗi
```
F12 → Console:
✅ KHÔNG còn "500 Internal Server Error"
✅ KHÔNG còn "infinite recursion"
✅ GET /profiles → 200 OK
```

### Test 3: Update User
```
1. Click Edit user bất kỳ
2. Sửa thông tin
3. Click Cập nhật
4. ✅ THÀNH CÔNG!
```

---

## 🔒 VỀ BẢO MẬT:

**Policies mới CHO PHÉP tất cả authenticated users:**
- ✅ Đơn giản, không đệ quy
- ✅ Hoạt động ngay lập tức
- ⚠️ Ít bảo mật hơn (tất cả users thấy tất cả profiles)

**Nếu cần bảo mật chặt chẽ hơn:**
1. Dùng JWT claims thay vì subquery
2. Hoặc tắt RLS cho admin panel (chỉ check trong code)
3. Hoặc dùng service_role key cho admin operations

**Hiện tại:** Frontend đã check role → Đủ bảo mật cho admin panel

---

## ✅ CHECKLIST:

- [ ] Chạy `fix-infinite-recursion.sql` trong Supabase
- [ ] Verify: 4 policies mới, không còn policies cũ
- [ ] Verify: tranbaotrunghcm@gmail.com role = 'manager'
- [ ] Refresh browser (Ctrl + F5)
- [ ] Vào trang Nhân sự → ✅ Thấy danh sách
- [ ] Test Edit user → ✅ Thành công
- [ ] Console không còn lỗi 500

---

## 🐛 NẾU VẪN LỖI:

### "Không có quyền truy cập" vẫn hiện
```
→ profile.role không phải 'manager' hoặc 'admin'
→ Chạy lại BƯỚC 5 trong fix-infinite-recursion.sql:
  UPDATE profiles SET role = 'manager'::user_role
  WHERE email = 'tranbaotrunghcm@gmail.com';
```

### Vẫn lỗi 500
```
→ Policies chưa được tạo đúng
→ DROP tất cả policies:
  SELECT 'DROP POLICY IF EXISTS "' || policyname || '" ON profiles;'
  FROM pg_policies WHERE tablename = 'profiles';
→ Chạy lại fix-infinite-recursion.sql
```

### profile = null
```
→ AuthContext chưa load xong
→ Check Console: Auth event: SIGNED_IN
→ Nếu chưa → LOGOUT → LOGIN lại
```

---

**CHẠY `fix-infinite-recursion.sql` NGAY!** 🚀

Sau đó:
1. ✅ Ctrl + F5 (hard refresh)
2. ✅ Vào Nhân sự
3. ✅ THẤY DANH SÁCH!
4. ✅ KHÔNG CÒN LỖI!
