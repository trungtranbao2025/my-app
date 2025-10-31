-- Setup daily 08:30 reminder rules with push + optional email/SMS for overdue
-- Run in Supabase SQL Editor as postgres or service role. Safe to run multiple times.

-- 0) Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1) User reminder preferences: add opt-ins and timing defaults
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='user_reminder_preferences'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_reminder_preferences' AND column_name='email_overdue_enabled'
    ) THEN
      EXECUTE 'ALTER TABLE public.user_reminder_preferences ADD COLUMN email_overdue_enabled boolean DEFAULT false';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_reminder_preferences' AND column_name='sms_overdue_enabled'
    ) THEN
      EXECUTE 'ALTER TABLE public.user_reminder_preferences ADD COLUMN sms_overdue_enabled boolean DEFAULT false';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_reminder_preferences' AND column_name='push_enabled'
    ) THEN
      EXECUTE 'ALTER TABLE public.user_reminder_preferences ADD COLUMN push_enabled boolean DEFAULT true';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_reminder_preferences' AND column_name='daily_time'
    ) THEN
      EXECUTE ''||
        'ALTER TABLE public.user_reminder_preferences '||
        'ADD COLUMN daily_time text DEFAULT ''08:30''';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='user_reminder_preferences' AND column_name='timezone'
    ) THEN
      EXECUTE ''||
        'ALTER TABLE public.user_reminder_preferences '||
        'ADD COLUMN timezone text DEFAULT ''Asia/Ho_Chi_Minh''';
    END IF;
  END IF;
END $$;

-- 2) Outbox tables for integrations (processed by an Edge Function or external worker)
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|sent|failed
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON public.email_outbox(status, created_at);

CREATE TABLE IF NOT EXISTS public.sms_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  to_phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|sent|failed
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sms_outbox_status ON public.sms_outbox(status, created_at);

COMMENT ON TABLE public.email_outbox IS 'Queue for outgoing emails, to be processed by an external worker';
COMMENT ON TABLE public.sms_outbox IS 'Queue for outgoing SMS, to be processed by an external worker';

-- 2.1) Ensure a uniqueness guard for idempotent enqueue
-- We standardize on a per-user, per-task, per-type-at-timestamp uniqueness so
-- multiple rules hitting the same moment won’t throw errors when using ON CONFLICT.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='task_reminders'
  ) THEN
    -- Create the unique index if it does not exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND indexname='ux_task_reminders_future_once'
    ) THEN
      EXECUTE 'CREATE UNIQUE INDEX ux_task_reminders_future_once ON public.task_reminders(task_id, user_id, type, scheduled_at)';
    END IF;
  END IF;
END $$;

-- 3) Helper: compute today''s local timestamp at user''s preferred daily_time
CREATE OR REPLACE FUNCTION public.user_today_time(user_id uuid, p_time text DEFAULT NULL, p_tz text DEFAULT NULL)
RETURNS timestamptz LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_time text;
  v_tz text;
  v_local_date date;
  v_ts timestamptz;
BEGIN
  -- Read user prefs if present, then apply explicit params and finally hard defaults
  SELECT upr.daily_time, upr.timezone
  INTO v_time, v_tz
  FROM public.user_reminder_preferences upr
  WHERE upr.user_id = user_today_time.user_id
  LIMIT 1;

  v_time := COALESCE(p_time, v_time, '08:30');
  v_tz   := COALESCE(p_tz,   v_tz,   'Asia/Ho_Chi_Minh');

  v_local_date := (now() AT TIME ZONE v_tz)::date;
  -- Build a timestamp at v_time in user's timezone, then convert to timestamptz
  v_ts := ((v_local_date::timestamp + (v_time)::time) AT TIME ZONE v_tz);
  RETURN v_ts;
END;$$;

COMMENT ON FUNCTION public.user_today_time(uuid, text, text) IS 'Returns today 08:30 (or preferred) for the user in their timezone';

-- 4) Schedule 08:30 reminders into task_reminders queue
--    Rules:
--    - One-time tasks (đột xuất): push reminders at 08:30 on start_date (once), due_date (once), and every day at 08:30 when overdue.
--    - Recurring tasks (định kỳ): only every day at 08:30 when overdue.
--    - App push always; email/SMS handled at send-time with opt-in and only for overdue.
CREATE OR REPLACE FUNCTION public.schedule_0830_reminders_today()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  t record;
  uid uuid;
  v_scheduled_at timestamptz;
  use_multi boolean := false;
BEGIN
  -- Detect multi-assignee table existence
  SELECT EXISTS (
    SELECT 1 FROM pg_class WHERE relname='task_assignees' AND relnamespace='public'::regnamespace
  ) INTO use_multi;

  -- One-time: start today
  FOR t IN
    SELECT * FROM public.tasks
    WHERE coalesce(is_completed,false) = false
      AND (status IS DISTINCT FROM 'completed')
      AND (task_type IS NULL OR task_type::text IN ('one_time','regular','urgent'))
      AND start_date = CURRENT_DATE
  LOOP
    -- Main + multi assignees
    FOR uid IN (
      SELECT t.assigned_to AS u_id
      UNION
      SELECT ta.user_id FROM public.task_assignees ta WHERE use_multi AND ta.task_id = t.id
    ) LOOP
      CONTINUE WHEN uid IS NULL;
      v_scheduled_at := public.user_today_time(uid);
      -- Avoid duplicate for same day/message
      IF NOT EXISTS (
        SELECT 1 FROM public.task_reminders r
        WHERE r.task_id = t.id AND r.user_id = uid
          AND r.sent = false
          AND r.scheduled_at::date = v_scheduled_at::date
          AND r.message LIKE 'Công việc "%" bắt đầu hôm nay%'
      ) THEN
        BEGIN
          INSERT INTO public.task_reminders(task_id, user_id, scheduled_at, message, type)
          VALUES (t.id, uid, v_scheduled_at, 'Công việc "' || t.title || '" bắt đầu hôm nay', 'scheduled_time');
        EXCEPTION WHEN unique_violation THEN
          -- Ignore if a uniqueness guard (if present) catches a duplicate
          NULL;
        END;
      END IF;
    END LOOP;
  END LOOP;

  -- One-time: due today (08:30)
  FOR t IN
    SELECT * FROM public.tasks
    WHERE coalesce(is_completed,false) = false
      AND (status IS DISTINCT FROM 'completed')
      AND (task_type IS NULL OR task_type::text IN ('one_time','regular','urgent'))
      AND due_date = CURRENT_DATE
  LOOP
    FOR uid IN (
      SELECT t.assigned_to AS u_id
      UNION
      SELECT ta.user_id FROM public.task_assignees ta WHERE use_multi AND ta.task_id = t.id
    ) LOOP
      CONTINUE WHEN uid IS NULL;
      v_scheduled_at := public.user_today_time(uid);
      IF NOT EXISTS (
        SELECT 1 FROM public.task_reminders r
        WHERE r.task_id = t.id AND r.user_id = uid
          AND r.sent = false
          AND r.scheduled_at::date = v_scheduled_at::date
          AND r.message LIKE 'Công việc "%" đến hạn hôm nay%'
      ) THEN
        BEGIN
          INSERT INTO public.task_reminders(task_id, user_id, scheduled_at, message, type)
          VALUES (t.id, uid, v_scheduled_at, 'Công việc "' || t.title || '" đến hạn hôm nay', 'scheduled_time');
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END IF;
    END LOOP;
  END LOOP;

  -- Overdue daily (both one-time and recurring)
  FOR t IN
    SELECT * FROM public.tasks
    WHERE coalesce(is_completed,false) = false
      AND (status IS DISTINCT FROM 'completed')
      AND due_date IS NOT NULL AND due_date < CURRENT_DATE
  LOOP
    FOR uid IN (
      SELECT t.assigned_to AS u_id
      UNION
      SELECT ta.user_id FROM public.task_assignees ta WHERE use_multi AND ta.task_id = t.id
    ) LOOP
      CONTINUE WHEN uid IS NULL;
      v_scheduled_at := public.user_today_time(uid);
      IF NOT EXISTS (
        SELECT 1 FROM public.task_reminders r
        WHERE r.task_id = t.id AND r.user_id = uid
          AND r.sent = false
          AND r.scheduled_at::date = v_scheduled_at::date
          AND r.message LIKE 'Công việc "%" đã quá hạn%'
      ) THEN
        BEGIN
          INSERT INTO public.task_reminders(task_id, user_id, scheduled_at, message, type)
          VALUES (t.id, uid, v_scheduled_at, 'Công việc "' || t.title || '" đã quá hạn!', 'scheduled_time');
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END IF;
    END LOOP;
  END LOOP;
END;$$;

COMMENT ON FUNCTION public.schedule_0830_reminders_today IS 'Enqueue today''s 08:30 reminders per rules: start/due once for one-time; overdue daily for all';

-- 5) Enhance sender to also mark push and enqueue email/SMS for overdue
CREATE OR REPLACE FUNCTION public.send_pending_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $send_pending$
DECLARE
  reminder record;
  notif_id uuid;
  v_is_overdue boolean;
  v_email_enabled boolean;
  v_sms_enabled boolean;
  v_email text;
  v_phone text;
  v_subject text;
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
    ) RETURNING id INTO notif_id;

    -- Mark push channel used
    UPDATE public.notifications SET sent_via_push = true WHERE id = notif_id;

    -- Overdue escalation via email/SMS only if opted-in
  -- Detect 'quá hạn' robustly (accent and case-insensitive)
  v_is_overdue := reminder.message ILIKE '%quá hạn%';
    IF v_is_overdue THEN
      SELECT coalesce(upr.email_overdue_enabled,false), coalesce(upr.sms_overdue_enabled,false)
      INTO v_email_enabled, v_sms_enabled
      FROM public.user_reminder_preferences upr
      WHERE upr.user_id = reminder.user_id;

      SELECT pr.email, pr.phone INTO v_email, v_phone
      FROM public.profiles pr WHERE pr.id = reminder.user_id;

      v_subject := '[Quá hạn] ' || reminder.task_title || CASE WHEN reminder.project_name IS NOT NULL THEN ' - ' || reminder.project_name ELSE '' END;

      IF v_email_enabled AND v_email IS NOT NULL THEN
        INSERT INTO public.email_outbox(notification_id, to_email, subject, body)
        VALUES (notif_id, v_email, v_subject, reminder.message);
        UPDATE public.notifications SET sent_via_email = true WHERE id = notif_id;
      END IF;

      IF v_sms_enabled AND v_phone IS NOT NULL THEN
        INSERT INTO public.sms_outbox(notification_id, to_phone, message)
        VALUES (notif_id, v_phone, reminder.message);
      END IF;
    END IF;

    UPDATE public.task_reminders
    SET sent = true, sent_at = now(), updated_at = now()
    WHERE id = reminder.reminder_id;
  END LOOP;
END;$send_pending$;

COMMENT ON FUNCTION public.send_pending_reminders IS 'Process pending reminders, create app notifications, and enqueue email/SMS for overdue (opt-in)';

-- 6) Cron jobs (01:30 UTC = 08:30 ICT)
-- Remove old jobs if they exist, then schedule fresh
DO $$ BEGIN
  -- Unschedule only if the job exists; ignore if pg_cron metadata table is absent
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='cron' AND table_name='job'
  ) THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_schedule_0830') THEN
      PERFORM cron.unschedule('daily_schedule_0830');
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_function THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='cron' AND table_name='job'
  ) THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_send_reminders') THEN
      PERFORM cron.unschedule('daily_send_reminders');
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_function THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule('daily_schedule_0830', '30 1 * * *', $$SELECT public.schedule_0830_reminders_today()$$);
SELECT cron.schedule('daily_send_reminders', '31 1 * * *', $$SELECT public.send_pending_reminders()$$);

-- 7) Optional: align global system reminder time to 08:30
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='system_settings'
  ) THEN
    INSERT INTO public.system_settings(key, value, description)
    VALUES ('reminder_time', '"08:30"', 'Daily reminder time')
    ON CONFLICT (key) DO UPDATE SET value = '"08:30"', updated_at = now();
  END IF;
END $$;
