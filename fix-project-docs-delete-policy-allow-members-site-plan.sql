-- Allow both managers/admins and regular project members to delete
-- site plan documents on the Progress page without being the uploader.
-- Safe change: expands DELETE policy only; SELECT/INSERT remain unchanged.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='project_documents' AND policyname='project_docs_delete'
  ) THEN
    DROP POLICY project_docs_delete ON public.project_documents;
  END IF;

  CREATE POLICY project_docs_delete ON public.project_documents
    FOR DELETE
    USING (
      -- Uploader can always delete their own upload
      uploaded_by = auth.uid()
      OR -- Project manager or global manager/admin can delete any
      EXISTS (
        SELECT 1 FROM public.projects pr
        WHERE pr.id = project_documents.project_id
          AND pr.manager_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
      )
      OR (
        -- Regular project members can delete documents in the Progress page scope
        -- i.e., documents categorized as 'site_plan' in projects they belong to
        project_documents.category = 'site_plan'
        AND EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = project_documents.project_id
            AND pm.user_id = auth.uid()
        )
      )
    );
END $$;

-- Add/replace UPDATE policy so project members can edit Site Plan document metadata
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
      -- Allow when user is uploader
      uploaded_by = auth.uid()
      OR -- Project manager or global manager/admin
      EXISTS (
        SELECT 1 FROM public.projects pr
        WHERE pr.id = project_documents.project_id
          AND pr.manager_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
      )
      OR (
        -- Regular members can update Site Plan docs in their projects
        project_documents.category = 'site_plan'
        AND EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = project_documents.project_id
            AND pm.user_id = auth.uid()
        )
      )
    )
    WITH CHECK (true); -- allow changing all updatable columns
END $$;

-- Notes:
-- - If you want all members to delete any category, remove the category filter above.
-- - Run this file in Supabase SQL (or include in your deploy pipeline) to apply.
