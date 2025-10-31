-- Migration: Reminder Scheduler minimal schema
-- Safe to run multiple times (idempotent guards used where possible)

-- Tasks: ensure minimal columns exist (adapt to your schema)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tasks' and column_name='completed_at'
  ) then
    execute 'alter table public.tasks add column completed_at timestamptz';
  end if;
exception when undefined_table then
  create table public.tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    priority text not null default ''::text,
    status text not null default 'pending',
    due_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz default now()
  );
end $$;

-- Per-user reminder settings for a task
create table if not exists public.task_reminder_settings (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  active boolean default true,
  repeat_hours int not null default 4 check (repeat_hours in (4,8,12,16,24)),
  start_mode text not null default 'on_upcoming', -- on_create|on_upcoming|on_overdue
  timezone text not null default 'Asia/Ho_Chi_Minh',
  quiet_hours jsonb default '{"start":"22:00","end":"07:00"}',
  channels text[] not null default '{push}',
  escalate_after int default 0,
  muted_by uuid,
  muted_at timestamptz,
  last_sent_at timestamptz,
  next_fire_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (task_id, user_id)
);

-- Delivery logs
create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  status text not null,
  severity text not null,
  message text,
  sent_at timestamptz default now(),
  error text,
  snapshot jsonb
);

-- Helpful indexes
create index if not exists idx_reminder_settings_active_next on public.task_reminder_settings(active, next_fire_at);
create index if not exists idx_reminder_settings_user on public.task_reminder_settings(user_id);
create index if not exists idx_reminder_logs_user_time on public.reminder_logs(user_id, sent_at desc);

-- Optional RLS (Edge Function uses service role, but RLS is still good practice)
alter table public.task_reminder_settings enable row level security;
do $$ begin
  drop policy if exists reminder_settings_self on public.task_reminder_settings;
  create policy reminder_settings_self on public.task_reminder_settings
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when others then null; end $$;

alter table public.reminder_logs enable row level security;
do $$ begin
  drop policy if exists reminder_logs_self on public.reminder_logs;
  create policy reminder_logs_self on public.reminder_logs
    for select using (auth.uid() = user_id);
exception when others then null; end $$;
