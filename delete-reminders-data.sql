-- Delete Reminders Data (Safe Cleanup)
-- Run this in Supabase SQL editor. Adjust WHERE conditions if needed.

begin;

-- 1) Delete synthetic reminder notifications created by sender
--    Only affects notifications typed as 'task_reminder'
delete from public.notifications
where type = 'task_reminder';

-- 2) Delete one-off reminders table rows (if exists)
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema='public' and table_name='reminders'
  ) then
    execute 'delete from public.reminders where true';
  end if;
end $$;

-- 3) Delete reminder logs used for de-duplication (if exists)
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema='public' and table_name='task_reminder_logs'
  ) then
    execute 'delete from public.task_reminder_logs where true';
  end if;
end $$;

-- 4) Delete simple task reminders (new table) if exists
do $$
begin
  if exists (
    select 1 from information_schema.tables 
    where table_schema='public' and table_name='task_reminders'
  ) then
    execute 'delete from public.task_reminders where true';
  end if;
end $$;

commit;

-- Optional: Full teardown (uncomment if you want to drop objects)
-- NOTE: This will remove functions and tables. Ensure nothing else depends on them.
--
-- begin;
-- drop view if exists public.v_today_reminders;
-- drop table if exists public.recurring_reminder_levels cascade;
-- drop table if exists public.recurring_reminders cascade;
-- drop function if exists public.count_pending_task_reminders();
-- drop function if exists public.send_task_reminders();
-- drop function if exists public.rebuild_task_reminders_all(integer);
-- drop function if exists public._compute_pending_task_reminders();
-- drop table if exists public.task_reminder_logs cascade;
-- drop table if exists public.reminder_level_configs cascade;
-- drop table if exists public.reminders cascade;
-- drop table if exists public.task_reminders cascade;
-- commit;
