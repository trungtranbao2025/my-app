-- Safe variant with tagged dollar-quoting to avoid editor selection issues
DROP FUNCTION IF EXISTS public.list_projects_full();
DROP FUNCTION IF EXISTS public.list_projects_basic();

CREATE OR REPLACE FUNCTION public.list_projects_full()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $FP_FULL$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    FROM (
      SELECT
        pr.id,
        pr.code,
        pr.name,
        pr.description,
        pr.location,
        pr.status,
        pr.start_date,
        pr.end_date,
        pr.total_days,
        pr.duration_months,
        pr.contract_number,
        pr.budget,
        pr.extension_count,
        pr.extension_date,
        pr.created_at,
        (SELECT jsonb_build_object('id', m.id, 'full_name', m.full_name, 'email', m.email)
         FROM public.profiles m WHERE m.id = pr.manager_id) AS manager
      FROM public.projects pr
      WHERE (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
        OR pr.manager_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = pr.id AND pm.user_id = auth.uid())
      )
      ORDER BY pr.created_at DESC
    ) t
  );
END;
$FP_FULL$;

REVOKE ALL ON FUNCTION public.list_projects_full() FROM public;
GRANT EXECUTE ON FUNCTION public.list_projects_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_projects_full() TO service_role;

CREATE OR REPLACE FUNCTION public.list_projects_basic()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $FP_BASIC$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    FROM (
      SELECT
        pr.id,
        pr.code,
        pr.name,
        pr.status,
        pr.start_date,
        pr.end_date,
        pr.created_at
      FROM public.projects pr
      WHERE (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
        OR pr.manager_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = pr.id AND pm.user_id = auth.uid())
      )
      ORDER BY pr.created_at DESC
    ) t
  );
END;
$FP_BASIC$;

REVOKE ALL ON FUNCTION public.list_projects_basic() FROM public;
GRANT EXECUTE ON FUNCTION public.list_projects_basic() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_projects_basic() TO service_role;
