-- Ensure reminder notifications use the 'task_reminder' type for proper UI styling
CREATE OR REPLACE FUNCTION public.send_task_reminders()
RETURNS void AS $$
DECLARE
    reminder RECORD;
    message TEXT;
    uid UUID;
BEGIN
    -- Find pending reminders that are due to send
    FOR reminder IN
        SELECT r.*, t.title, t.due_date, t.assigned_to, t.priority, t.id AS t_id
        FROM public.task_reminders r
        JOIN public.tasks t ON t.id = r.task_id
        WHERE r.is_sent = false
          AND r.reminder_time <= NOW()
          AND (t.is_completed = false AND t.status <> 'completed')
    LOOP
        -- Build message by type
        message := CASE reminder.reminder_type
            WHEN 'before_due' THEN 'Công việc "' || reminder.title || '" sẽ đến hạn vào ' || TO_CHAR(reminder.due_date, 'DD/MM/YYYY')
            WHEN 'on_due' THEN 'Công việc "' || reminder.title || '" đến hạn hôm nay!'
            WHEN 'overdue' THEN 'Công việc "' || reminder.title || '" đã quá hạn!'
            WHEN 'recurring' THEN 'Công việc định kỳ "' || reminder.title || '" sẽ bắt đầu sớm'
            ELSE 'Nhắc nhở: ' || reminder.title
        END;

        -- Notify main assignee and all additional assignees
        FOR uid IN (
            SELECT DISTINCT u_id FROM (
                SELECT reminder.assigned_to AS u_id
                UNION ALL
                SELECT ta.user_id FROM public.task_assignees ta WHERE ta.task_id = reminder.t_id
            ) s WHERE u_id IS NOT NULL
        ) LOOP
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type,
                is_read
            ) VALUES (
                uid,
                'Nhắc việc',
                message,
                'task_reminder',
                false
            );
        END LOOP;

        -- mark as sent
        UPDATE public.task_reminders
        SET is_sent = true, sent_at = NOW()
        WHERE id = reminder.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.send_task_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_task_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_task_reminders() TO service_role;
