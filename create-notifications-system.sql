-- Insert sample notifications
-- Run this in Supabase SQL Editor

-- Create notifications for Manager (1857c25b-9847-40b9-88be-ed76c2301c0a)
INSERT INTO public.notifications (user_id, title, message, type, related_id, is_read)
VALUES 
('1857c25b-9847-40b9-88be-ed76c2301c0a', 'Công việc mới được giao', 'Bạn đã được giao công việc: Giám sát thi công trụ cầu T1-T3', 'task_assigned', NULL, false),
('1857c25b-9847-40b9-88be-ed76c2301c0a', 'Công việc sắp đến hạn', 'Công việc "Lập kế hoạch giám sát thi công" sẽ đến hạn vào 15/12/2025', 'task_reminder', NULL, false),
('1857c25b-9847-40b9-88be-ed76c2301c0a', 'Dự án hoàn thành', 'Dự án Nhà máy điện mặt trời đã hoàn thành 100%', 'task_completed', NULL, true);

-- Create notifications for Admin (12716509-f93e-4e04-bce6-0b7e3dd247a3)
INSERT INTO public.notifications (user_id, title, message, type, related_id, is_read)
VALUES 
('12716509-f93e-4e04-bce6-0b7e3dd247a3', 'Công việc mới được giao', 'Bạn đã được giao công việc: Kiểm tra hệ thống cáp dây văng', 'task_assigned', NULL, false),
('12716509-f93e-4e04-bce6-0b7e3dd247a3', 'Công việc sắp đến hạn', 'Công việc "Kiểm tra móng và kết cấu tầng hầm" sẽ đến hạn vào 15/11/2025', 'task_reminder', NULL, false),
('12716509-f93e-4e04-bce6-0b7e3dd247a3', 'Sinh nhật đồng nghiệp', 'Hôm nay là sinh nhật của Trần Bảo Trung! 🎂', 'birthday', NULL, true);

-- Create notifications for User (f459b983-2e40-479b-b7f3-9ef80cb7c50d)
INSERT INTO public.notifications (user_id, title, message, type, related_id, is_read)
VALUES 
('f459b983-2e40-479b-b7f3-9ef80cb7c50d', 'Công việc mới được giao', 'Bạn đã được giao công việc: Nghiệm thu kết cấu tầng 15-20', 'task_assigned', NULL, false),
('f459b983-2e40-479b-b7f3-9ef80cb7c50d', 'Công việc quá hạn', 'Công việc "Thẩm định thiết kế kỹ thuật" đã quá hạn!', 'task_overdue', NULL, false),
('f459b983-2e40-479b-b7f3-9ef80cb7c50d', 'Kỷ niệm công ty', 'Chúc mừng kỷ niệm 5 năm thành lập công ty! 🎉', 'anniversary', NULL, true);

-- Create function to automatically create notification when task is assigned
CREATE OR REPLACE FUNCTION notify_task_assigned()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification for new tasks or when assigned_to changes
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)) THEN
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (
        NEW.assigned_to,
        'Công việc mới được giao',
        'Bạn đã được giao công việc: ' || NEW.title,
        'task_assigned',
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task assignment notifications
DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON public.tasks;
CREATE TRIGGER trigger_notify_task_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assigned();

-- Create function to notify when task is completed
CREATE OR REPLACE FUNCTION notify_task_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify when status changes to completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Notify the person who assigned the task
    IF NEW.assigned_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      VALUES (
        NEW.assigned_by,
        'Công việc đã hoàn thành',
        'Công việc "' || NEW.title || '" đã được hoàn thành',
        'task_completed',
        NEW.id
      );
    END IF;
    
    -- Also notify project manager
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    SELECT 
      p.manager_id,
      'Công việc dự án hoàn thành',
      'Công việc "' || NEW.title || '" trong dự án "' || p.name || '" đã hoàn thành',
      'task_completed',
      NEW.id
    FROM public.projects p
    WHERE p.id = NEW.project_id
      AND p.manager_id IS NOT NULL
      AND p.manager_id != NEW.assigned_by; -- Don't duplicate if manager is the assigner
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task completion notifications
DROP TRIGGER IF EXISTS trigger_notify_task_completed ON public.tasks;
CREATE TRIGGER trigger_notify_task_completed
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_completed();

-- Create function to check for overdue tasks (to be run daily via cron)
CREATE OR REPLACE FUNCTION check_overdue_tasks()
RETURNS void AS $$
DECLARE
  task_record RECORD;
BEGIN
  FOR task_record IN 
    SELECT t.id, t.title, t.assigned_to, t.due_date
    FROM public.tasks t
    WHERE t.status != 'completed'
      AND t.due_date < CURRENT_DATE
      AND t.assigned_to IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.related_id = t.id
          AND n.type = 'task_overdue'
          AND n.created_at::date = CURRENT_DATE
      )
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (
      task_record.assigned_to,
      'Công việc quá hạn',
      'Công việc "' || task_record.title || '" đã quá hạn từ ' || task_record.due_date,
      'task_overdue',
      task_record.id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check for tasks due soon (3 days before)
CREATE OR REPLACE FUNCTION check_tasks_due_soon()
RETURNS void AS $$
DECLARE
  task_record RECORD;
BEGIN
  FOR task_record IN 
    SELECT t.id, t.title, t.assigned_to, t.due_date
    FROM public.tasks t
    WHERE t.status != 'completed'
      AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
      AND t.assigned_to IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.related_id = t.id
          AND n.type = 'task_reminder'
          AND n.created_at::date = CURRENT_DATE
      )
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_id)
    VALUES (
      task_record.assigned_to,
      'Công việc sắp đến hạn',
      'Công việc "' || task_record.title || '" sẽ đến hạn vào ' || TO_CHAR(task_record.due_date, 'DD/MM/YYYY'),
      'task_reminder',
      task_record.id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To run the cron functions daily, you would set up a Supabase Edge Function
-- or use pg_cron extension (if available). For now, you can manually call:
-- SELECT check_overdue_tasks();
-- SELECT check_tasks_due_soon();

-- =============================================================================
-- BIRTHDAY AND ANNIVERSARY REMINDERS
-- =============================================================================

-- Function to check for upcoming birthdays (7 days before, 1 day before, and day of)
CREATE OR REPLACE FUNCTION check_birthdays()
RETURNS void AS $$
DECLARE
  profile_record RECORD;
  days_until_birthday INTEGER;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  FOR profile_record IN 
    SELECT id, full_name, birthday
    FROM public.profiles
    WHERE birthday IS NOT NULL
  LOOP
    -- Calculate days until birthday (considering year)
    days_until_birthday := EXTRACT(DAY FROM (
      DATE_TRUNC('year', CURRENT_DATE) + 
      (EXTRACT(MONTH FROM profile_record.birthday) - 1) * INTERVAL '1 month' +
      (EXTRACT(DAY FROM profile_record.birthday) - 1) * INTERVAL '1 day' - 
      CURRENT_DATE
    ));
    
    -- Adjust if birthday has passed this year
    IF days_until_birthday < 0 THEN
      days_until_birthday := days_until_birthday + 365;
    END IF;
    
    -- Check if we should send a notification
    IF days_until_birthday = 7 THEN
      -- 7 days before
      notification_title := 'Sinh nhật sắp tới';
      notification_message := 'Còn 7 ngày nữa là sinh nhật của ' || profile_record.full_name || ' 🎂';
      
      -- Create notification for all users
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      SELECT id, notification_title, notification_message, 'birthday', profile_record.id
      FROM public.profiles
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = profiles.id
          AND n.type = 'birthday'
          AND n.related_id = profile_record.id
          AND n.created_at::date = CURRENT_DATE
      );
      
    ELSIF days_until_birthday = 1 THEN
      -- 1 day before
      notification_title := 'Sinh nhật ngày mai';
      notification_message := 'Ngày mai là sinh nhật của ' || profile_record.full_name || '! Đừng quên chuẩn bị 🎁';
      
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      SELECT id, notification_title, notification_message, 'birthday', profile_record.id
      FROM public.profiles
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = profiles.id
          AND n.type = 'birthday'
          AND n.related_id = profile_record.id
          AND n.created_at::date = CURRENT_DATE
      );
      
    ELSIF days_until_birthday = 0 THEN
      -- Birthday today
      notification_title := '🎉 Sinh nhật hôm nay!';
      notification_message := 'Hôm nay là sinh nhật của ' || profile_record.full_name || '! Chúc mừng sinh nhật! 🎂🎈';
      
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      SELECT id, notification_title, notification_message, 'birthday', profile_record.id
      FROM public.profiles
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = profiles.id
          AND n.type = 'birthday'
          AND n.related_id = profile_record.id
          AND n.created_at::date = CURRENT_DATE
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for work anniversaries (created_at as join date)
CREATE OR REPLACE FUNCTION check_work_anniversaries()
RETURNS void AS $$
DECLARE
  profile_record RECORD;
  days_until_anniversary INTEGER;
  years_of_service INTEGER;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Use created_at instead of hire_date
  FOR profile_record IN 
    SELECT id, full_name, created_at
    FROM public.profiles
    WHERE created_at IS NOT NULL
  LOOP
    -- Calculate days until anniversary
    days_until_anniversary := EXTRACT(DAY FROM (
      DATE_TRUNC('year', CURRENT_DATE) + 
      (EXTRACT(MONTH FROM profile_record.created_at) - 1) * INTERVAL '1 month' +
      (EXTRACT(DAY FROM profile_record.created_at) - 1) * INTERVAL '1 day' - 
      CURRENT_DATE
    ));
    
    -- Adjust if anniversary has passed this year
    IF days_until_anniversary < 0 THEN
      days_until_anniversary := days_until_anniversary + 365;
    END IF;
    
    -- Calculate years of service
    years_of_service := EXTRACT(YEAR FROM AGE(CURRENT_DATE, profile_record.created_at));
    
    -- Only notify on anniversary day for years >= 1
    IF days_until_anniversary = 0 AND years_of_service >= 1 THEN
      notification_title := '🎊 Kỷ niệm ngày tham gia';
      notification_message := 'Chúc mừng ' || profile_record.full_name || ' tròn ' || years_of_service || ' năm cùng công ty! 🎉';
      
      INSERT INTO public.notifications (user_id, title, message, type, related_id)
      SELECT id, notification_title, notification_message, 'anniversary', profile_record.id
      FROM public.profiles
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = profiles.id
          AND n.type = 'anniversary'
          AND n.related_id = profile_record.id
          AND n.created_at::date = CURRENT_DATE
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get upcoming birthdays/anniversaries for dashboard widget
CREATE OR REPLACE FUNCTION get_upcoming_events(days_ahead INTEGER DEFAULT 30)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  event_type TEXT,
  event_date DATE,
  days_until INTEGER,
  years INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    SELECT 
      p.id AS user_id,
      p.full_name,
      'birthday'::TEXT AS event_type,
      (DATE_TRUNC('year', CURRENT_DATE) + 
        (EXTRACT(MONTH FROM p.birthday) - 1) * INTERVAL '1 month' +
        (EXTRACT(DAY FROM p.birthday) - 1) * INTERVAL '1 day')::DATE AS event_date,
      EXTRACT(DAY FROM (
        DATE_TRUNC('year', CURRENT_DATE) + 
        (EXTRACT(MONTH FROM p.birthday) - 1) * INTERVAL '1 month' +
        (EXTRACT(DAY FROM p.birthday) - 1) * INTERVAL '1 day' - 
        CURRENT_DATE
      ))::INTEGER AS days_until,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.birthday))::INTEGER AS years
    FROM public.profiles p
    WHERE p.birthday IS NOT NULL
      AND EXTRACT(DAY FROM (
        DATE_TRUNC('year', CURRENT_DATE) + 
        (EXTRACT(MONTH FROM p.birthday) - 1) * INTERVAL '1 month' +
        (EXTRACT(DAY FROM p.birthday) - 1) * INTERVAL '1 day' - 
        CURRENT_DATE
      )) BETWEEN 0 AND days_ahead
    
    UNION ALL
    
    SELECT 
      p.id AS user_id,
      p.full_name,
      'anniversary'::TEXT AS event_type,
      (DATE_TRUNC('year', CURRENT_DATE) + 
        (EXTRACT(MONTH FROM p.created_at) - 1) * INTERVAL '1 month' +
        (EXTRACT(DAY FROM p.created_at) - 1) * INTERVAL '1 day')::DATE AS event_date,
      EXTRACT(DAY FROM (
        DATE_TRUNC('year', CURRENT_DATE) + 
        (EXTRACT(MONTH FROM p.created_at) - 1) * INTERVAL '1 month' +
        (EXTRACT(DAY FROM p.created_at) - 1) * INTERVAL '1 day' - 
        CURRENT_DATE
      ))::INTEGER AS days_until,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.created_at))::INTEGER AS years
    FROM public.profiles p
    WHERE p.created_at IS NOT NULL
      AND EXTRACT(DAY FROM (
        DATE_TRUNC('year', CURRENT_DATE) + 
        (EXTRACT(MONTH FROM p.created_at) - 1) * INTERVAL '1 month' +
        (EXTRACT(DAY FROM p.created_at) - 1) * INTERVAL '1 day' - 
        CURRENT_DATE
      )) BETWEEN 0 AND days_ahead
      AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.created_at)) >= 1
  ) AS events
  ORDER BY days_until ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- To manually test the birthday/anniversary functions, run:
-- SELECT check_birthdays();
-- SELECT check_work_anniversaries();
-- SELECT * FROM get_upcoming_events(30);
