-- Allow authenticated users to INSERT their own reminders into public.task_reminders
-- Safe to run multiple times. Execute in Supabase SQL Editor.

DO $$
DECLARE
  seq_name text;
BEGIN
  -- Ensure table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='task_reminders'
  ) THEN
    RAISE EXCEPTION 'Table public.task_reminders does not exist. Run create-task-reminder-settings.sql first.';
  END IF;

  -- Enable RLS
  EXECUTE 'ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY';

  -- Grant basic privileges to authenticated (USAGE is not valid for TABLE)
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.task_reminders TO authenticated;

  -- Also grant privileges on the sequence backing the primary key (if any)
  -- This avoids "permission denied for sequence ..." when inserting rows
  SELECT pg_get_serial_sequence('public.task_reminders', 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', seq_name);
  END IF;

  -- Harden schema defaults so client inserts don't fail
  -- Ensure 'type' has a sane default (older schemas may miss this)
  EXECUTE 'ALTER TABLE public.task_reminders ALTER COLUMN type SET DEFAULT ''scheduled_time''';
  EXECUTE 'UPDATE public.task_reminders SET type = ''scheduled_time'' WHERE type IS NULL';

  -- Also ensure common defaults on scheduled_at and sent
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='task_reminders' AND column_name='scheduled_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders ALTER COLUMN scheduled_at SET DEFAULT now()';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='task_reminders' AND column_name='sent'
  ) THEN
    EXECUTE 'ALTER TABLE public.task_reminders ALTER COLUMN sent SET DEFAULT false';
  END IF;

  -- Users can select their own reminders
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_reminders' AND policyname='Users can view own reminders'
  ) THEN
    CREATE POLICY "Users can view own reminders" ON public.task_reminders FOR SELECT
      USING ( user_id = auth.uid() );
  END IF;

  -- Users can insert their own reminders
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_reminders' AND policyname='Users can insert own reminders'
  ) THEN
    CREATE POLICY "Users can insert own reminders" ON public.task_reminders FOR INSERT
      WITH CHECK ( user_id = auth.uid() );
  END IF;

  -- Users can update their own unsent reminders (optional, useful for edits)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_reminders' AND policyname='Users can update own unsent reminders'
  ) THEN
    CREATE POLICY "Users can update own unsent reminders" ON public.task_reminders FOR UPDATE
      USING ( user_id = auth.uid() AND sent = false )
      WITH CHECK ( user_id = auth.uid() );
  END IF;

  -- Users can delete their own unsent reminders (optional cleanup)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_reminders' AND policyname='Users can delete own unsent reminders'
  ) THEN
    CREATE POLICY "Users can delete own unsent reminders" ON public.task_reminders FOR DELETE
      USING ( user_id = auth.uid() AND sent = false );
  END IF;
END $$;

-- Quick check: expect 3-4 policies including service_role policies if present
SELECT tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE tablename='task_reminders' ORDER BY policyname;

-- Ensure clients can call helper RPCs if they exist (safe if already granted)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'count_pending_task_reminders' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.count_pending_task_reminders() FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.count_pending_task_reminders() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.count_pending_task_reminders() TO service_role';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'send_task_reminders' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.send_task_reminders() FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.send_task_reminders() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.send_task_reminders() TO service_role';
  END IF;
END $$;

-- Show the 3 critical defaults to verify schema is friendly to inserts
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='task_reminders'
  AND column_name IN ('type','scheduled_at','sent')
ORDER BY column_name;
