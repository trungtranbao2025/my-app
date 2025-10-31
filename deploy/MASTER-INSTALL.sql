-- NOTE: Supabase SQL Editor does NOT support psql meta-commands like \i. If you paste this file
-- as-is, lines like "\i supabase-schema.sql" will fail with: ERROR: 42601: syntax error at or near "\".
--
-- Options:
-- 1) Use the inline installer instead: deploy/MASTER-INSTALL-INLINE.sql (paste-run in SQL Editor)
-- 2) Or run these files one-by-one by opening each .sql file in Supabase SQL Editor
-- 3) Or use psql CLI locally where \i is supported.

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Try to enable pg_cron if available (ignore errors)
DO $$ BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

-- 1) Base schema (profiles, projects, tasks, notifications, etc.)
-- If your instance has a conflicting type definition, you can skip equivalent blocks.
-- Script is idempotent but may differ from existing enum/type definitions.
-- \i supabase-schema.sql  -- Not supported in Supabase Editor; run this file manually if needed

-- 2) Project documents
-- \i create-project-documents.sql  -- Not supported in Supabase Editor; included in INLINE installer

-- 3) Task reports storage
-- \i create-task-reports-storage.sql  -- Not supported in Supabase Editor; included in INLINE installer

-- 4) Multi-assignees
-- \i create-task-multi-assignees.sql  -- Not supported in Supabase Editor; included in INLINE installer

-- 5) Recurring tasks + reminders + enforcement
-- \i create-task-recurring-reminders.sql  -- Not supported in Supabase Editor; included in INLINE installer

-- 6) Realtime (optional)
-- \i enable-realtime.sql  -- Not supported in Supabase Editor; included in INLINE installer

-- 7) Handle new auth user -> profiles
-- \i RUN-THIS-IN-SUPABASE.sql  -- Not supported in Supabase Editor; included in INLINE installer

-- 8) Storage policies (if not already set)
-- \i storage-policies.sql  -- uncomment if needed

-- 9) Schedules via pg_cron (best-effort)
DO $$ BEGIN
  -- send_task_reminders every 15 minutes
  BEGIN
    PERFORM cron.schedule('task-reminders-15m', '*/15 * * * *', 'SELECT public.send_task_reminders();');
  EXCEPTION WHEN others THEN NULL; END;
  -- auto_create_recurring_task at 05:00 daily
  BEGIN
    PERFORM cron.schedule('auto-create-recurring-daily', '0 5 * * *', 'SELECT public.auto_create_recurring_task();');
  EXCEPTION WHEN others THEN NULL; END;
END $$;

-- 10) Force PostgREST reload
DO $$ BEGIN PERFORM pg_notify('pgrst', 'reload schema'); END $$;

-- Done.
