-- Multi-assignees for tasks: schema + RLS + notifications
-- Run in Supabase SQL Editor. Idempotent.

BEGIN;

-- Table: task_assignees (many-to-many task <-> profiles)
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_in_task TEXT DEFAULT 'assignee', -- optional semantic role
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON public.task_assignees(user_id);

-- Enable RLS
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Policies: view if you are in assignees OR task.assigned_to OR project member OR global manager/admin
DROP POLICY IF EXISTS task_assignees_select ON public.task_assignees;
CREATE POLICY task_assignees_select ON public.task_assignees
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_assignees.task_id AND t.assigned_to = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.project_members pm ON pm.project_id = t.project_id
    WHERE t.id = task_assignees.task_id AND pm.user_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
);

-- Insert/delete: project managers/admin or global manager/admin
DROP POLICY IF EXISTS task_assignees_insert ON public.task_assignees;
CREATE POLICY task_assignees_insert ON public.task_assignees
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.project_members pm ON pm.project_id = t.project_id
    WHERE t.id = task_assignees.task_id
      AND pm.user_id = auth.uid()
      AND pm.system_role_in_project IN ('manager','admin')
  )
);

DROP POLICY IF EXISTS task_assignees_delete ON public.task_assignees;
CREATE POLICY task_assignees_delete ON public.task_assignees
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
  OR EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.project_members pm ON pm.project_id = t.project_id
    WHERE t.id = task_assignees.task_id
      AND pm.user_id = auth.uid()
      AND pm.system_role_in_project IN ('manager','admin')
  )
);

-- Notify assignee when added
CREATE OR REPLACE FUNCTION public.notify_task_assignee_added()
RETURNS TRIGGER AS $$
DECLARE
  t_rec RECORD;
BEGIN
  SELECT title INTO t_rec FROM public.tasks WHERE id = NEW.task_id;
  INSERT INTO public.notifications (user_id, title, message, type, is_read)
  VALUES (
    NEW.user_id,
    'Bạn được giao vào công việc',
    'Công việc: ' || COALESCE(t_rec.title,'(không tên)'),
    'task',
    false
  );
  RETURN NEW;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_assignee_added ON public.task_assignees;
CREATE TRIGGER trg_task_assignee_added
AFTER INSERT ON public.task_assignees
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignee_added();

COMMIT;
