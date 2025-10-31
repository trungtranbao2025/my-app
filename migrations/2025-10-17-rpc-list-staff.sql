-- Migration: list_staff RPC (JSONB)
-- Returns a JSON array of staff with join_date, birthday, is_active, and nested project_members with project info

DROP FUNCTION IF EXISTS public.list_staff();

CREATE OR REPLACE FUNCTION public.list_staff()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_manager boolean;
  result jsonb;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role IN ('manager','admin')) INTO v_is_manager;

  WITH visible_users AS (
    SELECT u.*
    FROM public.profiles u
    WHERE (
      v_is_manager
      OR u.id = v_uid
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm_u
        JOIN public.project_members pm_me ON pm_me.project_id = pm_u.project_id
        WHERE pm_u.user_id = u.id AND pm_me.user_id = v_uid
      )
    )
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
              SELECT jsonb_build_object('id', pr.id, 'code', pr.code, 'name', pr.name, 'status', pr.status::text)
              FROM public.projects pr WHERE pr.id = pm.project_id
            )
          )
        )
        FROM public.project_members pm
        WHERE pm.user_id = u.id
      ), '[]'::jsonb)
    ) AS row
    FROM visible_users u
  )
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO result FROM enriched;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_staff() FROM public;
GRANT EXECUTE ON FUNCTION public.list_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_staff() TO service_role;

COMMENT ON FUNCTION public.list_staff() IS 'Returns JSONB array of visible staff with join_date and nested project_members';
