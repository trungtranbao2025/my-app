-- Broaden UPDATE policy for project_documents: allow all project members to edit metadata
-- Safe change: UPDATE only; keeps SELECT/INSERT/DELETE as-is.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='project_documents' AND policyname='project_docs_update'
  ) THEN
    DROP POLICY project_docs_update ON public.project_documents;
  END IF;

  CREATE POLICY project_docs_update ON public.project_documents
    FOR UPDATE
    USING (
      -- Uploader can update their own document
      uploaded_by = auth.uid()
      OR -- Project manager of the document's project
      EXISTS (
        SELECT 1 FROM public.projects pr
        WHERE pr.id = project_documents.project_id
          AND pr.manager_id = auth.uid()
      )
      OR -- Global manager/admin
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
      )
      OR -- Any regular member of the project
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_documents.project_id
          AND pm.user_id = auth.uid()
      )
    )
    WITH CHECK (true); -- allow changing all updatable columns
END $$;

-- Force PostgREST to reload schema cache
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
