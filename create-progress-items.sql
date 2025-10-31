-- Create independent progress_items table to decouple Progress page from Tasks page
-- Run this in Supabase SQL editor

-- Ensure required extension for gen_random_uuid
create extension if not exists pgcrypto;

create table if not exists public.progress_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  area text null,
  start_date date null,
  due_date date null,
  status text null,
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  manpower integer not null default 0 check (manpower >= 0),
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id)
);

-- Helpful indexes
create index if not exists progress_items_project_created_idx on public.progress_items(project_id, created_at desc);
create index if not exists progress_items_due_idx on public.progress_items(due_date);

-- RLS
alter table public.progress_items enable row level security;

-- Basic policies: allow project members to read/write their project progress items
-- Adjust to match your existing projects/project_members policies
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_items' and policyname = 'progress_items_select'
  ) then
    create policy progress_items_select on public.progress_items
      for select using (
        exists (
          select 1 from public.project_members m
          where m.project_id = progress_items.project_id
            and m.user_id = auth.uid()
        ) or exists (
          select 1 from public.projects p
          where p.id = progress_items.project_id
            and (p.manager_id = auth.uid())
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_items' and policyname = 'progress_items_insert'
  ) then
    create policy progress_items_insert on public.progress_items
      for insert with check (
        exists (
          select 1 from public.project_members m
          where m.project_id = progress_items.project_id
            and m.user_id = auth.uid()
        ) or exists (
          select 1 from public.projects p
          where p.id = progress_items.project_id
            and (p.manager_id = auth.uid())
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_items' and policyname = 'progress_items_update'
  ) then
    create policy progress_items_update on public.progress_items
      for update using (
        exists (
          select 1 from public.project_members m
          where m.project_id = progress_items.project_id
            and m.user_id = auth.uid()
        ) or exists (
          select 1 from public.projects p
          where p.id = progress_items.project_id
            and (p.manager_id = auth.uid())
        )
      );
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'progress_items' and policyname = 'progress_items_delete'
  ) then
    create policy progress_items_delete on public.progress_items
      for delete using (
        exists (
          select 1 from public.project_members m
          where m.project_id = progress_items.project_id
            and m.user_id = auth.uid()
        ) or exists (
          select 1 from public.projects p
          where p.id = progress_items.project_id
            and (p.manager_id = auth.uid())
        )
      );
  end if;
end$$;

-- Optional: default created_by trigger
create or replace function public.set_progress_item_created_by()
returns trigger as $$
begin
  if (new.created_by is null) then
    new.created_by := auth.uid();
  end if;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists trg_progress_items_created_by on public.progress_items;
create trigger trg_progress_items_created_by
before insert on public.progress_items
for each row
execute function public.set_progress_item_created_by();
