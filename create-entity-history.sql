-- Unified entity history (audit) with undo/redo support
-- Run this in Supabase SQL editor after core tables exist

-- Requires pgcrypto for gen_random_uuid
create extension if not exists pgcrypto;

-- 1) History table
create table if not exists public.entity_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null, -- e.g. 'tasks','progress_items','project_documents','task_attachments'
  entity_id uuid not null,
  project_id uuid null, -- when available
  action text not null check (action in ('insert','update','delete','restore')),
  version int not null,
  data jsonb not null, -- full row snapshot
  actor_id uuid null references public.profiles(id),
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists entity_history_entity_idx on public.entity_history(entity_type, entity_id, version desc);
create index if not exists entity_history_project_idx on public.entity_history(project_id, created_at desc);
create index if not exists entity_history_created_idx on public.entity_history(created_at desc);

-- 2) RLS
alter table public.entity_history enable row level security;

-- Managers/Admins can view history; users can view rows they created
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='entity_history' and policyname='entity_history_select') then
    drop policy entity_history_select on public.entity_history;
  end if;
  create policy entity_history_select on public.entity_history for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin'))
    or actor_id = auth.uid()
  );
end $$;

-- Allow inserts from application triggers (any authenticated)
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='entity_history' and policyname='entity_history_insert') then
    drop policy entity_history_insert on public.entity_history;
  end if;
  create policy entity_history_insert on public.entity_history for insert with check (true);
end $$;

-- Optional: only managers can delete history
do $$ begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='entity_history' and policyname='entity_history_delete') then
    drop policy entity_history_delete on public.entity_history;
  end if;
  create policy entity_history_delete on public.entity_history for delete using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'manager')
  );
end $$;

-- 3) Helper to compute next version per entity
create or replace function public._next_entity_version(p_entity_type text, p_entity_id uuid)
returns int language sql as $$
  select coalesce(max(version),0) + 1 from public.entity_history
  where entity_type = p_entity_type and entity_id = p_entity_id
$$;

-- 4) Generic trigger to capture row snapshots
create or replace function public.capture_entity_history()
returns trigger as $$
declare
  v_action text;
  v_data jsonb;
  v_entity_type text := TG_TABLE_NAME; -- use actual table name by default
  v_entity_id uuid;
  v_project_id uuid;
  v_version int;
  v_suppressed text;
begin
  -- Skip when suppression flag set (used by restore)
  begin
    v_suppressed := current_setting('app.history_suppressed', true);
  exception when others then
    v_suppressed := null;
  end;
  if coalesce(v_suppressed,'false') = 'true' then
    return case when TG_OP in ('INSERT','UPDATE') then NEW else OLD end;
  end if;

  if TG_OP = 'INSERT' then
    v_action := 'insert';
    v_data := to_jsonb(NEW);
    -- try to extract IDs
    v_entity_id := coalesce((NEW).id, null);
    v_project_id := coalesce((NEW).project_id, null);
  elsif TG_OP = 'UPDATE' then
    v_action := 'update';
    v_data := to_jsonb(NEW);
    v_entity_id := coalesce((NEW).id, null);
    v_project_id := coalesce((NEW).project_id, null);
  elsif TG_OP = 'DELETE' then
    v_action := 'delete';
    v_data := to_jsonb(OLD);
    v_entity_id := coalesce((OLD).id, null);
    v_project_id := coalesce((OLD).project_id, null);
  else
    return null;
  end if;

  if v_entity_id is null then
    -- only support tables with uuid PK id
    return case when TG_OP in ('INSERT','UPDATE') then NEW else OLD end;
  end if;

  v_version := public._next_entity_version(v_entity_type, v_entity_id);

  insert into public.entity_history(entity_type, entity_id, project_id, action, version, data, actor_id)
  values (v_entity_type, v_entity_id, v_project_id, v_action, v_version, v_data, auth.uid());

  return case when TG_OP in ('INSERT','UPDATE') then NEW else OLD end;
end;
$$ language plpgsql security definer;

comment on function public.capture_entity_history is 'Attach as trigger to tables to record insert/update/delete snapshots';

-- 5) Attach triggers (idempotent) for key tables if they exist
-- tasks
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tasks') then
    drop trigger if exists trg_tasks_history on public.tasks;
    create trigger trg_tasks_history
    after insert or update or delete on public.tasks
    for each row execute function public.capture_entity_history();
  end if;
end $$;

-- progress_items
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='progress_items') then
    drop trigger if exists trg_progress_items_history on public.progress_items;
    create trigger trg_progress_items_history
    after insert or update or delete on public.progress_items
    for each row execute function public.capture_entity_history();
  end if;
end $$;

-- project_documents
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='project_documents') then
    drop trigger if exists trg_project_documents_history on public.project_documents;
    create trigger trg_project_documents_history
    after insert or update or delete on public.project_documents
    for each row execute function public.capture_entity_history();
  end if;
end $$;

-- task_attachments (for task PDF and other files)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='task_attachments') then
    drop trigger if exists trg_task_attachments_history on public.task_attachments;
    create trigger trg_task_attachments_history
    after insert or update or delete on public.task_attachments
    for each row execute function public.capture_entity_history();
  end if;
end $$;

-- 6) Restore helper using a history row (by id)
create or replace function public.apply_history_version(p_history_id uuid, p_reason text default null)
returns text as $$
declare
  h record;
  tname text;
  idcol text := 'id';
  v_sql text;
  msg text;
  v_role text;
  v_proj uuid;
begin
  select * into h from public.entity_history where id = p_history_id;
  if not found then
    return 'NOT_FOUND';
  end if;

  -- permission: only managers can restore; if project-scoped, allow project manager
  select role into v_role from public.profiles where id = auth.uid();
  v_proj := coalesce(h.project_id, (h.data->>'project_id')::uuid);
  if v_role <> 'manager' then
    if v_proj is null or not exists (
      select 1 from public.projects p where p.id = v_proj and p.manager_id = auth.uid()
    ) then
      return 'FORBIDDEN';
    end if;
  end if;

  tname := h.entity_type; -- assume equals table name

  perform set_config('app.history_suppressed','true', true);

  v_sql := format($F$
    with rowdata as (
      select jsonb_populate_record(null::%I.%I, $1) as r
    )
    insert into %I.%I select (r).* from rowdata
    on conflict (%I) do update set %s
  $F$, 'public', tname, 'public', tname, idcol,
     (select string_agg(format('%I = EXCLUDED.%I', a.attname, a.attname), ', ')
        from pg_attribute a
       where a.attrelid = format('%I.%I','public',tname)::regclass
         and a.attnum > 0 and not a.attisdropped));

  execute v_sql using h.data;

  -- record a restore action (not suppressed)
  perform set_config('app.history_suppressed','false', true);
  insert into public.entity_history(entity_type, entity_id, project_id, action, version, data, actor_id, reason)
  values (
    h.entity_type,
    (h.data->>'id')::uuid,
    v_proj,
    'restore',
    public._next_entity_version(h.entity_type, (h.data->>'id')::uuid),
    h.data,
    auth.uid(),
    coalesce(p_reason,'restore via history')
  );

  msg := 'OK';
  return msg;
exception when others then
  perform set_config('app.history_suppressed','false', true);
  return 'ERROR: '||sqlerrm;
end;
$$ language plpgsql security definer;

comment on function public.apply_history_version is 'Restore a row to the state captured by a specific history entry (managers or project managers only)';

-- 7) Convenience: restore to a specific version number
create or replace function public.restore_entity_to_version(p_entity_type text, p_entity_id uuid, p_version int, p_reason text default null)
returns text as $$
declare
  hid uuid;
begin
  select id into hid from public.entity_history
   where entity_type = p_entity_type and entity_id = p_entity_id and version = p_version
   order by created_at desc limit 1;
  if hid is null then
    return 'NOT_FOUND';
  end if;
  return public.apply_history_version(hid, p_reason);
end;
$$ language plpgsql security definer;

comment on function public.restore_entity_to_version is 'Restore a row to a specific version number';
