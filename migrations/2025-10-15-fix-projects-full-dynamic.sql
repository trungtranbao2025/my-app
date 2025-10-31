-- Migration: Dynamic safe redefinition of list_projects_full
-- Purpose: Avoid 400 errors when some newer project columns are not yet present in live DB
-- This function inspects information_schema and builds a SELECT with NULL fallbacks for missing columns.
-- Apply this AFTER earlier list_projects_full migrations.

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
DECLARE
  has_duration_days boolean;
  has_total_days boolean;
  has_extension_count boolean;
  has_extension_date boolean;
  has_progress_percent boolean;
  sql text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='duration_days') INTO has_duration_days;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='total_days') INTO has_total_days;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='extension_count') INTO has_extension_count;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='extension_date') INTO has_extension_date;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='progress_percent') INTO has_progress_percent;

  sql := 'SELECT '||
    'pr.id, '||
    'pr.code, '||
    'pr.name, '||
    'pr.description, '||
    'pr.location, '||
    'pr.start_date, '||
    'pr.end_date, '||
    'pr.duration_months, '||
    CASE WHEN has_duration_days THEN 'pr.duration_days as duration_days, ' ELSE 'NULL::int AS duration_days, ' END ||
    CASE WHEN has_total_days THEN 'pr.total_days as total_days, ' ELSE 'NULL::int AS total_days, ' END ||
    'pr.contract_number, '||
    'pr.status::text AS status, '||
    'pr.budget, '||
    CASE WHEN has_extension_count THEN 'pr.extension_count as extension_count, ' ELSE 'NULL::int AS extension_count, ' END ||
    CASE WHEN has_extension_date THEN 'pr.extension_date as extension_date, ' ELSE 'NULL::date AS extension_date, ' END ||
    CASE WHEN has_progress_percent THEN 'pr.progress_percent::numeric as progress_percent, ' ELSE 'NULL::numeric AS progress_percent, ' END ||
    '(SELECT to_jsonb(mgr) - ''password'' - ''raw_app_meta_data'' FROM public.profiles mgr WHERE mgr.id = pr.manager_id) AS manager, '||
    '(SELECT count(*)::int FROM public.project_members pm WHERE pm.project_id = pr.id) AS member_count, '||
    '(SELECT count(*)::int FROM public.tasks t WHERE t.project_id = pr.id AND t.status <> ''completed'') AS active_task_count, '||
    '(SELECT count(*)::int FROM public.tasks t WHERE t.project_id = pr.id AND t.status = ''completed'') AS completed_task_count, '||
    'pr.created_at '||
    'FROM public.projects pr '||
    'WHERE ( '||
      'EXISTS (SELECT 1 FROM public.project_members pm2 WHERE pm2.project_id = pr.id AND pm2.user_id = auth.uid()) '||
      'OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''manager'',''admin'')) '||
    ') '||
    'ORDER BY pr.created_at DESC';

  RETURN QUERY EXECUTE sql;
END;
$$;

REVOKE ALL ON FUNCTION public.list_projects_full() FROM public;
GRANT EXECUTE ON FUNCTION public.list_projects_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_projects_full() TO service_role;

COMMENT ON FUNCTION public.list_projects_full() IS 'Full project info with dynamic column presence detection; missing columns returned as NULLs.';
