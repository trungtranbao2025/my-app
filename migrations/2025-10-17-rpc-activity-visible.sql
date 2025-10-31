-- Migration: get_user_activity_visible RPC
-- Purpose: Return activity summary visible to caller (manager/admin sees all; otherwise self + users sharing any project with caller)

DROP FUNCTION IF EXISTS public.get_user_activity_visible();

CREATE OR REPLACE FUNCTION public.get_user_activity_visible()
RETURNS SETOF public.user_activity_summary
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_manager boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.role IN ('manager','admin')) INTO v_is_manager;

  IF v_is_manager THEN
    RETURN QUERY SELECT * FROM public.user_activity_summary;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT uas.*
  FROM public.user_activity_summary uas
  WHERE uas.user_id = v_uid
     OR EXISTS (
       SELECT 1
       FROM public.project_members pm_u
       JOIN public.project_members pm_me ON pm_me.project_id = pm_u.project_id
       WHERE pm_u.user_id = uas.user_id AND pm_me.user_id = v_uid
     );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_activity_visible() FROM public;
GRANT EXECUTE ON FUNCTION public.get_user_activity_visible() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_activity_visible() TO service_role;

COMMENT ON FUNCTION public.get_user_activity_visible() IS 'Activity summary visible to caller based on role and shared projects';
