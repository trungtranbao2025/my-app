-- One-shot: Recreate list_staff to restrict nested project memberships for non-managers
-- Usage: Open a NEW SQL tab in Supabase, paste this file ONLY, and run.
-- Safe to re-run.

DROP FUNCTION IF EXISTS public.list_staff();

CREATE OR REPLACE FUNCTION public.list_staff()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  result jsonb;
BEGIN
  -- Yêu cầu: Mọi nhân sự và quản trị viên trên trang Nhân sự đều xem như Manager
  -- => Trả về toàn bộ người dùng và toàn bộ memberships của họ.
  WITH visible_users AS (
    SELECT u.*
    FROM public.profiles u
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
    FROM visible_users u
  )
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO result FROM enriched;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_staff() FROM public;
GRANT EXECUTE ON FUNCTION public.list_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_staff() TO service_role;

COMMENT ON FUNCTION public.list_staff() IS 'Returns JSONB array of ALL staff with full project_members (manager-level visibility) for use on Staff page';
