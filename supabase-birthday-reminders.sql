-- Birthday and Anniversary Reminder Functions
-- Run this in Supabase SQL Editor

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
  -- Use created_at instead of hire_date (since hire_date column doesn't exist)
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_birthdays() TO authenticated;
GRANT EXECUTE ON FUNCTION check_work_anniversaries() TO authenticated;
GRANT EXECUTE ON FUNCTION get_upcoming_events(INTEGER) TO authenticated;

-- Instructions:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Set up a daily cron job to call these functions (using Supabase Edge Functions or pg_cron)
-- 3. For manual testing, run:
--    SELECT check_birthdays();
--    SELECT check_work_anniversaries();
--    SELECT * FROM get_upcoming_events(30);
