-- Reminders schema fix and migration: split settings vs queue
-- Run this in Supabase SQL Editor. Idempotent and non-destructive.

-- Ensure required extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- A) If legacy queue table is named task_reminder_settings (no 'active' column), rename to task_reminders
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='task_reminder_settings'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminder_settings' AND column_name='active'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='task_reminders'
    ) THEN
      -- Simple case: rename legacy queue to the correct queue name
      EXECUTE 'ALTER TABLE public.task_reminder_settings RENAME TO task_reminders';
    ELSE
      -- Both exist but settings table is actually a legacy queue; back it up and free the name
      EXECUTE 'ALTER TABLE public.task_reminder_settings RENAME TO task_reminders_legacy_backup';
    END IF;
  END IF;
END; $$ LANGUAGE plpgsql;

-- B) Ensure queue table exists
CREATE TABLE IF NOT EXISTS public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  message text not null,
  type text not null check (type in ('scheduled_time','repeat_interval')),
  sent boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Back-compat: rename legacy columns and add any missing ones
DO $$
BEGIN
  -- reminder_time -> scheduled_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='reminder_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='scheduled_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders RENAME COLUMN reminder_time TO scheduled_at';
  END IF;

  -- reminder_type -> type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='reminder_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='type'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders RENAME COLUMN reminder_type TO type';
  END IF;

  -- is_sent -> sent
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='is_sent'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='sent'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders RENAME COLUMN is_sent TO sent';
  END IF;

  -- Ensure required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='scheduled_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders ADD COLUMN scheduled_at timestamptz NOT NULL DEFAULT now()';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='message'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders ADD COLUMN message text NOT NULL DEFAULT ''''';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='type'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders ADD COLUMN type text CHECK (type in (''scheduled_time'',''repeat_interval'')) DEFAULT ''scheduled_time''';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='sent'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders ADD COLUMN sent boolean DEFAULT false';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='sent_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders ADD COLUMN sent_at timestamptz';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='created_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders ADD COLUMN created_at timestamptz DEFAULT now()';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='updated_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders ADD COLUMN updated_at timestamptz DEFAULT now()';
  END IF;
END; $$ LANGUAGE plpgsql;

-- C) Ensure settings table exists (rules upsert target)
CREATE TABLE IF NOT EXISTS public.task_reminder_settings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  repeat_interval_unit text check (repeat_interval_unit in ('hours','days','weeks','months','quarters','years')),
  repeat_interval_value int check (repeat_interval_value > 0),
  start_mode text check (start_mode in ('on_create','on_upcoming','on_overdue')),
  timezone text default 'Asia/Ho_Chi_Minh',
  quiet_hours jsonb default '{"start":"22:00","end":"07:00"}',
  channels text[] default '{push}',
  escalate_after int default 0,
  is_custom boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(task_id, user_id)
);

-- D) Recreate trigger on tasks to sync status reminders (use due_date)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tasks'
  ) THEN
    -- Only recreate trigger if helper function exists (feature may be removed)
    IF EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = '_trg_sync_status_reminders'
    ) THEN
      DROP TRIGGER IF EXISTS trg_sync_status_reminders ON public.tasks;
  -- Use a distinct dollar-quote tag for the dynamic CREATE TRIGGER block
      EXECUTE $trg$
        CREATE TRIGGER trg_sync_status_reminders
        AFTER INSERT OR UPDATE OF status, priority, due_date, assigned_to ON public.tasks
        FOR EACH ROW EXECUTE FUNCTION public._trg_sync_status_reminders()
      $trg$;
    ELSE
      RAISE NOTICE 'Skipped creating trigger trg_sync_status_reminders (function public._trg_sync_status_reminders() not found)';
    END IF;
  END IF;
END; $$ LANGUAGE plpgsql;

-- E) Replace helper functions to reference task_reminders
CREATE OR REPLACE FUNCTION public.send_pending_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE rec record; BEGIN
  FOR rec IN
    SELECT tr.id AS reminder_id, tr.task_id, tr.user_id, tr.message,
           t.title AS task_title, t.due_date, p.name AS project_name
    FROM public.task_reminders tr
    JOIN public.tasks t ON t.id = tr.task_id
    LEFT JOIN public.projects p ON p.id = t.project_id
    WHERE tr.sent = false AND tr.scheduled_at <= now()
    ORDER BY tr.scheduled_at ASC LIMIT 100
  LOOP
    INSERT INTO public.notifications(user_id, title, message, type, related_id, created_at)
    VALUES (
      rec.user_id,
      '🔔 Nhắc việc: ' || rec.task_title,
      rec.message || ' - Dự án: ' || coalesce(rec.project_name,'N/A') ||
        CASE WHEN rec.due_date IS NOT NULL THEN ' - Hạn: ' || to_char(rec.due_date,'DD/MM/YYYY') ELSE '' END,
      'task_reminder', rec.task_id, now());
    UPDATE public.task_reminders SET sent=true, sent_at=now(), updated_at=now() WHERE id=rec.reminder_id;
  END LOOP; END;$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.task_reminders WHERE sent=true AND sent_at < now() - interval '30 days';
END;$$;

DO $$
BEGIN
  RAISE NOTICE 'Migration complete: task_reminders (queue) and task_reminder_settings (rules) are in place.';
END; $$ LANGUAGE plpgsql;

-- F) Helper: enqueue a reminder row manually (useful for smoke tests)
--    Returns the created reminder id
CREATE OR REPLACE FUNCTION public.enqueue_task_reminder(
  p_task_id uuid,
  p_user_id uuid,
  p_scheduled_at timestamptz,
  p_message text,
  p_type text DEFAULT 'scheduled_time'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.task_reminders(task_id, user_id, scheduled_at, message, type)
  VALUES (p_task_id, p_user_id, p_scheduled_at, p_message, p_type)
  RETURNING id INTO v_id;
  RETURN v_id;
END;$$;

-- G) Convenience: enqueue the first reminder for a task's assignee
--    Default offset is -1 minute so it is immediately eligible for sending
CREATE OR REPLACE FUNCTION public.enqueue_first_reminder_for_task(
  p_task_id uuid,
  p_minutes_from_now int DEFAULT -1,
  p_user_id_override uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_title text;
  v_id uuid;
BEGIN
  SELECT assigned_to, title INTO v_user_id, v_title
  FROM public.tasks WHERE id = p_task_id;

  -- Allow explicit override when task has no assignee
  v_user_id := COALESCE(p_user_id_override, v_user_id);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Task % not found or has no assignee; pass p_user_id_override or use public.enqueue_task_reminder()', p_task_id;
  END IF;

  v_id := public.enqueue_task_reminder(
    p_task_id,
    v_user_id,
    now() + make_interval(mins => p_minutes_from_now),
    'Nhắc việc: ' || coalesce(v_title,'(không tên)'),
    'scheduled_time'
  );

  RETURN v_id;
END;$$;