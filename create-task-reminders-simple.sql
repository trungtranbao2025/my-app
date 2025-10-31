-- Simple Task Reminders (per-user) for in-app notifications
-- Run this in Supabase SQL editor

-- Ensure pgcrypto for gen_random_uuid
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.task_reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  remind_at timestamptz not null,
  message text,
  is_sent boolean default false,
  sent_at timestamptz,
  created_at timestamptz default now()
);

-- If the table existed earlier without expected columns, add them now (idempotent)
do $mig$
declare
  r record;
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='task_reminders') then
    if not exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='task_reminders' and column_name='user_id'
    ) then
  alter table public.task_reminders add column user_id uuid;
    end if;
    if not exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='task_reminders' and column_name='task_id'
    ) then
      alter table public.task_reminders add column task_id uuid references public.tasks(id) on delete cascade;
    end if;
    if not exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='task_reminders' and column_name='remind_at'
    ) then
      alter table public.task_reminders add column remind_at timestamptz;
    end if;
    if not exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='task_reminders' and column_name='message'
    ) then
      alter table public.task_reminders add column message text;
    end if;
    if not exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='task_reminders' and column_name='is_sent'
    ) then
      alter table public.task_reminders add column is_sent boolean default false;
    end if;
    if not exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='task_reminders' and column_name='sent_at'
    ) then
      alter table public.task_reminders add column sent_at timestamptz;
    end if;
    if not exists (
      select 1 from information_schema.columns 
      where table_schema='public' and table_name='task_reminders' and column_name='created_at'
    ) then
      alter table public.task_reminders add column created_at timestamptz default now();
    end if;
  end if;
  -- Ensure FK on user_id is standardized with ON DELETE CASCADE
  -- 1) Drop any legacy FK(s) on column user_id
  for r in (
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage k
      on tc.constraint_name = k.constraint_name
     and tc.table_schema = k.table_schema
    where tc.table_schema='public' and tc.table_name='task_reminders'
      and tc.constraint_type='FOREIGN KEY'
      and k.column_name='user_id'
  ) loop
    execute format('alter table public.task_reminders drop constraint %I', r.constraint_name);
  end loop;

  -- 2) Add named FK with CASCADE if not present
  if not exists (
    select 1 from information_schema.table_constraints 
    where table_schema='public' and table_name='task_reminders' and constraint_name='task_reminders_user_fk'
  ) then
    execute 'alter table public.task_reminders 
             add constraint task_reminders_user_fk 
             foreign key (user_id) references auth.users(id) on delete cascade';
  end if;
end;
$mig$;

-- Helpful indexes
create index if not exists idx_task_reminders_user_time on public.task_reminders(user_id, remind_at);
create index if not exists idx_task_reminders_due on public.task_reminders(is_sent, remind_at);

alter table public.task_reminders enable row level security;

-- Policies: each user can manage only their own reminders
drop policy if exists "task_reminders_select_own" on public.task_reminders;
create policy "task_reminders_select_own" on public.task_reminders
  for select using (auth.uid() = user_id);

drop policy if exists "task_reminders_insert_own" on public.task_reminders;
create policy "task_reminders_insert_own" on public.task_reminders
  for insert with check (auth.uid() = user_id);

drop policy if exists "task_reminders_update_own" on public.task_reminders;
create policy "task_reminders_update_own" on public.task_reminders
  for update using (auth.uid() = user_id);

drop policy if exists "task_reminders_delete_own" on public.task_reminders;
create policy "task_reminders_delete_own" on public.task_reminders
  for delete using (auth.uid() = user_id);
