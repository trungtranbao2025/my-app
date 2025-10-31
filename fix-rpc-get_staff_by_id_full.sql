-- One-shot: Create get_staff_by_id_full to fetch a single staff with manager-level visibility
-- Usage: Open a NEW SQL tab in Supabase, paste this file ONLY, and run.
-- Safe to re-run.

DROP FUNCTION IF EXISTS public.get_staff_by_id_full(uuid);

CREATE OR REPLACE FUNCTION public.get_staff_by_id_full(p_user_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH u AS (
    SELECT * FROM public.profiles WHERE id = p_user_id
  ), enriched AS (
    SELECT jsonb_build_object(
      'id', u.id,
      'full_name', u.full_name,
      'email', u.email,
      'phone', u.phone,
      'role', u.role,
      'is_active', u.is_active,
      'birthday', u.birthday,
      'join_date', u.join_date,
      'project_members', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', pm.id,
            'role_in_project', pm.role_in_project,
            'position_in_project', pm.position_in_project,
            'system_role_in_project', pm.system_role_in_project,
            'project', (
              SELECT jsonb_build_object(
                'id', pr.id,
                'code', pr.code,
                'name', pr.name,
                'status', pr.status::text
              )
              FROM public.projects pr
              WHERE pr.id = pm.project_id
            )
          )
        )
        FROM public.project_members pm
        WHERE pm.user_id = u.id
      ), '[]'::jsonb)
    ) AS row
    FROM u
  )
  SELECT row INTO result FROM enriched;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_by_id_full(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_staff_by_id_full(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_by_id_full(uuid) TO service_role;

COMMENT ON FUNCTION public.get_staff_by_id_full(uuid) IS 'Returns a single staff JSONB with full project memberships (manager-level visibility).';
