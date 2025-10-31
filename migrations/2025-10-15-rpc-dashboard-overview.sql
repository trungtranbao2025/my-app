-- Migration: dashboard_overview RPC and fix list_task_proposals SECURITY DEFINER
-- Purpose: Eliminate multiple direct REST queries on dashboard (projects, tasks, overdue) causing RLS recursion / 500s.
-- Also reapply list_task_proposals as SECURITY DEFINER (screenshot showed false) to ensure consistent access via auth.uid().

-- Recreate list_task_proposals with SECURITY DEFINER (idempotent)
DROP FUNCTION IF EXISTS public.list_task_proposals(uuid, text);
CREATE OR REPLACE FUNCTION public.list_task_proposals(
  p_project_id uuid DEFAULT NULL,
  p_mode text DEFAULT 'all'
)
RETURNS TABLE(
  id uuid,
  task_id uuid,
  project_id uuid,
  status text,
  proposed_action text,
  proposed_changes jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  approved_at timestamptz,
  proposed_by_user jsonb,
  proposed_assignee_user jsonb,
  approver_user jsonb
) SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT auth.uid() INTO v_uid;
  RETURN QUERY
  WITH base AS (
    SELECT 
      tp.id,
      NULL::uuid AS task_id,
      tp.project_id,
      tp.status::text AS status,
      NULL::text AS proposed_action,
      NULL::jsonb AS proposed_changes,
      tp.created_at,
      tp.updated_at,
      tp.approved_at,
      NULL::jsonb AS proposed_by_user,
      (SELECT to_jsonb(pa) - 'password' - 'raw_app_meta_data' FROM public.profiles pa WHERE pa.id = tp.proposed_assignee) AS proposed_assignee_user,
      (SELECT to_jsonb(ap) - 'password' - 'raw_app_meta_data' FROM public.profiles ap WHERE ap.id = tp.approver_id) AS approver_user
    FROM public.task_proposals tp
    WHERE (
      p_mode = 'all'
      OR (p_mode = 'by_project' AND tp.project_id = p_project_id)
      OR (p_mode = 'pending_for_approval' AND tp.status = 'pending' AND tp.approver_id = v_uid)
    )
    AND (p_project_id IS NULL OR tp.project_id = p_project_id OR p_mode <> 'by_project')
  )
  SELECT * FROM base ORDER BY created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_task_proposals(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.list_task_proposals(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_task_proposals(uuid, text) TO service_role;
COMMENT ON FUNCTION public.list_task_proposals(uuid, text) IS 'List task proposals with lightweight user JSON; SECURITY DEFINER.';

-- New RPC: dashboard_overview
-- Returns JSONB with aggregate counts and top overdue tasks (first 5) + status distributions
DROP FUNCTION IF EXISTS public.dashboard_overview();
CREATE OR REPLACE FUNCTION public.dashboard_overview()
RETURNS JSONB SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_uid uuid;
  v_is_manager boolean;
  v_json jsonb;
BEGIN
  SELECT auth.uid() INTO v_uid;
  -- Check global role
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role IN ('manager','admin')) INTO v_is_manager;

  -- Visible projects condition
  -- Manager/admin: all projects; else projects where user is member
  WITH visible_projects AS (
    SELECT pr.*
    FROM public.projects pr
    WHERE (
      v_is_manager
      OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = pr.id AND pm.user_id = v_uid)
    )
  ), task_scope AS (
    SELECT t.*
    FROM public.tasks t
    WHERE EXISTS (
      SELECT 1 FROM visible_projects vp WHERE vp.id = t.project_id
    )
  ), agg AS (
    SELECT 
      (SELECT count(*)::int FROM visible_projects) AS project_total,
      (SELECT count(*)::int FROM visible_projects WHERE status = 'completed') AS project_completed,
      (SELECT count(*)::int FROM task_scope) AS task_total,
      (SELECT count(*)::int FROM task_scope WHERE status = 'overdue') AS task_overdue,
      (SELECT count(*)::int FROM task_scope WHERE status = 'completed') AS task_completed
  ), project_status_dist AS (
    SELECT status::text, count(*)::int AS cnt FROM visible_projects GROUP BY status
  ), task_status_dist AS (
    SELECT status::text, count(*)::int AS cnt FROM task_scope GROUP BY status
  ), overdue_list AS (
    SELECT id, title, due_date, project_id, status, progress_percent
    FROM task_scope
    WHERE status = 'overdue'
    ORDER BY due_date ASC NULLS LAST
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'projects', jsonb_build_object(
      'total', project_total,
      'completed', project_completed
    ),
    'tasks', jsonb_build_object(
      'total', task_total,
      'completed', task_completed,
      'overdue', task_overdue
    ),
    'project_status_distribution', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'count', cnt)) FROM project_status_dist), '[]'::jsonb),
    'task_status_distribution', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'count', cnt)) FROM task_status_dist), '[]'::jsonb),
    'overdue_tasks', COALESCE((SELECT jsonb_agg(to_jsonb(o)) FROM overdue_list o), '[]'::jsonb)
  ) INTO v_json FROM agg;

  RETURN v_json;
END;
$$;
REVOKE ALL ON FUNCTION public.dashboard_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.dashboard_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_overview() TO service_role;
COMMENT ON FUNCTION public.dashboard_overview() IS 'Aggregated dashboard stats (projects/tasks/status distributions, overdue tasks) with visibility filtering.';
