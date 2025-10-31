-- Task Reminder Priority Levels + Sender Functions
-- Assumptions: public.tasks(id, title, due_date, assigned_to, status, priority)
-- Notifications table exists: public.notifications(user_id, type, title, message, created_at, is_read)
-- Use gen_random_uuid(); ensure pgcrypto: create extension if not exists pgcrypto with schema extensions;

-- 1) Priority level configs
create table if not exists public.reminder_level_configs (
  priority text primary key, -- low | medium | high | urgent
  before_due_hours int[] default '{}',
  overdue_hours int[] default '{}',
  active boolean default true,
  updated_at timestamptz default now()
);

insert into public.reminder_level_configs (priority, before_due_hours, overdue_hours, active)
values
  ('low',    array[72],        array[24, 72],  true),
  ('medium', array[48, 24],    array[12, 48],  true),
  ('high',   array[24, 12, 6], array[1, 12, 24], true),
  ('urgent', array[12, 6, 3],  array[1, 3, 6, 12], true)
on conflict (priority) do update set
  before_due_hours = excluded.before_due_hours,
  overdue_hours = excluded.overdue_hours,
  active = excluded.active,
  updated_at = now();

-- 2) Logs to prevent duplicate sends
create table if not exists public.task_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('before','overdue')),
  hours int not null,
  created_at timestamptz default now(),
  unique (task_id, user_id, kind, hours)
);

-- Drop old versions first to avoid signature/return-type conflicts
drop function if exists public._compute_pending_task_reminders();
create or replace function public._compute_pending_task_reminders()
returns table(task_id uuid, user_id uuid, kind text, hours int, title text, due_at timestamptz)
language sql stable as $$
  with base as (
    select t.id as task_id,
           t.assigned_to as user_id,
           t.title,
           t.due_date::timestamptz as due_at,
           -- Cast enum -> text to align with config.priority (text)
           coalesce(t.priority::text, 'medium') as priority,
           t.status
    from public.tasks t
    where t.assigned_to is not null
      and t.due_date is not null
      -- Avoid enum casting issues: treat NULL as not completed
      and (t.status is null or t.status::text <> 'completed')
  ), cfg as (
    select * from public.reminder_level_configs where active = true
  ), before_events as (
    select b.task_id, b.user_id, 'before'::text as kind, h.hours, b.title, b.due_at
    from base b
    join cfg c on c.priority = b.priority
    cross join lateral unnest(coalesce(c.before_due_hours, array[]::int[])) as h(hours)
    where (b.due_at - (h.hours || ' hours')::interval) <= now()
      and (b.due_at - (h.hours || ' hours')::interval) > now() - interval '1 hour'
  ), overdue_events as (
    select b.task_id, b.user_id, 'overdue'::text as kind, h.hours, b.title, b.due_at
    from base b
    join cfg c on c.priority = b.priority
    cross join lateral unnest(coalesce(c.overdue_hours, array[]::int[])) as h(hours)
    where (b.due_at + (h.hours || ' hours')::interval) <= now()
      and (b.due_at + (h.hours || ' hours')::interval) > now() - interval '1 hour'
  )
  select * from before_events
  union all
  select * from overdue_events;
$$;

-- 4) Count pending (not yet logged)
drop function if exists public.count_pending_task_reminders();
create or replace function public.count_pending_task_reminders()
returns integer
language sql stable as $$
  select count(*) from (
    select e.*
    from public._compute_pending_task_reminders() e
    left join public.task_reminder_logs l
      on l.task_id = e.task_id and l.user_id = e.user_id and l.kind = e.kind and l.hours = e.hours
    where l.id is null
  ) s;
$$;

-- 5) Sender: insert notifications + logs
drop function if exists public.send_task_reminders();
create or replace function public.send_task_reminders()
returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  inserted integer := 0;
begin
  -- Insert notifications to be sent now (skip already logged)
  insert into public.notifications (user_id, type, title, message, created_at, is_read)
  select e.user_id,
         'task_reminder',
         'Nhắc việc',
         format('%s • Hạn: %s • (%s %s giờ)', e.title, to_char(e.due_at, 'DD/MM/YYYY HH24:MI'), e.kind, e.hours),
         now(),
         false
  from public._compute_pending_task_reminders() e
  left join public.task_reminder_logs l
    on l.task_id = e.task_id and l.user_id = e.user_id and l.kind = e.kind and l.hours = e.hours
  where l.id is null
  returning 1 into inserted;

  -- Log sent entries (avoid duplicates by unique constraint)
  insert into public.task_reminder_logs (task_id, user_id, kind, hours)
  select e.task_id, e.user_id, e.kind, e.hours
  from public._compute_pending_task_reminders() e
  left join public.task_reminder_logs l
    on l.task_id = e.task_id and l.user_id = e.user_id and l.kind = e.kind and l.hours = e.hours
  where l.id is null
  on conflict do nothing;

  -- Return number of notifications inserted (fallback to count distinct logs added in this call)
  return coalesce(inserted, (select count(*) from public._compute_pending_task_reminders() e left join public.task_reminder_logs l on l.task_id=e.task_id and l.user_id=e.user_id and l.kind=e.kind and l.hours=e.hours where l.id is null));
end;
$$;

-- 6) Rebuild helper: clear logs to allow re-sending (for testing)
drop function if exists public.rebuild_task_reminders_all(integer);
create or replace function public.rebuild_task_reminders_all(p_limit integer default 1000)
returns integer
language sql security definer as $$
  with del as (
    delete from public.task_reminder_logs where true returning 1
  )
  select count(*) from del;
$$;

-- Grants (Supabase usually grants to authenticated by default on functions, but ensure)
grant execute on function public.count_pending_task_reminders() to authenticated;
grant execute on function public.send_task_reminders() to authenticated;
grant execute on function public.rebuild_task_reminders_all(integer) to authenticated;
