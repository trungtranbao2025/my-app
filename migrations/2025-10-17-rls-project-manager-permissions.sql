-- Migration: Allow project-level managers to manage project_members
-- This adds helper SECURITY DEFINER functions and updates RLS policies

-- Helper: is_admin_or_manager (global)
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(u uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = u AND p.role IN ('admin','manager')
  );
$$;

-- Helper: is_member_of_project
CREATE OR REPLACE FUNCTION public.is_member_of_project(u uuid, pid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = u AND pm.project_id = pid
  );
$$;

-- Helper: is_project_manager (per-project manager role)
-- Uses column system_role_in_project to identify per-project manager/admin
CREATE OR REPLACE FUNCTION public.is_project_manager(u uuid, pid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = u
      AND pm.project_id = pid
      AND pm.system_role_in_project IN ('manager','admin','project_manager')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_manager(uuid) FROM public;
REVOKE ALL ON FUNCTION public.is_member_of_project(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.is_project_manager(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_member_of_project(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_manager(uuid, uuid) TO authenticated, service_role;

-- Recreate RLS policies on project_members to include project-level managers
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_members', r.policyname);
  END LOOP;
END$$;

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- SELECT visible to project members and global managers
CREATE POLICY project_members_select_visible ON public.project_members
FOR SELECT USING (
  public.is_admin_or_manager(auth.uid())
  OR public.is_member_of_project(auth.uid(), project_members.project_id)
);

-- INSERT allowed for global admin/manager or project-level manager of that project
CREATE POLICY project_members_insert_manage ON public.project_members
FOR INSERT WITH CHECK (
  public.is_admin_or_manager(auth.uid())
  OR public.is_project_manager(auth.uid(), project_members.project_id)
);

-- UPDATE allowed similarly
CREATE POLICY project_members_update_manage ON public.project_members
FOR UPDATE USING (
  public.is_admin_or_manager(auth.uid())
  OR public.is_project_manager(auth.uid(), project_members.project_id)
)
WITH CHECK (
  public.is_admin_or_manager(auth.uid())
  OR public.is_project_manager(auth.uid(), project_members.project_id)
);

-- DELETE allowed similarly
CREATE POLICY project_members_delete_manage ON public.project_members
FOR DELETE USING (
  public.is_admin_or_manager(auth.uid())
  OR public.is_project_manager(auth.uid(), project_members.project_id)
);

COMMENT ON POLICY project_members_select_visible ON public.project_members IS 'Members can see their project memberships; managers/admin see all';
COMMENT ON POLICY project_members_insert_manage ON public.project_members IS 'Global or per-project managers can add members';
COMMENT ON POLICY project_members_update_manage ON public.project_members IS 'Global or per-project managers can update members';
COMMENT ON POLICY project_members_delete_manage ON public.project_members IS 'Global or per-project managers can remove members';
