-- Enable Realtime cho các bảng quan trọng
-- Chạy script này trong Supabase SQL Editor

-- Kiểm tra publication supabase_realtime có tồn tại không
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Enable Realtime cho bảng notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
END $$;

-- Enable Realtime cho bảng task_proposals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'task_proposals'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE task_proposals;
    END IF;
END $$;

-- Enable Realtime cho bảng tasks
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
    END IF;
END $$;

-- Enable Realtime cho bảng task_reminders (nếu đã tạo)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'task_reminders'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'task_reminders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE task_reminders;
    END IF;
END $$;

-- Enable Realtime cho bảng reminder_settings (nếu đã tạo)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'reminder_settings'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'reminder_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE reminder_settings;
    END IF;
END $$;

-- Enable Realtime cho bảng projects (để cập nhật realtime)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'projects'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE projects;
    END IF;
END $$;

-- Enable Realtime cho bảng profiles (để cập nhật thông tin user)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
    END IF;
END $$;

-- Kiểm tra danh sách tables đã enable Realtime
SELECT 
    schemaname,
    tablename,
    'Enabled ✅' as status
FROM 
    pg_publication_tables
WHERE 
    pubname = 'supabase_realtime'
ORDER BY 
    tablename;

-- Nếu muốn xem chi tiết hơn
SELECT 
    p.pubname as publication_name,
    n.nspname as schema_name,
    c.relname as table_name,
    CASE 
        WHEN p.puballtables THEN 'ALL TABLES'
        ELSE 'SPECIFIC TABLES'
    END as publication_scope
FROM 
    pg_publication p
    LEFT JOIN pg_publication_rel pr ON p.oid = pr.prpubid
    LEFT JOIN pg_class c ON pr.prrelid = c.oid
    LEFT JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE 
    p.pubname = 'supabase_realtime'
ORDER BY 
    c.relname;

-- Comment
COMMENT ON PUBLICATION supabase_realtime IS 'Publication for Realtime streaming to client applications';
