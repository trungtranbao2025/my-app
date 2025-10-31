-- Add category to project_documents for multiple document types (idempotent)
-- Categories used in app: minutes (Biên bản họp), tech (Thư kỹ thuật), incoming (Công văn đến), outgoing (Công văn đi), legal (Hồ sơ pháp lý)

DO $$
BEGIN
  -- Add column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='project_documents' AND column_name='category'
  ) THEN
    ALTER TABLE public.project_documents ADD COLUMN category text;
  END IF;

  -- Create index for faster filtering by category
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_project_documents_category' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_project_documents_category ON public.project_documents(category);
  END IF;

  -- Backfill existing rows as 'minutes' to keep current behavior
  UPDATE public.project_documents
  SET category = 'minutes'
  WHERE category IS NULL;
END $$;

-- Optional: Comment to document allowed values
COMMENT ON COLUMN public.project_documents.category IS 'Document category: minutes|tech|incoming|outgoing|legal';

-- Ensure PostgREST reloads schema cache
DO $$ BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
