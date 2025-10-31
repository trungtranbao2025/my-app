-- Migration: Add missing columns + RLS policies for project_members (insert/update/delete)
-- Date: 2025-10-06
-- Purpose: Allow managers / project admins to add staff to projects

BEGIN;

-- 1. Add new columns if not existing
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS position_in_project TEXT,
  ADD COLUMN IF NOT EXISTS system_role_in_project TEXT DEFAULT 'user';

-- 2. Constrain system_role_in_project values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name='project_members' AND constraint_name='project_members_system_role_in_project_check'
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_system_role_in_project_check
      CHECK (system_role_in_project IN ('user','admin','manager'));
  END IF;
END$$;

-- 3. Drop old CRUD policies if any
DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
DROP POLICY IF EXISTS "project_members_update" ON public.project_members;
DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;
DROP POLICY IF EXISTS "Managers can modify project members" ON public.project_members;

-- 4. Insert policy (simplified to avoid infinite recursion)
CREATE POLICY "project_members_insert" ON public.project_members
FOR INSERT
WITH CHECK (
  -- Global managers can add anyone
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager') OR
  -- Project owner can add members
  EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = project_id AND pr.manager_id = auth.uid())
);

-- 5. Update policy (simplified to avoid infinite recursion)
CREATE POLICY "project_members_update" ON public.project_members
FOR UPDATE USING (
  -- Global managers can update
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager') OR
  -- Project owner can update members
  EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = project_id AND pr.manager_id = auth.uid())
) WITH CHECK (
  -- Same condition for new values
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager') OR
  EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = project_id AND pr.manager_id = auth.uid())
);

-- 6. Delete policy (simplified to avoid infinite recursion)
CREATE POLICY "project_members_delete" ON public.project_members
FOR DELETE USING (
  -- Global managers can delete
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager') OR
  -- Project owner can delete members
  EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = project_id AND pr.manager_id = auth.uid())
);

COMMIT;

-- Verify
SELECT policyname, cmd FROM pg_policies WHERE tablename='project_members' ORDER BY policyname;
