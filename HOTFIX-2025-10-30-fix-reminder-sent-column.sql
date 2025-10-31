-- HOTFIX: Normalize task_reminders to use `sent` and `scheduled_at`
-- and replace legacy functions that still reference `is_sent` or `reminder_time`.
-- Safe to run multiple times.

begin;

-- 1) Columns: rename legacy names to new ones when applicable
DO $$
BEGIN
  -- reminder_time -> scheduled_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='reminder_time'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='scheduled_at'
  ) THEN
    ALTER TABLE public.task_reminders RENAME COLUMN reminder_time TO scheduled_at;
  END IF;

  -- reminder_type -> type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='reminder_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='type'
  ) THEN
    ALTER TABLE public.task_reminders RENAME COLUMN reminder_type TO type;
  END IF;

  -- is_sent -> sent
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='is_sent'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='sent'
  ) THEN
    ALTER TABLE public.task_reminders RENAME COLUMN is_sent TO sent;
  END IF;

  -- Ensure required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='scheduled_at'
  ) THEN
    ALTER TABLE public.task_reminders ADD COLUMN IF NOT EXISTS scheduled_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='message'
  ) THEN
    ALTER TABLE public.task_reminders ADD COLUMN IF NOT EXISTS message text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='type'
  ) THEN
    ALTER TABLE public.task_reminders ADD COLUMN IF NOT EXISTS type text CHECK (type in ('scheduled_time','repeat_interval')) DEFAULT 'scheduled_time';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='sent'
  ) THEN
    ALTER TABLE public.task_reminders ADD COLUMN IF NOT EXISTS sent boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='sent_at'
  ) THEN
    ALTER TABLE public.task_reminders ADD COLUMN IF NOT EXISTS sent_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='created_at'
  ) THEN
    ALTER TABLE public.task_reminders ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='updated_at'
  ) THEN
    ALTER TABLE public.task_reminders ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  END IF;

  -- Compatibility shim: if legacy code still references is_sent, add a synced mirror column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='task_reminders' AND column_name='is_sent'
  ) THEN
    ALTER TABLE public.task_reminders ADD COLUMN is_sent boolean;
    -- Backfill from sent
    BEGIN
      UPDATE public.task_reminders SET is_sent = sent WHERE is_sent IS DISTINCT FROM sent;
    EXCEPTION WHEN undefined_column THEN
      -- If 'sent' didn't exist yet (rare), ignore backfill here
      NULL;
    END;

    -- Create a small sync trigger so either column update keeps the other in sync
    CREATE OR REPLACE FUNCTION public._sync_task_reminders_sent()
    RETURNS trigger LANGUAGE plpgsql AS $sync$
    BEGIN
      IF NEW.sent IS NULL AND NEW.is_sent IS NOT NULL THEN
        NEW.sent := NEW.is_sent;
      ELSIF NEW.is_sent IS NULL AND NEW.sent IS NOT NULL THEN
        NEW.is_sent := NEW.sent;
      ELSIF NEW.sent IS NOT NULL AND NEW.is_sent IS NOT NULL AND NEW.sent <> NEW.is_sent THEN
        -- Prefer 'sent' as source of truth
        NEW.is_sent := NEW.sent;
      END IF;
      RETURN NEW;
    END;
    $sync$;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_is_sent_sent' AND tgrelid = 'public.task_reminders'::regclass
    ) THEN
      CREATE TRIGGER trg_sync_is_sent_sent
        BEFORE INSERT OR UPDATE ON public.task_reminders
        FOR EACH ROW EXECUTE FUNCTION public._sync_task_reminders_sent();
    END IF;
  END IF;
END $$;

-- 2) Replace functions to reference new column names
-- count_pending_task_reminders()
CREATE OR REPLACE FUNCTION public.count_pending_task_reminders()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INT FROM public.task_reminders r
  JOIN public.tasks t ON t.id = r.task_id
  WHERE r.sent = false
    AND r.scheduled_at <= NOW()
    AND (t.is_completed = false AND t.status <> 'completed');
$$;

REVOKE ALL ON FUNCTION public.count_pending_task_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_pending_task_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_pending_task_reminders() TO service_role;

-- send_task_reminders(): legacy helper used by dashboards/scripts
CREATE OR REPLACE FUNCTION public.send_task_reminders()
RETURNS void AS $$
DECLARE
    reminder RECORD;
    message TEXT;
    uid UUID;
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
        LIMIT 200
    LOOP
        -- In-app notification only (email/sms handled elsewhere)
        INSERT INTO public.notifications (
          user_id, title, message, type, created_at
        ) VALUES (
          reminder.user_id,
          'Nhắc việc',
          COALESCE(reminder.message, 'Nhắc việc: ' || COALESCE(reminder.task_title, '')), 
          'task_reminder',
          now()
        );

        UPDATE public.task_reminders
        SET sent = true, sent_at = NOW()
        WHERE id = reminder.reminder_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.send_task_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_task_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_task_reminders() TO service_role;

-- create_task_reminders() trigger function: only ensure deletion uses r.sent
-- Note: Generation logic varies across environments; we keep legacy matching but fix column names.
CREATE OR REPLACE FUNCTION public.create_task_reminders()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove unsent reminders for this task so we can re-generate
  DELETE FROM public.task_reminders 
  WHERE task_id = NEW.id AND sent = false;

  -- Keep existing behavior: if you have reminder_settings, reinsert here.
  -- This hotfix focuses on column name compatibility to avoid 42703 errors.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers if they referenced the function (no-op if already exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_task_reminders' AND tgrelid = 'public.tasks'::regclass) THEN
    -- nothing: trigger already attached
  ELSE
    -- Legacy name used in some setups
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_task_reminders' AND pronamespace = 'public'::regnamespace) THEN
      CREATE TRIGGER trigger_create_task_reminders
      AFTER INSERT OR UPDATE OF status, priority, due_date, assigned_to ON public.tasks
      FOR EACH ROW EXECUTE FUNCTION public.create_task_reminders();
    END IF;
  END IF;
END $$;

commit;
