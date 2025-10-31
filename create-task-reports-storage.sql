DO $$
DECLARE
  has_name boolean;
  has_public boolean;
BEGIN
  -- If bucket already exists, skip
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'task-reports') THEN
    RETURN;
  END IF;

  -- Prefer using storage.create_bucket if available
  IF to_regprocedure('storage.create_bucket(text,text,boolean)') IS NOT NULL THEN
    PERFORM storage.create_bucket('task-reports', 'task-reports', true);
    RETURN;
  ELSIF to_regprocedure('storage.create_bucket(text,boolean)') IS NOT NULL THEN
    PERFORM storage.create_bucket('task-reports', true);
    RETURN;
  END IF;

  -- Fallback: Insert directly into storage.buckets with columns available in this instance
  SELECT EXISTS(
           SELECT 1 FROM information_schema.columns
            WHERE table_schema='storage' AND table_name='buckets' AND column_name='name'
         ) INTO has_name;
  SELECT EXISTS(
           SELECT 1 FROM information_schema.columns
            WHERE table_schema='storage' AND table_name='buckets' AND column_name='public'
         ) INTO has_public;

  IF has_name AND has_public THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('task-reports','task-reports', true)
    ON CONFLICT (id) DO NOTHING;
  ELSIF has_name THEN
    INSERT INTO storage.buckets (id, name) VALUES ('task-reports','task-reports')
    ON CONFLICT (id) DO NOTHING;
  ELSIF has_public THEN
    INSERT INTO storage.buckets (id, public) VALUES ('task-reports', true)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO storage.buckets (id) VALUES ('task-reports')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 2) Policies on storage.objects for this bucket
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='task_reports_read'
  ) THEN
    CREATE POLICY task_reports_read ON storage.objects
      FOR SELECT USING (bucket_id = 'task-reports');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='task_reports_insert'
  ) THEN
    CREATE POLICY task_reports_insert ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'task-reports');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='task_reports_update_owner'
  ) THEN
    CREATE POLICY task_reports_update_owner ON storage.objects
      FOR UPDATE USING (bucket_id = 'task-reports' AND owner = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='task_reports_delete_owner'
  ) THEN
    CREATE POLICY task_reports_delete_owner ON storage.objects
      FOR DELETE USING (bucket_id = 'task-reports' AND owner = auth.uid());
  END IF;
END $$;

-- Note: Bucket is public for simple access via getPublicUrl(). If you prefer private,
-- set public => false and switch to signed URLs at fetch time.
