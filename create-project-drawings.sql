-- Project Drawings: support master PDF per project and derived per-area drawings
-- Run in Supabase SQL Editor as postgres

-- 1) Storage bucket for drawings (public read by default for easy CDN)
DO $$
DECLARE
	has_name boolean;
	has_public boolean;
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema='storage' AND table_name='buckets'
	) THEN
		IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'project-drawings') THEN
			-- Prefer function API when available, otherwise insert directly (idempotent)
			IF to_regprocedure('storage.create_bucket(text,text,boolean)') IS NOT NULL THEN
				PERFORM storage.create_bucket('project-drawings', 'project-drawings', true);
			ELSIF to_regprocedure('storage.create_bucket(text,boolean)') IS NOT NULL THEN
				PERFORM storage.create_bucket('project-drawings', true);
			ELSE
				SELECT EXISTS(
					SELECT 1 FROM information_schema.columns
					WHERE table_schema='storage' AND table_name='buckets' AND column_name='name') INTO has_name;
				SELECT EXISTS(
					SELECT 1 FROM information_schema.columns
					WHERE table_schema='storage' AND table_name='buckets' AND column_name='public') INTO has_public;
				IF has_name AND has_public THEN
					INSERT INTO storage.buckets (id, name, public)
					VALUES ('project-drawings', 'project-drawings', true)
					ON CONFLICT (id) DO NOTHING;
				ELSIF has_name THEN
					INSERT INTO storage.buckets (id, name)
					VALUES ('project-drawings', 'project-drawings')
					ON CONFLICT (id) DO NOTHING;
				ELSIF has_public THEN
					INSERT INTO storage.buckets (id, public)
					VALUES ('project-drawings', true)
					ON CONFLICT (id) DO NOTHING;
				ELSE
					INSERT INTO storage.buckets (id)
					VALUES ('project-drawings')
					ON CONFLICT (id) DO NOTHING;
				END IF;
			END IF;
		END IF;
	END IF;
END $$;

-- 2) Tables
DO $$
BEGIN
	-- Master drawing set = one PDF for the whole project
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema='public' AND table_name='project_drawing_sets'
	) THEN
		CREATE TABLE public.project_drawing_sets (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
			title text NOT NULL,
			description text,
			pdf_url text NOT NULL,
			file_name text NOT NULL,
			file_size bigint,
			page_count int,
			uploaded_by uuid REFERENCES public.profiles(id),
			created_at timestamptz NOT NULL DEFAULT now()
		);
		CREATE INDEX IF NOT EXISTS idx_pds_project ON public.project_drawing_sets(project_id);
		CREATE INDEX IF NOT EXISTS idx_pds_created ON public.project_drawing_sets(created_at DESC);
	END IF;

	-- Individual drawings (can be standalone files OR derived from a set's PDF page)
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.tables
		WHERE table_schema='public' AND table_name='project_drawings'
	) THEN
		CREATE TABLE public.project_drawings (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
			-- If derived from a master PDF:
			source_set_id uuid REFERENCES public.project_drawing_sets(id) ON DELETE CASCADE,
			page_number int,
			-- If standalone upload (optional):
			file_url text,
			file_name text,
			file_size bigint,
			file_type text,
			-- Common metadata for search/filter
			name text NOT NULL,          -- Mã hiệu bản vẽ
			title text,                  -- Tiêu đề bản vẽ
			area text,                   -- Khu vực
			category text,               -- Hạng mục
			thumb_url text,              -- Ảnh xem trước (do app sinh và upload)
			uploaded_by uuid REFERENCES public.profiles(id),
			created_at timestamptz NOT NULL DEFAULT now(),
			-- Generated flag: true nếu là bản vẽ tách từ PDF
			is_derived boolean GENERATED ALWAYS AS (source_set_id IS NOT NULL) STORED
		);
		CREATE INDEX IF NOT EXISTS idx_pd_project ON public.project_drawings(project_id);
		CREATE INDEX IF NOT EXISTS idx_pd_set_page ON public.project_drawings(source_set_id, page_number);
		CREATE INDEX IF NOT EXISTS idx_pd_area ON public.project_drawings(project_id, area);
		CREATE INDEX IF NOT EXISTS idx_pd_category ON public.project_drawings(project_id, category);
	END IF;
END $$;

		-- Validate page_number within set.page_count for derived drawings
		CREATE OR REPLACE FUNCTION public.validate_drawing_page()
		RETURNS trigger LANGUAGE plpgsql AS $$
		DECLARE v_pages int;
		BEGIN
			IF NEW.source_set_id IS NOT NULL THEN
				IF NEW.page_number IS NULL OR NEW.page_number < 1 THEN
					RAISE EXCEPTION 'invalid page_number';
				END IF;
				SELECT page_count INTO v_pages FROM public.project_drawing_sets WHERE id = NEW.source_set_id;
				IF v_pages IS NOT NULL AND NEW.page_number > v_pages THEN
					RAISE EXCEPTION 'page_number exceeds page_count (%).', v_pages;
				END IF;
			END IF;
			RETURN NEW;
		END;$$;

		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pd_validate_page'
			) THEN
				CREATE TRIGGER trg_pd_validate_page
				BEFORE INSERT OR UPDATE ON public.project_drawings
				FOR EACH ROW EXECUTE FUNCTION public.validate_drawing_page();
			END IF;
		END $$;

-- 3) Full-text search vector for fast tìm kiếm theo tên/tiêu đề/khu vực/hạng mục
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema='public' AND table_name='project_drawings' AND column_name='search_tsv'
	) THEN
		ALTER TABLE public.project_drawings
			ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS (
				to_tsvector('simple',
					coalesce(name,'') || ' ' ||
					coalesce(title,'') || ' ' ||
					coalesce(area,'') || ' ' ||
					coalesce(category,'')
				)
			) STORED;
		CREATE INDEX IF NOT EXISTS idx_pd_search ON public.project_drawings USING GIN (search_tsv);
	END IF;
END $$;

-- Enable accent-insensitive search support (safe if already installed)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 4) RLS
ALTER TABLE public.project_drawing_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_drawings ENABLE ROW LEVEL SECURITY;

-- Helper predicate: user is member/manager/admin of the project
CREATE OR REPLACE FUNCTION public.is_project_actor(p_project_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
	SELECT (
		EXISTS (
			SELECT 1 FROM public.project_members pm
			WHERE pm.project_id = p_project_id AND pm.user_id = auth.uid()
		)
		OR EXISTS (
			SELECT 1 FROM public.profiles p
			WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
		)
		OR EXISTS (
			SELECT 1 FROM public.projects pr
			WHERE pr.id = p_project_id AND pr.manager_id = auth.uid()
		)
	);
$$;

DO $$ BEGIN
	-- project_drawing_sets policies
	IF EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_drawing_sets' AND policyname='pds_select'
	) THEN
		DROP POLICY pds_select ON public.project_drawing_sets;
	END IF;
	CREATE POLICY pds_select ON public.project_drawing_sets
		FOR SELECT USING (public.is_project_actor(project_id));

	IF EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_drawing_sets' AND policyname='pds_insert'
	) THEN
		DROP POLICY pds_insert ON public.project_drawing_sets;
	END IF;
	CREATE POLICY pds_insert ON public.project_drawing_sets
		FOR INSERT WITH CHECK (uploaded_by = auth.uid() AND public.is_project_actor(project_id));

	IF EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_drawing_sets' AND policyname='pds_delete'
	) THEN
		DROP POLICY pds_delete ON public.project_drawing_sets;
	END IF;
	CREATE POLICY pds_delete ON public.project_drawing_sets
		FOR DELETE USING (public.is_project_actor(project_id));

	-- project_drawings policies
	IF EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_drawings' AND policyname='pd_select'
	) THEN
		DROP POLICY pd_select ON public.project_drawings;
	END IF;
	CREATE POLICY pd_select ON public.project_drawings
		FOR SELECT USING (public.is_project_actor(project_id));

	IF EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_drawings' AND policyname='pd_insert'
	) THEN
		DROP POLICY pd_insert ON public.project_drawings;
	END IF;
	CREATE POLICY pd_insert ON public.project_drawings
		FOR INSERT WITH CHECK (uploaded_by = auth.uid() AND public.is_project_actor(project_id));

	IF EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_drawings' AND policyname='pd_update'
	) THEN
		DROP POLICY pd_update ON public.project_drawings;
	END IF;
	CREATE POLICY pd_update ON public.project_drawings
		FOR UPDATE USING (public.is_project_actor(project_id)) WITH CHECK (public.is_project_actor(project_id));

	IF EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_drawings' AND policyname='pd_delete'
	) THEN
		DROP POLICY pd_delete ON public.project_drawings;
	END IF;
	CREATE POLICY pd_delete ON public.project_drawings
		FOR DELETE USING (public.is_project_actor(project_id));
END $$;

-- 5) Storage policies for project-drawings bucket
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_drawings_read'
	) THEN
		CREATE POLICY project_drawings_read ON storage.objects
			FOR SELECT USING (bucket_id = 'project-drawings');
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_drawings_insert'
	) THEN
		CREATE POLICY project_drawings_insert ON storage.objects
			FOR INSERT WITH CHECK (bucket_id = 'project-drawings');
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_drawings_update_owner'
	) THEN
		CREATE POLICY project_drawings_update_owner ON storage.objects
			FOR UPDATE USING (bucket_id = 'project-drawings' AND owner = auth.uid());
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='project_drawings_delete_owner'
	) THEN
		CREATE POLICY project_drawings_delete_owner ON storage.objects
			FOR DELETE USING (bucket_id = 'project-drawings' AND owner = auth.uid());
	END IF;
END $$;

-- 6) RPC: Create master set
CREATE OR REPLACE FUNCTION public.create_project_drawing_set(
	p_project_id uuid,
	p_title text,
	p_description text,
	p_pdf_url text,
	p_file_name text,
	p_file_size bigint,
	p_page_count int
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
	IF NOT public.is_project_actor(p_project_id) THEN
		RAISE EXCEPTION 'not allowed';
	END IF;

	INSERT INTO public.project_drawing_sets (project_id, title, description, pdf_url, file_name, file_size, page_count, uploaded_by)
	VALUES (p_project_id, p_title, p_description, p_pdf_url, p_file_name, p_file_size, p_page_count, auth.uid())
	RETURNING id INTO v_id;
	RETURN v_id;
END;$$;

REVOKE ALL ON FUNCTION public.create_project_drawing_set(uuid,text,text,text,text,bigint,int) FROM public;
GRANT EXECUTE ON FUNCTION public.create_project_drawing_set(uuid,text,text,text,text,bigint,int) TO authenticated;

-- 7) RPC: Bulk add drawings from a set with per-area metadata
-- p_drawings JSONB array of objects: [{"page_number":1,"name":"A-101","title":"Mặt bằng tầng 1","area":"Khu A","category":"Kiến trúc","thumb_url":null}, ...]
CREATE OR REPLACE FUNCTION public.bulk_add_drawings_from_set(
	p_set_id uuid,
	p_drawings jsonb
) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
	v_project uuid;
	v_count int := 0;
BEGIN
	SELECT project_id INTO v_project FROM public.project_drawing_sets WHERE id = p_set_id;
	IF v_project IS NULL THEN RAISE EXCEPTION 'set not found'; END IF;
	IF NOT public.is_project_actor(v_project) THEN RAISE EXCEPTION 'not allowed'; END IF;

	INSERT INTO public.project_drawings (
		project_id, source_set_id, page_number, name, title, area, category, thumb_url, uploaded_by
	)
	SELECT v_project,
				 p_set_id,
				 (elem->>'page_number')::int,
				 nullif(trim(elem->>'name'),''),
				 nullif(trim(elem->>'title'),''),
				 nullif(trim(elem->>'area'),''),
				 nullif(trim(elem->>'category'),''),
				 nullif(trim(elem->>'thumb_url'),''),
				 auth.uid()
	FROM jsonb_array_elements(p_drawings) AS elem
	WHERE (elem ? 'page_number') AND (elem->>'page_number') ~ '^[0-9]+$'
				AND coalesce(nullif(trim(elem->>'name'),''), '') <> ''
	RETURNING 1;

	GET DIAGNOSTICS v_count = ROW_COUNT;
	RETURN COALESCE(v_count,0);
END;$$;

REVOKE ALL ON FUNCTION public.bulk_add_drawings_from_set(uuid,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bulk_add_drawings_from_set(uuid,jsonb) TO authenticated;

-- 8) View + RPC: unified overview for tìm kiếm/lọc (không phải soát cả PDF)
CREATE OR REPLACE VIEW public.project_drawings_overview AS
SELECT 
	d.id,
	d.project_id,
	d.name,
	d.title,
	d.area,
	d.category,
	d.is_derived,
	d.page_number,
	COALESCE(d.file_url, s.pdf_url) AS file_url,
	d.thumb_url,
	d.source_set_id,
	s.title AS set_title,
	s.file_name AS source_file_name,
	d.created_at,
	d.uploaded_by
FROM public.project_drawings d
LEFT JOIN public.project_drawing_sets s ON s.id = d.source_set_id;

GRANT SELECT ON public.project_drawings_overview TO authenticated;

-- RLS for the view via a SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.list_project_drawings_overview(
	p_project_id uuid,
	p_q text DEFAULT NULL,
	p_area text DEFAULT NULL,
	p_category text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
	IF NOT public.is_project_actor(p_project_id) THEN
		RAISE EXCEPTION 'not allowed';
	END IF;

	RETURN (
		SELECT jsonb_agg(row_to_json(t)) FROM (
			SELECT o.*,
						 (SELECT jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email)
							FROM public.profiles p WHERE p.id = o.uploaded_by) AS uploaded_by_user
			FROM public.project_drawings_overview o
			WHERE o.project_id = p_project_id
				AND (p_area IS NULL OR o.area = p_area)
				AND (p_category IS NULL OR o.category = p_category)
				AND (
					p_q IS NULL OR p_q = '' OR EXISTS (
						SELECT 1 FROM public.project_drawings d2
						WHERE d2.id = o.id AND (
							-- Exact accent/case-insensitive match via precomputed tsvector
							d2.search_tsv @@ plainto_tsquery('simple', p_q)
							-- Accent-insensitive fallback using unaccent
							OR to_tsvector('simple', unaccent(coalesce(d2.name,'') || ' ' || coalesce(d2.title,'') || ' ' || coalesce(d2.area,'') || ' ' || coalesce(d2.category,'')))
								@@ plainto_tsquery('simple', unaccent(p_q))
						)
					)
				)
			ORDER BY COALESCE(o.area,''), COALESCE(o.category,''), o.name, o.created_at DESC
		) t
	);
END;$$;

REVOKE ALL ON FUNCTION public.list_project_drawings_overview(uuid,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.list_project_drawings_overview(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_project_drawings_overview(uuid,text,text,text) TO service_role;

-- 9) Force PostgREST to reload schema cache
DO $$ BEGIN
	PERFORM pg_notify('pgrst', 'reload schema');
END $$;

