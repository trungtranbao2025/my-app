-- Migration: add count_pending_task_proposals RPC & extend list_tasks_overview with multi_assignee_count
-- Date: 2025-10-15

-- Drop existing list_tasks_overview to replace with enhanced version (if exists)
DROP FUNCTION IF EXISTS public.list_tasks_overview();

CREATE OR REPLACE FUNCTION public.list_tasks_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT tk.id,
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
        -- Include task type and recurrence fields so UI can render and edit correctly
        tk.task_type,
        tk.recurrence_frequency,
        tk.recurrence_interval,
        tk.recurrence_end_date,
        tk.recurrence_weekday,
        tk.recurrence_month_day,
        tk.recurrence_quarter,
        tk.recurrence_quarter_month_index,
        tk.next_recurrence_date,
             (SELECT jsonb_build_object('id', p1.id,'full_name',p1.full_name,'email',p1.email)
              FROM public.profiles p1 WHERE p1.id = tk.assigned_to) AS assigned_to_user,
             (SELECT jsonb_build_object('id', p2.id,'full_name',p2.full_name,'email',p2.email)
              FROM public.profiles p2 WHERE p2.id = tk.assigned_by) AS assigned_by_user,
             (SELECT jsonb_build_object('id', pr.id,'name',pr.name,'code',pr.code)
              FROM public.projects pr WHERE pr.id = tk.project_id) AS project,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email))
               FROM public.task_assignees ta
               JOIN public.profiles p ON p.id = ta.user_id
               WHERE ta.task_id = tk.id
             ), '[]'::jsonb) AS additional_assignees,
             (SELECT COUNT(*) FROM public.task_assignees ta WHERE ta.task_id = tk.id) AS multi_assignee_count
      FROM public.tasks tk
      WHERE (
        EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tk.project_id AND pm.user_id = auth.uid())
      ) OR (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
      )
      ORDER BY tk.created_at DESC
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_tasks_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.list_tasks_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tasks_overview() TO service_role;

-- Count pending task proposals for current approver
DROP FUNCTION IF EXISTS public.count_pending_task_proposals();
CREATE OR REPLACE FUNCTION public.count_pending_task_proposals()
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT COUNT(*) FROM public.task_proposals tp
  WHERE tp.approver_id = auth.uid()
    AND tp.status = 'pending';
$$;

REVOKE ALL ON FUNCTION public.count_pending_task_proposals() FROM public;
GRANT EXECUTE ON FUNCTION public.count_pending_task_proposals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_pending_task_proposals() TO service_role;

COMMENT ON FUNCTION public.count_pending_task_proposals() IS 'Returns integer count of pending proposals where current user is approver';
COMMENT ON FUNCTION public.list_tasks_overview() IS 'Tasks overview with assigned users, project basic info, and multi_assignee_count + additional_assignees';
