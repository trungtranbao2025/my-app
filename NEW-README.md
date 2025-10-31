# Phần mềm quản lý dự án tư vấn giám sát

Một ứng dụng web hiện đại được phát triển với React và Supabase để quản lý dự án, công việc và nhân sự cho các công ty tư vấn giám sát xây dựng.

## ✨ Tính năng chính

### 🔐 Xác thực và phân quyền
- Đăng nhập/đăng xuất an toàn
- Ba cấp độ quyền: Manager, Admin, User
- Quản lý profile cá nhân

### 📊 Quản lý dự án
- Tạo và quản lý dự án với thông tin chi tiết
- Phân công nhân sự cho từng dự án
- Theo dõi tiến độ dự án theo thời gian thực
- Quản lý hợp đồng và ngân sách

### ✅ Quản lý công việc
- Tạo và phân công công việc
- Theo dõi tiến độ với thanh progress bar màu sắc
- Hệ thống nhắc việc tự động
- Đánh giá và comment công việc
- Quản lý file đính kèm

### 👥 Quản lý nhân sự
- Thông tin chi tiết nhân viên
- Theo dõi ngày sinh và kỷ niệm
- Quản lý vai trò trong dự án
- Lịch sử tham gia dự án

### 📈 Báo cáo và thống kê
- Dashboard tổng quan
- Báo cáo tiến độ dự án
- Thống kê công việc quá hạn
- Biểu đồ phân tích hiệu suất

## 🛠️ Công nghệ sử dụng

### Frontend
- **React 18** - Library JavaScript hiện đại
- **Vite** - Build tool nhanh và hiệu quả
- **Tailwind CSS** - Framework CSS tiện ích
- **React Router** - Điều hướng SPA
- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Cơ sở dữ liệu quan hệ

## 🚀 Cài đặt và chạy dự án

### Yêu cầu hệ thống
- Node.js 18+
- npm
- Tài khoản Supabase

### Các bước cài đặt

1. **Cài đặt dependencies**
```bash
npm install
```

2. **Cấu hình environment variables**
```bash
cp .env.example .env
```
Chỉnh sửa file `.env` với thông tin Supabase:
```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

3. **Thiết lập Supabase**
   - Tạo project mới trên Supabase
   - Copy và chạy SQL script từ file `supabase-schema.sql`
   - Cập nhật URL và API Key trong file `.env`

4. **Chạy ứng dụng**
```bash
npm run dev
```

Ứng dụng sẽ chạy tại: http://localhost:5173

## 📝 Cấu trúc database

Xem file `supabase-schema.sql` để có đầy đủ cấu trúc database với:
- Bảng users, projects, tasks, notifications
- Row Level Security policies
- Triggers tự động cập nhật
- Views và functions hỗ trợ

## 📋 Tài khoản demo

- **Manager**: manager@example.com / password123
- **Admin**: admin@example.com / password123  
- **User**: user@example.com / password123

---

**Phiên bản**: 1.0.0  
**Font chữ**: Times New Roman (chuẩn văn phòng Việt Nam)
