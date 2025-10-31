-- Backfill reminders for existing tasks by touching rows to fire trigger
CREATE OR REPLACE FUNCTION public.rebuild_task_reminders_all(p_limit INTEGER DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  t RECORD;
  processed INT := 0;
BEGIN
  FOR t IN
    SELECT id FROM public.tasks
    WHERE (is_completed = false AND status <> 'completed')
      AND due_date IS NOT NULL
    ORDER BY due_date ASC
    LIMIT COALESCE(p_limit, 10000)
  LOOP
    -- Fire trigger by no-op update
    UPDATE public.tasks SET due_date = due_date WHERE id = t.id;
    processed := processed + 1;
  END LOOP;
  RETURN processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.rebuild_task_reminders_all(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_task_reminders_all(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_task_reminders_all(INTEGER) TO service_role;
