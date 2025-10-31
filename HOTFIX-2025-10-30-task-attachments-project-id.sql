-- HOTFIX: Add project_id to task_attachments and keep it in sync with tasks
-- Safe to run multiple times

begin;

DO $$
BEGIN
  -- Add column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='task_attachments' AND column_name='project_id'
  ) THEN
    ALTER TABLE public.task_attachments ADD COLUMN project_id uuid;
  END IF;

  -- Backfill from tasks
  UPDATE public.task_attachments a
  SET project_id = t.project_id
  FROM public.tasks t
  WHERE a.task_id = t.id AND (a.project_id IS NULL OR a.project_id <> t.project_id);

  -- Add FK if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='task_attachments' AND constraint_name='task_attachments_project_id_fkey'
  ) THEN
    ALTER TABLE public.task_attachments
    ADD CONSTRAINT task_attachments_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;

  -- Upsert sync trigger so project_id auto-populates from tasks
  CREATE OR REPLACE FUNCTION public._sync_task_attachment_project_id()
  RETURNS trigger LANGUAGE plpgsql AS $fn$
  BEGIN
    IF NEW.project_id IS NULL THEN
      SELECT project_id INTO NEW.project_id FROM public.tasks WHERE id = NEW.task_id;
    END IF;
    RETURN NEW;
  END;
  $fn$;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_task_attachment_project_id' AND tgrelid = 'public.task_attachments'::regclass
  ) THEN
    CREATE TRIGGER trg_sync_task_attachment_project_id
      BEFORE INSERT OR UPDATE OF task_id, project_id ON public.task_attachments
      FOR EACH ROW EXECUTE FUNCTION public._sync_task_attachment_project_id();
  END IF;
END $$;

commit;
