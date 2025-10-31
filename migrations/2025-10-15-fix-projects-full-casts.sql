-- Migration: Fix type mismatches in list_projects_full
-- Issue: progress_percent (int) expected numeric; count(*) returns bigint while return signature expects int
-- Fix: Cast progress_percent::numeric and all count(*)::int

DROP FUNCTION IF EXISTS public.list_projects_full();

CREATE OR REPLACE FUNCTION public.list_projects_full()
RETURNS TABLE(
  id uuid,
  code text,
  name text,
  description text,
  location text,
  start_date date,
  end_date date,
  duration_months int,
  duration_days int,
  total_days int,
  contract_number text,
  status text,
  budget numeric,
  extension_count int,
  extension_date date,
  progress_percent numeric,
  manager jsonb,
  member_count int,
  active_task_count int,
  completed_task_count int,
  created_at timestamptz
) SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.code,
    pr.name,
    pr.description,
    pr.location,
    pr.start_date,
    pr.end_date,
    pr.duration_months,
    pr.duration_days,
    pr.total_days,
    pr.contract_number,
    pr.status::text AS status,
    pr.budget,
    pr.extension_count,
    pr.extension_date,
    pr.progress_percent::numeric AS progress_percent,
    (SELECT to_jsonb(mgr) - 'password' - 'raw_app_meta_data' FROM public.profiles mgr WHERE mgr.id = pr.manager_id) AS manager,
    (SELECT count(*)::int FROM public.project_members pm WHERE pm.project_id = pr.id) AS member_count,
    (SELECT count(*)::int FROM public.tasks t WHERE t.project_id = pr.id AND t.status <> 'completed') AS active_task_count,
    (SELECT count(*)::int FROM public.tasks t WHERE t.project_id = pr.id AND t.status = 'completed') AS completed_task_count,
    pr.created_at
  FROM public.projects pr
  WHERE (
    EXISTS (SELECT 1 FROM public.project_members pm2 WHERE pm2.project_id = pr.id AND pm2.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
  )
  ORDER BY pr.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_projects_full() FROM public;
GRANT EXECUTE ON FUNCTION public.list_projects_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_projects_full() TO service_role;

COMMENT ON FUNCTION public.list_projects_full() IS 'Full project info with casts (progress_percent numeric, counts int) and manager JSON';
