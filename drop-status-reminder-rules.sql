-- Remove Status Reminder Rules feature (DB objects)
-- Safe to re-run. Execute in Supabase SQL Editor.

begin;

-- 1) Detach trigger from tasks
DROP TRIGGER IF EXISTS trg_sync_status_reminders ON public.tasks;

-- 2) Drop functions used by the feature
DROP FUNCTION IF EXISTS public._trg_sync_status_reminders() CASCADE;
DROP FUNCTION IF EXISTS public.apply_status_reminder_rules() CASCADE;
DROP FUNCTION IF EXISTS public.sync_task_reminder_for_task(uuid) CASCADE;
DROP FUNCTION IF EXISTS public._table_exists(text, text) CASCADE;

-- 3) Drop rules table
DROP TABLE IF EXISTS public.status_reminder_rules CASCADE;

commit;

-- Note: We keep task_reminder_settings and task_reminders (user-level reminders) intact.
-- If you want to clear any auto-generated settings, you may optionally run:
--   delete from public.task_reminder_settings where is_custom = false;
