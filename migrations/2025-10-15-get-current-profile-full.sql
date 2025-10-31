-- Migration: get_current_profile_full RPC
-- Purpose: Safely fetch current user's profile + project memberships without triggering recursive RLS
-- Date: 2025-10-15

BEGIN;

-- 1. Drop old function if exists
DROP FUNCTION IF EXISTS public.get_current_profile_full();

-- 2. Create function
CREATE OR REPLACE FUNCTION public.get_current_profile_full()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_memberships jsonb := '[]'::jsonb;
BEGIN
  -- Base profile restricted to current user
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','profile_not_found');
  END IF;

  -- Collect memberships for current user only (prevents broad scans)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', pm.id,
        'role_in_project', pm.role_in_project,
        'position_in_project', pm.position_in_project,
        'system_role_in_project', pm.system_role_in_project,
        'project', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'code', p.code,
          'status', p.status
        )
      )
    ), '[]'::jsonb)
  INTO v_memberships
  FROM public.project_members pm
  JOIN public.projects p ON p.id = pm.project_id
  WHERE pm.user_id = auth.uid();

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'role', v_profile.role,
    'is_active', v_profile.is_active,
    'phone', v_profile.phone,
    'birthday', v_profile.birthday,
    'join_date', v_profile.join_date,
    'project_members', v_memberships
  );
END;
$$;

-- 3. Ownership / permissions
REVOKE ALL ON FUNCTION public.get_current_profile_full() FROM public;
GRANT EXECUTE ON FUNCTION public.get_current_profile_full() TO authenticated;

COMMIT;

-- To test after deploy (Supabase SQL Editor):
-- select public.get_current_profile_full();
