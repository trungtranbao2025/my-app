-- Create demo users for testing
-- Run this in Supabase SQL Editor

-- Note: Supabase auth requires users to be created via the Auth API or Dashboard
-- This script creates the profile entries - you need to create auth users separately

-- STEP 1: Go to Supabase Dashboard > Authentication > Users
-- Click "Add User" and create these users:
-- Email: manager@example.com, Password: password123
-- Email: admin@example.com, Password: password123  
-- Email: user@example.com, Password: password123

-- STEP 2: After creating users in the dashboard, get their UUIDs and update this script
-- Then run it to create the profiles

-- Example: Replace these UUIDs with actual ones from your auth.users table
-- You can get them by running: SELECT id, email FROM auth.users;

-- Insert profiles for demo users with actual UUIDs from auth.users

INSERT INTO public.profiles (id, email, full_name, phone, position, role, join_date, birthday, is_active)
VALUES
('1857c25b-9847-40b9-88be-ed76c2301c0a', 'manager@example.com', 'Trần Bảo Trung', '0901234567', 'Giám đốc dự án', 'manager', CURRENT_DATE, '1985-05-15', true),
('12716509-f93e-4e04-bce6-0b7e3dd247a3', 'admin@example.com', 'Nguyễn Văn A', '0902345678', 'Quản lý', 'admin', CURRENT_DATE, '1988-08-20', true),
('f459b983-2e40-479b-b7f3-9ef80cb7c50d', 'tranbaotrunghcm@gmail.com', 'Lê Thị B', '0903456789', 'Kỹ sư', 'user', CURRENT_DATE, '1992-12-10', true)
ON CONFLICT (id) DO NOTHING;

-- Query to check existing auth users
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- After you have the UUIDs, uncomment and update the INSERT above
