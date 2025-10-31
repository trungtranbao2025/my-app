-- Fix RLS policies for task_attachments (allow authorized users to insert/select/delete)
-- Run this in Supabase SQL Editor. Safe to run multiple times.

BEGIN;

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (idempotent)
DROP POLICY IF EXISTS task_attachments_select ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_insert ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_delete ON public.task_attachments;
DROP POLICY IF EXISTS task_attachments_update ON public.task_attachments;

-- Common predicate: user is global manager/admin OR project member of the task's project OR assigned user
-- Note: We join via tasks.project_id to check membership rights

-- SELECT: Anyone who can access the task (assigned user, any project member) or global manager/admin can view attachments
CREATE POLICY task_attachments_select ON public.task_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND (
        t.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
        )
      )
  )
);

-- INSERT: The uploader must be the current user AND they must have access to the task (same rules as above)
CREATE POLICY task_attachments_insert ON public.task_attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_attachments.task_id
      AND (
        t.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
        )
      )
  )
);

-- DELETE: Uploader can delete; project manager/admin (per project_members) or global manager/admin can delete
CREATE POLICY task_attachments_delete ON public.task_attachments
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
  OR EXISTS (
    SELECT 1
    FROM public.tasks t
    JOIN public.project_members pm ON pm.project_id = t.project_id
    WHERE t.id = task_attachments.task_id
      AND pm.user_id = auth.uid()
      AND pm.system_role_in_project IN ('manager','admin')
  )
);

-- Optional: UPDATE if needed (restrict to uploader or managers)
CREATE POLICY task_attachments_update ON public.task_attachments
FOR UPDATE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
);

-- Helper: ensure uploaded_by defaults to auth.uid() and created_at is set
CREATE OR REPLACE FUNCTION public.set_task_attachment_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.uploaded_by IS NULL THEN
    NEW.uploaded_by := auth.uid();
  END IF;
  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_attachments_defaults ON public.task_attachments;
CREATE TRIGGER trg_task_attachments_defaults
  BEFORE INSERT ON public.task_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_attachment_defaults();

-- Useful index for lookups by task
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);

COMMIT;

-- Notes:
-- - Storage bucket policies for 'task-reports' are handled in create-task-reports-storage.sql
-- - Frontend should pass uploaded_by = current user (already implemented) and file_type = 'application/pdf'.
-- - This script resolves RLS 42501 when inserting into task_attachments by authorized users.
