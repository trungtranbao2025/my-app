-- Test reminders for user hohoangtien94@gmail.com (copy-paste into Supabase SQL Editor)
-- This script will:
-- 1) Resolve the user's id from profiles by email
-- 2) Pick one assigned task (prefer the nearest due_date)
-- 3) Insert two due reminders into task_reminders (scheduled_at <= now())
-- 4) Provide verification queries

-- IMPORTANT:
-- - To send via the standard pipeline, invoke Edge Function `reminder-scheduler` after running this script.
-- - Alternatively, you can call `select public.send_pending_reminders();` to push in-app notifications directly from DB.
-- - Avoid running both pipelines at the same time to prevent duplicates.

DO $test$
DECLARE
  v_user_id uuid;
  v_task_id uuid;
BEGIN
  -- 1) Resolve user by email
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE lower(email) = lower('hohoangtien94@gmail.com')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy user với email %', 'hohoangtien94@gmail.com';
  END IF;

  -- 2) Pick one task assigned to this user (prefer due soon, else latest created)
  SELECT t.id INTO v_task_id
  FROM public.tasks t
  WHERE t.assigned_to = v_user_id
  ORDER BY t.due_date NULLS LAST, t.created_at DESC
  LIMIT 1;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'User % chưa có task được giao. Hãy gán 1 task cho user này rồi chạy lại.', v_user_id;
  END IF;

  -- 3) Insert two reminders due now (scheduled_at <= now())
  INSERT INTO public.task_reminders (task_id, user_id, scheduled_at, message, type, sent)
  VALUES
    (v_task_id, v_user_id, now() - interval '1 minute', 'Nhắc việc test: gần hạn (queue)', 'scheduled_time', false),
    (v_task_id, v_user_id, now() - interval '1 minute', 'Nhắc việc test: quá hạn (queue)', 'repeat_interval', false);

  RAISE NOTICE '✅ Đã chèn 2 reminders cho user % (task_id=%). Hãy invoke Edge Function `reminder-scheduler` để gửi, hoặc chạy: select public.send_pending_reminders();', v_user_id, v_task_id;
END
$test$ LANGUAGE plpgsql;

-- 4) Verify queue state (unsent, ready to send)
select id, task_id, user_id, scheduled_at, sent
from public.task_reminders
where user_id = (select id from public.profiles where lower(email)=lower('hohoangtien94@gmail.com'))
  and sent = false
order by scheduled_at asc
limit 10;

-- OPTIONAL: Direct DB sender (in-app only)
-- select public.send_pending_reminders();

-- After sending via Edge Function or DB sender:
-- Sent reminders
select id, sent, sent_at
from public.task_reminders
where user_id = (select id from public.profiles where lower(email)=lower('hohoangtien94@gmail.com'))
order by sent_at desc nulls last
limit 10;

-- New notifications -> triggers realtime toast in UI for that user
select id, user_id, title, type, created_at
from public.notifications
where type = 'task_reminder'
  and user_id = (select id from public.profiles where lower(email)=lower('hohoangtien94@gmail.com'))
order by created_at desc
limit 10;

-- Delivery logs (if Edge Function handled sending)
select channel, status, severity, sent_at, error
from public.reminder_logs
order by sent_at desc
limit 20;
