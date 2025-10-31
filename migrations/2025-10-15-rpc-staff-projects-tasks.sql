-- Migration: Add RPCs to avoid recursive RLS on profiles via wide joins
-- Date: 2025-10-15
-- Functions:
--   list_staff() - returns limited user info + memberships
--   list_projects_basic() - returns project with manager (basic)
--   list_tasks_overview() - returns tasks with assigned_to/assigned_by and project basic
-- All SECURITY DEFINER, enforce filtering internally.

BEGIN;

-- Drop existing if re-running
DROP FUNCTION IF EXISTS public.list_staff();
DROP FUNCTION IF EXISTS public.list_projects_basic();
DROP FUNCTION IF EXISTS public.list_tasks_overview();

-- list_staff: respects: global manager/admin -> all; else only users sharing a project
CREATE OR REPLACE FUNCTION public.list_staff()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_global boolean;
BEGIN
  v_is_global := EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('manager','admin')
  );

  RETURN (
    SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT p.id, p.full_name, p.email, p.role, p.is_active,
        (
          SELECT jsonb_agg(jsonb_build_object(
            'id', pm.id,
            'system_role_in_project', pm.system_role_in_project,
            'project', jsonb_build_object('id', pr.id,'name',pr.name,'code',pr.code)
          )) FROM public.project_members pm
          JOIN public.projects pr ON pr.id = pm.project_id
          WHERE pm.user_id = p.id
        ) AS project_members
      FROM public.profiles p
      WHERE v_is_global OR EXISTS (
        SELECT 1 FROM public.project_members m1
        JOIN public.project_members m2 ON m1.project_id = m2.project_id
        WHERE m1.user_id = auth.uid() AND m2.user_id = p.id
      )
      ORDER BY p.full_name
    ) t
  );
END;
$$;

-- list_projects_basic: projects visible to user (membership or global)
CREATE OR REPLACE FUNCTION public.list_projects_basic()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT pr.id, pr.name, pr.code, pr.status, pr.manager_id,
        (SELECT jsonb_build_object('id', mp.id,'full_name', mp.full_name,'email', mp.email)
         FROM public.profiles mp WHERE mp.id = pr.manager_id) AS manager
      FROM public.projects pr
      WHERE EXISTS (
        SELECT 1 FROM public.project_members pm WHERE pm.project_id = pr.id AND pm.user_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
      )
      ORDER BY pr.created_at DESC
    ) t
  );
END;
$$;

-- list_tasks_overview: tasks constrained to user's visible projects (same logic)
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
             tk.due_date,
             tk.created_at,
             tk.project_id,
             tk.assigned_to,
             tk.assigned_by,
             -- Include task type and recurrence columns for UI
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

-- Grants
REVOKE ALL ON FUNCTION public.list_staff() FROM public;
REVOKE ALL ON FUNCTION public.list_projects_basic() FROM public;
REVOKE ALL ON FUNCTION public.list_tasks_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.list_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_projects_basic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tasks_overview() TO authenticated;

COMMIT;
