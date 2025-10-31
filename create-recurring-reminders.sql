-- Recurring reminders (priority-based, customizable schedule)
create table if not exists public.recurring_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  message text,
  priority text not null default 'medium', -- low|medium|high|urgent
  frequency text not null default 'daily', -- daily|weekly|monthly|custom
  interval_days int default 1,
  weekday int, -- 0-6 for weekly
  month_day int, -- 1-31 for monthly
  time_of_day text default '08:00', -- HH:MM (24h)
  active boolean default true,
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.recurring_reminder_levels (
  priority text primary key,
  before_minutes int[] default '{0}',
  repeat_minutes int[] default '{}',
  active boolean default true,
  updated_at timestamptz default now()
);

insert into public.recurring_reminder_levels(priority, before_minutes, repeat_minutes, active)
values
  ('low',    array[0],           array[60],        true),
  ('medium', array[0, -10],      array[30, 60],    true),
  ('high',   array[0, -15, -60], array[15, 30, 60],true),
  ('urgent', array[0, -5, -15],  array[5, 10, 15], true)
on conflict (priority) do update set
  before_minutes = excluded.before_minutes,
  repeat_minutes = excluded.repeat_minutes,
  active = excluded.active,
  updated_at = now();

create index if not exists idx_recurring_reminders_user on public.recurring_reminders(user_id, active);
alter table public.recurring_reminders enable row level security;
drop policy if exists "recurring_select_own" on public.recurring_reminders;
create policy "recurring_select_own" on public.recurring_reminders for select using (auth.uid() = user_id);
drop policy if exists "recurring_cud_own" on public.recurring_reminders;
create policy "recurring_cud_own" on public.recurring_reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helper view: today's occurrences for user
-- View today's reminder occurrences using Vietnam local time
-- We interpret time_of_day as Asia/Ho_Chi_Minh local time and convert to UTC
create or replace view public.v_today_reminders as
select r.user_id,
       r.id as recurring_id,
       r.title,
       coalesce(r.message,'') as message,
       r.priority,
       r.time_of_day,
       ((current_date + (r.time_of_day)::time) at time zone 'Asia/Ho_Chi_Minh') as base_time
from public.recurring_reminders r
where r.active = true
  and (r.start_date is null or r.start_date <= current_date)
  and (r.end_date is null or r.end_date >= current_date);
