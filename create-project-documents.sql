-- Project Documents (Meeting Minutes) setup
-- Run in Supabase SQL Editor as postgres

-- 1) Create table public.project_documents (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_documents'
  ) THEN
    CREATE TABLE public.project_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      file_url text NOT NULL,
      file_name text NOT NULL,
      file_size bigint,
      file_type text,
      meeting_date date,
      uploaded_by uuid REFERENCES public.profiles(id),
      created_at timestamp with time zone DEFAULT now()
    );
    
    CREATE INDEX IF NOT EXISTS idx_project_documents_project ON public.project_documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_documents_created ON public.project_documents(created_at DESC);
  END IF;
END $$;

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- Allow project members and managers to view documents
DO $$ BEGIN
  -- Recreate SELECT policy to include project manager and admin roles
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_documents' AND policyname='project_docs_select'
  ) THEN
    DROP POLICY project_docs_select ON public.project_documents;
  END IF;
  CREATE POLICY project_docs_select ON public.project_documents
    FOR SELECT
    USING (
      -- Thành viên dự án
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_documents.project_id
          AND pm.user_id = auth.uid()
      )
      -- Quản lý dự án (manager_id) của dự án
      OR EXISTS (
        SELECT 1 FROM public.projects pr
        WHERE pr.id = project_documents.project_id
          AND pr.manager_id = auth.uid()
      )
      -- Vai trò hệ thống: manager hoặc admin
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
      )
    );

  -- Recreate INSERT policy to allow member, project manager, or admin
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_documents' AND policyname='project_docs_insert'
  ) THEN
    DROP POLICY project_docs_insert ON public.project_documents;
  END IF;
  CREATE POLICY project_docs_insert ON public.project_documents
    FOR INSERT
    WITH CHECK (
      uploaded_by = auth.uid()
      AND (
        -- Thành viên dự án
        EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = project_documents.project_id
            AND pm.user_id = auth.uid()
        )
        -- Quản lý dự án (manager_id)
        OR EXISTS (
          SELECT 1 FROM public.projects pr
          WHERE pr.id = project_documents.project_id
            AND pr.manager_id = auth.uid()
        )
        -- Vai trò hệ thống
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
        )
      )
    );

  -- Recreate DELETE policy to include project manager and admin
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_documents' AND policyname='project_docs_delete'
  ) THEN
    DROP POLICY project_docs_delete ON public.project_documents;
  END IF;
  CREATE POLICY project_docs_delete ON public.project_documents
    FOR DELETE
    USING (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.projects pr
        WHERE pr.id = project_documents.project_id
          AND pr.manager_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
      )
    );
END $$;

-- 3) Create Storage bucket for project documents (public for easy download)
DO $$
DECLARE
  has_name boolean;
  has_public boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='storage' AND table_name='buckets') THEN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'project-docs') THEN
      -- Try using create_bucket first
      IF to_regprocedure('storage.create_bucket(text,text,boolean)') IS NOT NULL THEN
        PERFORM storage.create_bucket('project-docs', 'project-docs', true);
      ELSIF to_regprocedure('storage.create_bucket(text,boolean)') IS NOT NULL THEN
        PERFORM storage.create_bucket('project-docs', true);
      ELSE
        -- Fallback: insert directly
        SELECT EXISTS(
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='storage' AND table_name='buckets' AND column_name='name') INTO has_name;
        SELECT EXISTS(
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='storage' AND table_name='buckets' AND column_name='public') INTO has_public;
        IF has_name AND has_public THEN
          INSERT INTO storage.buckets (id, name, public) VALUES ('project-docs','project-docs', true)
          ON CONFLICT (id) DO NOTHING;
        ELSIF has_name THEN
          INSERT INTO storage.buckets (id, name) VALUES ('project-docs','project-docs')
          ON CONFLICT (id) DO NOTHING;
        ELSIF has_public THEN
          INSERT INTO storage.buckets (id, public) VALUES ('project-docs', true)
          ON CONFLICT (id) DO NOTHING;
        ELSE
          INSERT INTO storage.buckets (id) VALUES ('project-docs')
          ON CONFLICT (id) DO NOTHING;
        END IF;
      END IF;
    END IF;
  END IF;
END $$;

-- 4) Storage policies (allow read; restrict write/delete to auth users)
DO $$ BEGIN
  -- Read policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_docs_read'
  ) THEN
    CREATE POLICY project_docs_read ON storage.objects
      FOR SELECT USING (bucket_id = 'project-docs');
  END IF;

  -- Insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_docs_insert'
  ) THEN
    CREATE POLICY project_docs_insert ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'project-docs');
  END IF;

  -- Update policy (owner only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_docs_update_owner'
  ) THEN
    CREATE POLICY project_docs_update_owner ON storage.objects
      FOR UPDATE USING (bucket_id = 'project-docs' AND owner = auth.uid());
  END IF;

  -- Delete policy (owner only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_docs_delete_owner'
  ) THEN
    CREATE POLICY project_docs_delete_owner ON storage.objects
      FOR DELETE USING (bucket_id = 'project-docs' AND owner = auth.uid());
  END IF;
END $$;

-- Note: The bucket is marked public for straightforward downloads via public URLs.
-- If you want private access, set the bucket to non-public and use signed URLs from the app.

-- 5) Force PostgREST to reload schema cache so the API can see new tables immediately
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
