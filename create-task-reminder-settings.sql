-- Task Reminders Queue (scheduled instances) + utilities
-- This script is idempotent and non-destructive. It will also migrate the old
-- table name if needed.

-- 0) Rename legacy table if present (queue previously named task_reminder_settings)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='task_reminder_settings'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='task_reminder_settings' AND column_name='active'
  ) THEN
    -- Looks like the queue table (has scheduled_at but no 'active'). Rename to task_reminders
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='task_reminders'
    ) THEN
      EXECUTE 'ALTER TABLE public.task_reminder_settings RENAME TO task_reminders';
    END IF;
  END IF;
END$$ LANGUAGE plpgsql;

-- 1) Create the queue table if not exists (task_reminders)
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

-- Back-compat: rename legacy columns and add any missing ones so index creation won't fail
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='reminder_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='scheduled_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders RENAME COLUMN reminder_time TO scheduled_at';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='reminder_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='type'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders RENAME COLUMN reminder_type TO type';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='is_sent'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='sent'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders RENAME COLUMN is_sent TO sent';
  END IF;
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
END $$ LANGUAGE plpgsql;

COMMENT ON TABLE public.task_reminders IS 'Scheduled task reminders generated from user preferences';
COMMENT ON COLUMN public.task_reminders.scheduled_at IS 'When to send the reminder';
COMMENT ON COLUMN public.task_reminders.type IS 'scheduled_time: from specific_times, repeat_interval: from repeat_every_hours';
COMMENT ON COLUMN public.task_reminders.sent IS 'Whether the reminder has been sent';

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON public.task_reminders(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_user_id ON public.task_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_scheduled_at ON public.task_reminders(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_task_reminders_sent ON public.task_reminders(sent);
CREATE INDEX IF NOT EXISTS idx_task_reminders_pending ON public.task_reminders(scheduled_at, sent) WHERE sent = false;

-- 3) RLS
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Users can view their own reminders
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_reminders' AND policyname = 'Users can view own reminders'
  ) THEN
    CREATE POLICY "Users can view own reminders"
      ON public.task_reminders FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Service role insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_reminders' AND policyname = 'Service role can insert reminders'
  ) THEN
    CREATE POLICY "Service role can insert reminders"
      ON public.task_reminders FOR INSERT
      WITH CHECK (true);
  END IF;

  -- Service role update
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_reminders' AND policyname = 'Service role can update reminders'
  ) THEN
    CREATE POLICY "Service role can update reminders"
      ON public.task_reminders FOR UPDATE
      USING (true);
  END IF;

  -- Service role delete
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_reminders' AND policyname = 'Service role can delete reminders'
  ) THEN
    CREATE POLICY "Service role can delete reminders"
      ON public.task_reminders FOR DELETE
      USING (true);
  END IF;
END $$ LANGUAGE plpgsql;

-- 4) Utilities
CREATE OR REPLACE FUNCTION public.send_pending_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $send_pending$
DECLARE
  reminder record;
BEGIN
  FOR reminder IN
    SELECT 
      r.id AS reminder_id,
      r.task_id,
      r.user_id,
      r.message,
      t.title AS task_title,
      t.due_date,
      p.name AS project_name
    FROM public.task_reminders r
    JOIN public.tasks t ON t.id = r.task_id
    LEFT JOIN public.projects p ON p.id = t.project_id
    WHERE r.sent = false
      AND r.scheduled_at <= now()
    ORDER BY r.scheduled_at ASC
    LIMIT 100
  LOOP
    INSERT INTO public.notifications (
      user_id, title, message, type, related_id, created_at
    ) VALUES (
      reminder.user_id,
      '🔔 Nhắc việc: ' || reminder.task_title,
      reminder.message || ' - Dự án: ' || coalesce(reminder.project_name, 'N/A') || 
        CASE WHEN reminder.due_date IS NOT NULL 
          THEN ' - Hạn: ' || to_char(reminder.due_date, 'DD/MM/YYYY')
          ELSE ''
        END,
      'task_reminder',
      reminder.task_id,
      now()
    );

    UPDATE public.task_reminders
    SET sent = true, sent_at = now(), updated_at = now()
    WHERE id = reminder.reminder_id;
  END LOOP;
END;$send_pending$;

COMMENT ON FUNCTION public.send_pending_reminders IS 'Process pending reminders and create notifications';

CREATE OR REPLACE FUNCTION public.cleanup_old_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $cleanup$
BEGIN
  DELETE FROM public.task_reminders
  WHERE sent = true
    AND sent_at < now() - interval '30 days';
END;$cleanup$;

COMMENT ON FUNCTION public.cleanup_old_reminders IS 'Delete sent reminders older than 30 days';

-- 5) Updated at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.task_reminders'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON public.task_reminders
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$ LANGUAGE plpgsql;

-- Grants
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON public.task_reminders TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_pending_reminders TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_reminders TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'task_reminders queue ready. If you previously used task_reminder_settings as queue, it has been migrated.';
END $$ LANGUAGE plpgsql;
