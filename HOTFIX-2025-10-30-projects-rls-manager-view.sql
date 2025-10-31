-- Ensure managers/admins can SELECT all projects; others restricted to membership or being manager of the project
DO $$ BEGIN
  -- Enable RLS if not already
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'projects'
  ) THEN
    RAISE NOTICE 'Table public.projects not found - skip';
  ELSE
    -- Run DDL directly inside DO block; no EXECUTE/dollar-quote nesting needed
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

    -- Create or replace permissive SELECT policy
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_select_manager_or_member'
    ) THEN
      CREATE POLICY projects_select_manager_or_member ON public.projects
      FOR SELECT TO authenticated
      USING (
        -- Global roles can read all
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
        )
        OR manager_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = id AND pm.user_id = auth.uid()
        )
      );
    END IF;
  END IF;
END $$;
