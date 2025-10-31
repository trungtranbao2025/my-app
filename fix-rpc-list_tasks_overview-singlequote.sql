-- One-shot: recreate list_tasks_overview using single-quoted function body (no $$ needed)
-- Usage: Open a NEW SQL tab in Supabase, paste this file ONLY, and run.
-- Safe to re-run.

DROP FUNCTION IF EXISTS public.list_tasks_overview();

CREATE OR REPLACE FUNCTION public.list_tasks_overview()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS '
  SELECT jsonb_agg(row_to_json(t)) FROM (
    SELECT
      tk.id,
      tk.title,
      tk.description,
      tk.status,
      tk.priority,
      tk.start_date,
      tk.due_date,
      tk.created_at,
      tk.project_id,
      tk.assigned_to,
      tk.assigned_by,
      tk.task_type,
      tk.recurrence_frequency,
      tk.recurrence_interval,
      tk.recurrence_end_date,
      tk.recurrence_weekday,
      tk.recurrence_month_day,
      tk.recurrence_quarter,
      tk.recurrence_quarter_month_index,
      tk.next_recurrence_date,
      (SELECT jsonb_build_object(''id'', p1.id, ''full_name'', p1.full_name, ''email'', p1.email)
       FROM public.profiles p1 WHERE p1.id = tk.assigned_to) AS assigned_to_user,
      (SELECT jsonb_build_object(''id'', p2.id, ''full_name'', p2.full_name, ''email'', p2.email)
       FROM public.profiles p2 WHERE p2.id = tk.assigned_by) AS assigned_by_user,
      (SELECT jsonb_build_object(''id'', pr.id, ''name'', pr.name, ''code'', pr.code)
       FROM public.projects pr WHERE pr.id = tk.project_id) AS project,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(''id'', p.id, ''full_name'', p.full_name, ''email'', p.email))
        FROM public.task_assignees ta
        JOIN public.profiles p ON p.id = ta.user_id
        WHERE ta.task_id = tk.id
      ), ''[]''::jsonb) AS additional_assignees,
      (SELECT COUNT(*) FROM public.task_assignees ta WHERE ta.task_id = tk.id) AS multi_assignee_count
    FROM public.tasks tk
    WHERE (
      EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tk.project_id AND pm.user_id = auth.uid())
    ) OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''manager'',''admin''))
    )
    ORDER BY tk.created_at DESC
  ) t
';

REVOKE ALL ON FUNCTION public.list_tasks_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.list_tasks_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tasks_overview() TO service_role;

-- Optional smoke test (run separately):
-- SELECT jsonb_array_length(public.list_tasks_overview());
