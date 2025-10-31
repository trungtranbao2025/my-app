-- HOTFIX 2025-10-29: Fix 42P17 "infinite recursion detected in policy for relation project_members"
-- Safe to run multiple times (idempotent). Run in Supabase SQL editor.
-- Strategy:
-- 1) Provide SECURITY DEFINER helper functions (bypass RLS) to check roles/membership
-- 2) Rewrite project_members policies to use helpers (no self-select)
-- 3) Update progress_items and project_documents policies to use helpers to avoid deep joins
-- Notes: SECURITY DEFINER runs as owner; ensure tables are NOT set with FORCE ROW LEVEL SECURITY.

-- =====================================
-- 0) Helpers
-- =====================================
create or replace function public.is_admin_or_manager(u uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = u and p.role in ('admin','manager')
  );
$$;

create or replace function public.is_member_of_project(u uuid, pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.user_id = u and pm.project_id = pid
  );
$$;

create or replace function public.is_project_manager(u uuid, pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members pm
    where pm.user_id = u
      and pm.project_id = pid
      and coalesce(pm.system_role_in_project, pm.role_in_project) in ('manager','admin','project_manager')
  );
$$;

revoke all on function public.is_admin_or_manager(uuid) from public;
revoke all on function public.is_member_of_project(uuid, uuid) from public;
revoke all on function public.is_project_manager(uuid, uuid) from public;
grant execute on function public.is_admin_or_manager(uuid) to authenticated, service_role;
grant execute on function public.is_member_of_project(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_project_manager(uuid, uuid) to authenticated, service_role;

-- =====================================
-- 1) project_members policies (drop and recreate)
-- =====================================
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname='public' and tablename='project_members'
  loop
    execute format('drop policy if exists %I on public.project_members', r.policyname);
  end loop;
end$$;

alter table public.project_members enable row level security;

create policy project_members_select_visible on public.project_members
for select using (
  public.is_admin_or_manager(auth.uid())
  or public.is_member_of_project(auth.uid(), project_members.project_id)
);

create policy project_members_insert_manage on public.project_members
for insert with check (
  public.is_admin_or_manager(auth.uid())
  or public.is_project_manager(auth.uid(), project_members.project_id)
);

create policy project_members_update_manage on public.project_members
for update using (
  public.is_admin_or_manager(auth.uid())
  or public.is_project_manager(auth.uid(), project_members.project_id)
)
with check (
  public.is_admin_or_manager(auth.uid())
  or public.is_project_manager(auth.uid(), project_members.project_id)
);

create policy project_members_delete_manage on public.project_members
for delete using (
  public.is_admin_or_manager(auth.uid())
  or public.is_project_manager(auth.uid(), project_members.project_id)
);

-- =====================================
-- 2) progress_items policies (rewrite to helpers)
-- =====================================
-- Ensure table exists and RLS enabled separately if needed

-- SELECT
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='progress_items' and policyname='progress_items_select'
  ) then
    drop policy progress_items_select on public.progress_items;
  end if;
  create policy progress_items_select on public.progress_items
    for select using (
      public.is_member_of_project(auth.uid(), progress_items.project_id)
      or public.is_admin_or_manager(auth.uid())
    );
end$$;

-- INSERT
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='progress_items' and policyname='progress_items_insert'
  ) then
    drop policy progress_items_insert on public.progress_items;
  end if;
  create policy progress_items_insert on public.progress_items
    for insert with check (
      public.is_member_of_project(auth.uid(), progress_items.project_id)
      or public.is_admin_or_manager(auth.uid())
    );
end$$;

-- UPDATE
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='progress_items' and policyname='progress_items_update'
  ) then
    drop policy progress_items_update on public.progress_items;
  end if;
  create policy progress_items_update on public.progress_items
    for update using (
      public.is_member_of_project(auth.uid(), progress_items.project_id)
      or public.is_admin_or_manager(auth.uid())
    );
end$$;

-- DELETE
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname='public' and tablename='progress_items' and policyname='progress_items_delete'
  ) then
    drop policy progress_items_delete on public.progress_items;
  end if;
  create policy progress_items_delete on public.progress_items
    for delete using (
      public.is_member_of_project(auth.uid(), progress_items.project_id)
      or public.is_admin_or_manager(auth.uid())
    );
end$$;

-- =====================================
-- 3) project_documents policies (rewrite to helpers)
-- =====================================
-- SELECT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_documents' AND policyname='project_docs_select'
  ) THEN
    DROP POLICY project_docs_select ON public.project_documents;
  END IF;
  CREATE POLICY project_docs_select ON public.project_documents
  FOR SELECT USING (
    public.is_member_of_project(auth.uid(), project_documents.project_id)
    OR public.is_admin_or_manager(auth.uid())
  );
END$$;

-- INSERT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_documents' AND policyname='project_docs_insert'
  ) THEN
    DROP POLICY project_docs_insert ON public.project_documents;
  END IF;
  CREATE POLICY project_docs_insert ON public.project_documents
  FOR INSERT WITH CHECK (
    public.is_member_of_project(auth.uid(), project_documents.project_id)
    OR public.is_admin_or_manager(auth.uid())
  );
END$$;

-- UPDATE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_documents' AND policyname='project_docs_update'
  ) THEN
    DROP POLICY project_docs_update ON public.project_documents;
  END IF;
  CREATE POLICY project_docs_update ON public.project_documents
  FOR UPDATE USING (
    public.is_member_of_project(auth.uid(), project_documents.project_id)
    OR public.is_admin_or_manager(auth.uid())
  )
  WITH CHECK (
    public.is_member_of_project(auth.uid(), project_documents.project_id)
    OR public.is_admin_or_manager(auth.uid())
  );
END$$;

-- DELETE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_documents' AND policyname='project_docs_delete'
  ) THEN
    DROP POLICY project_docs_delete ON public.project_documents;
  END IF;
  CREATE POLICY project_docs_delete ON public.project_documents
  FOR DELETE USING (
    public.is_member_of_project(auth.uid(), project_documents.project_id)
    OR public.is_admin_or_manager(auth.uid())
  );
END$$;

-- =====================================
-- 4) Quick verification queries (optional)
-- =====================================
-- SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('project_members','progress_items','project_documents') ORDER BY tablename, policyname;
