-- One-click end-to-end verification for 08:30 reminder system
-- Run in Supabase SQL Editor as postgres/service_role. Safe to run multiple times.

DO $$
DECLARE
  v_user uuid;
  v_project uuid;
  v_now_ict text;
BEGIN
  -- 1) Pick a recent user and project (customize filters if needed)
  SELECT id INTO v_user FROM public.profiles WHERE is_active IS TRUE ORDER BY created_at DESC LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No active user found in public.profiles';
  END IF;

  SELECT id INTO v_project FROM public.projects ORDER BY created_at DESC LIMIT 1;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'No project found in public.projects';
  END IF;

  -- 2) Make daily_time ~ now (ICT) so reminders are due immediately
  v_now_ict := to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time, 'HH24:MI');
  INSERT INTO public.user_reminder_preferences(user_id, push_enabled, email_overdue_enabled, sms_overdue_enabled, daily_time, timezone)
  VALUES (v_user, true, true, false, v_now_ict, 'Asia/Ho_Chi_Minh')
  ON CONFLICT (user_id) DO UPDATE SET
    push_enabled = EXCLUDED.push_enabled,
    email_overdue_enabled = EXCLUDED.email_overdue_enabled,
    sms_overdue_enabled = EXCLUDED.sms_overdue_enabled,
    daily_time = EXCLUDED.daily_time,
    timezone = EXCLUDED.timezone;

  -- 3) Create three demo tasks for the user
  INSERT INTO public.tasks (project_id, title, assigned_to, start_date, due_date, priority, status, task_type)
  VALUES
    (v_project, 'DEMO • Bắt đầu hôm nay', v_user, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', 'medium', 'pending', 'one_time'),
    (v_project, 'DEMO • Đến hạn hôm nay', v_user, CURRENT_DATE - INTERVAL '2 day', CURRENT_DATE, 'medium', 'pending', 'one_time'),
    (v_project, 'DEMO • Quá hạn', v_user, CURRENT_DATE - INTERVAL '10 day', CURRENT_DATE - INTERVAL '5 day', 'medium', 'pending', 'one_time');

  -- 4) Enqueue today 08:30 reminders
  PERFORM public.schedule_0830_reminders_today();

  -- 5) Ensure reminders are due right now
  UPDATE public.task_reminders
  SET scheduled_at = now() - INTERVAL '1 minute'
  WHERE user_id = v_user AND sent = false AND scheduled_at > now();

  -- 6) Send reminders -> creates notifications and email outbox for overdue
  PERFORM public.send_pending_reminders();

  RAISE NOTICE 'Verification complete for user % on project %', v_user, v_project;
END $$;

-- Inspect results
-- Pending/just-sent reminders
SELECT r.id, r.user_id, r.task_id, r.scheduled_at, r.sent, r.sent_at, r.message
FROM public.task_reminders r
JOIN public.tasks t ON t.id = r.task_id
ORDER BY r.scheduled_at DESC
LIMIT 30;

-- Notifications created
SELECT id, user_id, title, message, type, sent_via_push, sent_via_email, created_at
FROM public.notifications
WHERE type = 'task_reminder'
ORDER BY created_at DESC
LIMIT 30;

-- Outboxes for integrations
SELECT id, to_email, subject, status, created_at FROM public.email_outbox ORDER BY created_at DESC LIMIT 20;
SELECT id, to_phone, message, status, created_at FROM public.sms_outbox ORDER BY created_at DESC LIMIT 20;
