# Hướng dẫn: Tính năng Thêm nhân sự mới

## 🎯 Tổng quan

Tính năng **Thêm nhân sự** đã được kích hoạt và tích hợp đầy đủ với Supabase Authentication.

## ✅ Các thay đổi đã thực hiện

### 1. **Frontend - StaffPage.jsx**

#### A. Kích hoạt nút "Thêm nhân sự"
```jsx
// TRƯỚC: Nút bị disable
<button disabled title="Tính năng tạo user mới...">

// SAU: Nút hoạt động đầy đủ
<button onClick={() => { setEditingUser(null); resetForm(); setShowModal(true); }}>
```

#### B. Thêm trường Password vào form
```jsx
const [formData, setFormData] = useState({
  full_name: '',
  email: '',
  password: '',      // ← MỚI
  phone: '',
  is_active: true,
  birthday: '',
  join_date: ''
})
```

#### C. Cập nhật Modal hiển thị cho cả Thêm mới & Sửa
```jsx
{/* Modal for Add/Edit User */}
{showModal && (
  // Hiển thị cho cả 2 trường hợp
  <h2>{editingUser ? 'Cập nhật...' : 'Thêm nhân sự mới'}</h2>
  
  {/* Trường password chỉ hiện khi thêm mới */}
  {!editingUser && (
    <input type="password" required minLength={6} />
  )}
)}
```

#### D. Logic tạo user mới
```jsx
if (editingUser) {
  // Update existing user
  await usersApi.update(...)
} else {
  // Create new user with auth
  await usersApi.create({
    email, password, full_name, phone, ...
  })
}
```

### 2. **Backend API - api.js**

```javascript
create: async (userData) => {
  // 1. Tạo auth user với Supabase Auth
  const { data: authData } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password || 'TempPassword123!',
    options: {
      data: {
        full_name, phone, birthday, join_date, is_active, role
      }
    }
  })

  // 2. Đợi trigger tạo profile
  await new Promise(resolve => setTimeout(resolve, 1000))

  // 3. Lấy profile đã tạo
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', userData.email)
    .single()

  return profileData
}
```

### 3. **Database - create-user-with-auth.sql**

#### Trigger tự động tạo profile:
```sql
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Tự động tạo profile khi có auth user mới
  INSERT INTO public.profiles (
    id, email, full_name, phone, birthday, 
    join_date, is_active, role
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    ...
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

## 📋 Hướng dẫn sử dụng

### Bước 1: Chạy SQL Migration
Mở Supabase SQL Editor và chạy file:
```bash
create-user-with-auth.sql
```

Script này sẽ:
- ✅ Tạo/cập nhật trigger `handle_new_user()`
- ✅ Tự động tạo profile khi có auth user mới
- ✅ Đồng bộ metadata từ auth.users sang profiles

### Bước 2: Thêm nhân sự mới

1. **Vào trang Nhân sự**
2. **Click nút "Thêm nhân sự"** (màu xanh, góc phải)
3. **Điền form:**
   - ✅ Họ và tên * (bắt buộc)
   - ✅ Email * (bắt buộc, phải là email hợp lệ)
   - ✅ Mật khẩu * (tối thiểu 6 ký tự)
   - Số điện thoại (tùy chọn)
   - Trạng thái (Hoạt động/Vô hiệu hóa)
   - Ngày vào làm (tùy chọn)
   - Ngày sinh (tùy chọn)

4. **Click "Lưu"**

### Bước 3: Kết quả

✅ User được tạo trong `auth.users`
✅ Profile tự động được tạo trong `profiles`
✅ Email xác nhận được gửi (nếu bật Email confirmation)
✅ Hiển thị toast thành công
✅ Danh sách nhân sự tự động refresh

## 🔐 Bảo mật

### Mật khẩu mặc định:
- Nếu người dùng không nhập mật khẩu: `TempPassword123!`
- **Khuyến nghị**: Yêu cầu nhân viên đổi mật khẩu ngay lần đăng nhập đầu tiên

### Quyền hạn:
- Chỉ **Admin** và **Manager** mới thấy nút "Thêm nhân sự"
- Function `create_user_with_profile` chỉ cho phép admin/manager thực thi

## 🔧 Xử lý lỗi

### Lỗi: "Email đã được sử dụng"
```
✗ Lỗi: User already registered
```
**Giải pháp**: Email đã tồn tại trong hệ thống, sử dụng email khác

### Lỗi: "Password too short"
```
✗ Password should be at least 6 characters
```
**Giải pháp**: Nhập mật khẩu ít nhất 6 ký tự

### Lỗi: "Trigger not found"
```
✗ Trigger on_auth_user_created does not exist
```
**Giải pháp**: Chạy lại file `create-user-with-auth.sql`

### Lỗi: "Profile not created"
```
✗ Cannot find profile for email
```
**Giải pháp**: 
1. Kiểm tra trigger đã được tạo chưa
2. Kiểm tra RLS policies cho bảng `profiles`
3. Tăng timeout trong API (từ 1000ms lên 2000ms)

## 📊 Luồng dữ liệu

```
User click "Thêm nhân sự"
    ↓
Modal hiển thị form
    ↓
User điền thông tin
    ↓
Click "Lưu"
    ↓
usersApi.create() được gọi
    ↓
supabase.auth.signUp()
    ↓
Auth user được tạo trong auth.users
    ↓
TRIGGER: on_auth_user_created
    ↓
Profile tự động được tạo trong profiles
    ↓
API fetch profile mới tạo
    ↓
Trả về client
    ↓
Toast thông báo thành công
    ↓
Danh sách nhân sự refresh
```

## 🎨 Giao diện Form

### Form Thêm mới (editingUser = null):
```
┌─────────────────────────────────────┐
│  Thêm nhân sự mới                   │
├─────────────────────────────────────┤
│  Họ và tên *      Email *           │
│  [________]       [________]        │
│                                     │
│  Mật khẩu *                         │
│  [________]                         │
│  Mật khẩu mặc định: TempPassword123!│
│                                     │
│  Số điện thoại    Trạng thái        │
│  [________]       [Hoạt động ▼]     │
│                                     │
│  Ngày vào làm     Ngày sinh         │
│  [__/__/____]     [__/__/____]      │
│                                     │
│            [Hủy]  [Lưu]             │
└─────────────────────────────────────┘
```

### Form Sửa (editingUser != null):
```
┌─────────────────────────────────────┐
│  Cập nhật thông tin nhân sự         │
├─────────────────────────────────────┤
│  Họ và tên *      Email * (disabled)│
│  [________]       [admin@example.com]│
│                                     │
│  Số điện thoại    Trạng thái        │
│  [0902345678]     [Hoạt động ▼]     │
│                                     │
│  (Không có trường password)         │
│                                     │
│            [Hủy]  [Lưu]             │
└─────────────────────────────────────┘
```

## 🧪 Testing

### Test case 1: Thêm nhân sự thành công
```
Input:
- Họ tên: Nguyễn Văn A
- Email: nguyenvana@example.com
- Password: Test123456
- Phone: 0912345678

Expected:
✓ User được tạo
✓ Toast: "Thêm nhân sự thành công!"
✓ User xuất hiện trong danh sách
```

### Test case 2: Email trùng
```
Input:
- Email: admin@example.com (đã tồn tại)

Expected:
✗ Toast: "Email đã được sử dụng"
✗ Modal vẫn mở
```

### Test case 3: Password quá ngắn
```
Input:
- Password: 123 (chỉ 3 ký tự)

Expected:
✗ Browser validation: "Vui lòng điền tối thiểu 6 ký tự"
```

## 📚 Files liên quan

| File | Mô tả |
|------|-------|
| `src/pages/StaffPage.jsx` | Giao diện trang nhân sự |
| `src/lib/api.js` | API functions |
| `create-user-with-auth.sql` | SQL trigger & function |
| `update-project-members-schema.sql` | Schema cho project members |

## 🔄 Cập nhật trong tương lai

- [ ] Gửi email chào mừng tự động
- [ ] Cho phép upload avatar khi tạo user
- [ ] Tạo username tự động từ email
- [ ] Reset password từ admin panel
- [ ] Bulk import users từ Excel

## 📞 Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra console browser (F12)
2. Kiểm tra Supabase Logs
3. Đảm bảo đã chạy SQL migration
4. Kiểm tra RLS policies
