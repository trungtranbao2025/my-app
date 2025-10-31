-- Wire up task reminders: triggers, overdue scheduling, and grants
-- Safe to run multiple times (DROP/CREATE idempotent where possible)

-- 1) Recreate create_task_reminders() to also schedule overdue reminders per settings
CREATE OR REPLACE FUNCTION public.create_task_reminders()
RETURNS TRIGGER AS $$
DECLARE
  setting RECORD;
  reminder_config JSONB;
  before_due_hours INTEGER[];
  overdue_hours INTEGER[];
  hour_val INTEGER;
BEGIN
  -- Remove unsent reminders for this task so we can re-generate
  DELETE FROM public.task_reminders 
  WHERE task_id = NEW.id AND sent = false;

    -- Pick the most relevant reminder setting
    SELECT * INTO setting
    FROM public.reminder_settings
    WHERE is_active = true
      AND (priority IS NULL OR priority = NEW.priority)
      AND (status IS NULL OR status = NEW.status)
      AND (task_type IS NULL OR task_type = NEW.task_type)
    ORDER BY 
      (CASE WHEN priority = NEW.priority THEN 1 ELSE 0 END) +
      (CASE WHEN status = NEW.status THEN 1 ELSE 0 END) +
      (CASE WHEN task_type = NEW.task_type THEN 1 ELSE 0 END) DESC
    LIMIT 1;

    IF setting IS NULL THEN
      reminder_config := '{"before_due_hours": [24], "overdue_hours": [24]}'::jsonb;
    ELSE
      reminder_config := setting.reminder_config;
    END IF;

    -- Before due reminders
    IF NEW.due_date IS NOT NULL AND reminder_config ? 'before_due_hours' THEN
      before_due_hours := ARRAY(SELECT jsonb_array_elements_text(reminder_config->'before_due_hours')::INTEGER);
      FOREACH hour_val IN ARRAY before_due_hours LOOP
        INSERT INTO public.task_reminders (task_id, type, scheduled_at, message)
        VALUES (
          NEW.id,
          'scheduled_time',
          (NEW.due_date::TIMESTAMP - (hour_val || ' hours')::INTERVAL)::TIMESTAMPTZ,
          'Nhắc việc: ' || COALESCE(NEW.title, '')
        );
      END LOOP;
    END IF;

    -- On due reminder (same-day)
    IF NEW.due_date IS NOT NULL THEN
      INSERT INTO public.task_reminders (task_id, type, scheduled_at, message)
      VALUES (
        NEW.id,
        'scheduled_time',
        NEW.due_date::TIMESTAMPTZ,
        'Nhắc việc: ' || COALESCE(NEW.title, '')
      );
    END IF;

    -- Overdue repeats (e.g., 1h, 6h, 24h after due)
    IF NEW.due_date IS NOT NULL AND reminder_config ? 'overdue_hours' THEN
      overdue_hours := ARRAY(SELECT jsonb_array_elements_text(reminder_config->'overdue_hours')::INTEGER);
      FOREACH hour_val IN ARRAY overdue_hours LOOP
        INSERT INTO public.task_reminders (task_id, type, scheduled_at, message)
        VALUES (
          NEW.id,
          'scheduled_time',
          (NEW.due_date::TIMESTAMP + (hour_val || ' hours')::INTERVAL)::TIMESTAMPTZ,
          'Nhắc việc: ' || COALESCE(NEW.title, '')
        );
      END LOOP;
    END IF;

    -- Recurring tasks: pre-reminder one day before next occurrence
    IF NEW.task_type = 'recurring' AND NEW.next_recurrence_date IS NOT NULL THEN
      INSERT INTO public.task_reminders (task_id, type, scheduled_at, message)
      VALUES (
        NEW.id,
        'scheduled_time',
        (NEW.next_recurrence_date - INTERVAL '1 day')::TIMESTAMPTZ,
        'Nhắc việc: ' || COALESCE(NEW.title, '')
      );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Triggers to generate reminders on task insert/update
DROP TRIGGER IF EXISTS trigger_create_task_reminders ON public.tasks;
CREATE TRIGGER trigger_create_task_reminders
AFTER INSERT OR UPDATE OF due_date, status, assigned_to, task_type, recurrence_frequency, recurrence_interval, recurrence_weekday, recurrence_month_day, recurrence_quarter, recurrence_quarter_month_index, recurrence_end_date
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.create_task_reminders();

-- 3) Enforce PDF-before-completion and finalize recurring completion
DROP TRIGGER IF EXISTS trigger_enforce_pdf_before_completion ON public.tasks;
CREATE TRIGGER trigger_enforce_pdf_before_completion
BEFORE UPDATE OF is_completed, status
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_pdf_before_completion();

DROP TRIGGER IF EXISTS trigger_complete_recurring_finalize ON public.tasks;
CREATE TRIGGER trigger_complete_recurring_finalize
AFTER UPDATE OF is_completed, status
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.complete_recurring_task_finalize();

-- 4) Allow app to call reminder senders (until pg_cron/Edge Scheduler is set up)
REVOKE ALL ON FUNCTION public.send_task_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_task_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_task_reminders() TO service_role;

REVOKE ALL ON FUNCTION public.auto_create_recurring_task() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_create_recurring_task() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_create_recurring_task() TO service_role;

-- Optional: a tiny RPC helper returning number of reminders pending (debug/monitoring)
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
