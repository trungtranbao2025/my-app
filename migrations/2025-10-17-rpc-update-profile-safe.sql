-- Migration: update_profile_safe RPC
-- Purpose: Allow self, global admin/manager, or project-level managers to update safe profile fields without triggering RLS recursion

DROP FUNCTION IF EXISTS public.update_profile_safe(uuid, text, text, boolean, date, date, text);

CREATE OR REPLACE FUNCTION public.update_profile_safe(
  p_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_join_date date DEFAULT NULL,
  p_birthday date DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.is_admin_or_manager(v_uid);
  v_allowed boolean := false;
  v_row public.profiles;
BEGIN
  -- Permission: self or global admin/manager or project-level manager of any project the target belongs to
  IF v_uid = p_user_id OR v_is_admin THEN
    v_allowed := true;
  ELSE
    v_allowed := EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.user_id = p_user_id
        AND public.is_project_manager(v_uid, pm.project_id)
    );
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  -- Build update, only setting provided fields; email only by admin
  UPDATE public.profiles pr
  SET 
    full_name = COALESCE(p_full_name, pr.full_name),
    phone = COALESCE(p_phone, pr.phone),
    is_active = COALESCE(p_is_active, pr.is_active),
    join_date = COALESCE(p_join_date, pr.join_date),
    birthday = COALESCE(p_birthday, pr.birthday),
    email = CASE WHEN v_is_admin AND p_email IS NOT NULL THEN p_email ELSE pr.email END
  WHERE pr.id = p_user_id
  RETURNING pr.* INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_profile_safe(uuid, text, text, boolean, date, date, text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_profile_safe(uuid, text, text, boolean, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_safe(uuid, text, text, boolean, date, date, text) TO service_role;

COMMENT ON FUNCTION public.update_profile_safe(uuid, text, text, boolean, date, date, text) IS 'Safe profile update for self/admin/project managers; email changes allowed only for global admin/manager.';
