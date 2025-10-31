-- VERIFY: Schema health and end-to-end reminder sending
-- Safe checks + minimal test data. Run in Supabase SQL editor.

-- 0) Show current schema status
select 
  (select count(*) from information_schema.columns where table_schema='public' and table_name='task_reminders' and column_name='scheduled_at') as has_scheduled_at,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='task_reminders' and column_name='sent') as has_sent,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='task_reminders' and column_name='is_sent') as has_legacy_is_sent,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='task_reminders' and column_name='reminder_time') as has_legacy_reminder_time,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='reminder_logs') as has_reminder_logs,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='notifications') as has_notifications,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='user_reminder_preferences') as has_user_prefs;

-- 1) Pick a user and a task to test with
-- Replace these with actual IDs for your environment
-- Tip: choose your own user id so you see in-app notifications
-- select id, full_name, email, phone from public.profiles limit 5;
-- select id, title, due_date from public.tasks order by created_at desc limit 5;

-- Example placeholders (CHANGE ME):
-- \set test_user '00000000-0000-0000-0000-000000000000'
-- \set test_task '11111111-1111-1111-1111-111111111111'

-- 2) Insert two due reminders to queue (scheduled_at <= now())
-- NOTE: you must change the UUIDs above or inline below
-- insert into public.task_reminders(task_id, user_id, scheduled_at, message, type, sent)
-- values
--   (:test_task, :test_user, now() - interval '1 minute', 'Nhắc việc test: gần hạn', 'scheduled_time', false),
--   (:test_task, :test_user, now() - interval '1 minute', 'Nhắc việc test: quá hạn', 'repeat_interval', false);

-- 3) Observe queue state
select id, task_id, user_id, scheduled_at, sent from public.task_reminders
where scheduled_at <= now() and sent = false
order by scheduled_at asc limit 10;

-- 4) TRIGGER SENDING
-- Do NOT call legacy function public.send_task_reminders().
-- Use Edge Function `reminder-scheduler` via Dashboard → Functions → Invoke.
-- After invoking, proceed to step 5.

-- 5) Check results: reminders marked sent
select id, sent, sent_at from public.task_reminders
where scheduled_at <= now()
order by sent_at desc nulls last limit 10;

-- Notifications created for your user
select id, user_id, title, type, created_at from public.notifications
where type = 'task_reminder'
order by created_at desc limit 10;

-- Delivery logs per channel
select id, channel, status, severity, sent_at, error from public.reminder_logs
order by sent_at desc limit 20;
