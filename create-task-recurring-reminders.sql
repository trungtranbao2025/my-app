-- Thêm tính năng công việc đột xuất/định kỳ và hệ thống nhắc việc
-- Chạy script này trong Supabase SQL Editor

-- Tạo enum cho loại công việc
DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('one_time', 'recurring');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tạo enum cho tần suất công việc định kỳ
DO $$ BEGIN
    CREATE TYPE recurrence_frequency AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Thêm các cột mới vào bảng tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS task_type task_type DEFAULT 'one_time',
ADD COLUMN IF NOT EXISTS recurrence_frequency recurrence_frequency,
ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
ADD COLUMN IF NOT EXISTS last_recurrence_date DATE,
ADD COLUMN IF NOT EXISTS next_recurrence_date DATE,
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id),
ADD COLUMN IF NOT EXISTS recurrence_weekday INTEGER CHECK (recurrence_weekday BETWEEN 0 AND 6),
ADD COLUMN IF NOT EXISTS recurrence_month_day INTEGER CHECK (recurrence_month_day BETWEEN 1 AND 31),
ADD COLUMN IF NOT EXISTS recurrence_quarter INTEGER CHECK (recurrence_quarter BETWEEN 1 AND 4),
ADD COLUMN IF NOT EXISTS recurrence_quarter_month_index INTEGER CHECK (recurrence_quarter_month_index BETWEEN 1 AND 3),
ADD COLUMN IF NOT EXISTS recurrence_counter INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS report_cycle_number INTEGER;

-- Ensure FK on parent_task_id does not block deletion of parent tasks
-- Switch to ON DELETE SET NULL (idempotent)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'tasks' AND c.conname = 'tasks_parent_task_id_fkey'
    ) THEN
        ALTER TABLE public.tasks DROP CONSTRAINT tasks_parent_task_id_fkey;
    END IF;
    ALTER TABLE public.tasks
        ADD CONSTRAINT tasks_parent_task_id_fkey
        FOREIGN KEY (parent_task_id)
        REFERENCES public.tasks(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
END $$;

-- Helpful index for parent lookups
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);

-- Tạo bảng task_reminders để lưu cấu hình nhắc việc
CREATE TABLE IF NOT EXISTS public.task_reminders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL, -- 'before_due', 'on_due', 'overdue', 'recurring'
    reminder_time TIMESTAMPTZ NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo bảng reminder_settings để lưu cấu hình mặc định
CREATE TABLE IF NOT EXISTS public.reminder_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    priority task_priority,
    status task_status,
    task_type task_type,
    -- Cấu hình thời gian nhắc (JSON)
    -- Ví dụ: {"before_due_hours": [24, 48], "overdue_hours": [1, 24, 72]}
    reminder_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo index
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON public.tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_next_recurrence ON public.tasks(next_recurrence_date);
CREATE INDEX IF NOT EXISTS idx_task_reminders_time ON public.task_reminders(reminder_time) WHERE is_sent = false;
CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON public.task_reminders(task_id);

-- RLS Policies cho task_reminders
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view reminders for their tasks" ON public.task_reminders;
CREATE POLICY "Users can view reminders for their tasks"
ON public.task_reminders FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = task_reminders.task_id
        AND (
            t.assigned_to = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.task_assignees ta
                WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
            )
            OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('manager', 'admin')
        )
    )
);

DROP POLICY IF EXISTS "System can manage reminders" ON public.task_reminders;
CREATE POLICY "System can manage reminders"
ON public.task_reminders FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS Policies cho reminder_settings
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view reminder settings" ON public.reminder_settings;
CREATE POLICY "Everyone can view reminder settings"
ON public.reminder_settings FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Managers can manage reminder settings" ON public.reminder_settings;
CREATE POLICY "Managers can manage reminder settings"
ON public.reminder_settings FOR ALL
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
)
WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Hàm tính toán ngày định kỳ tiếp theo
-- Helper: robustly detect PDF files by MIME or filename extension
CREATE OR REPLACE FUNCTION is_pdf_attachment(file_type TEXT, file_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        COALESCE(file_type, '') ILIKE 'application/pdf%'
        OR COALESCE(file_name, '') ILIKE '%.pdf'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Hàm tính toán ngày định kỳ tiếp theo
CREATE OR REPLACE FUNCTION calculate_next_recurrence(
    start_date DATE,
    frequency recurrence_frequency,
    interval_count INTEGER
)
RETURNS DATE AS $$
BEGIN
    RETURN CASE frequency
        WHEN 'daily' THEN start_date + (interval_count || ' days')::INTERVAL
        WHEN 'weekly' THEN start_date + (interval_count || ' weeks')::INTERVAL
        WHEN 'monthly' THEN start_date + (interval_count || ' months')::INTERVAL
        WHEN 'quarterly' THEN start_date + ((interval_count * 3) || ' months')::INTERVAL
        WHEN 'yearly' THEN start_date + (interval_count || ' years')::INTERVAL
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Next WEEKLY anchored by specific weekday (0=Sun..6=Sat per Postgres)
CREATE OR REPLACE FUNCTION next_weekly_anchored(
    base_date DATE,
    interval_count INTEGER,
    weekday INT
)
RETURNS DATE AS $$
DECLARE
    curr_dow INT;
    target_dow INT;
    days_ahead INT;
BEGIN
    IF weekday IS NULL THEN
        RETURN base_date + (interval_count || ' weeks')::INTERVAL;
    END IF;
    curr_dow := EXTRACT(DOW FROM base_date)::INT;
    target_dow := ((weekday % 7) + 7) % 7;
    days_ahead := (target_dow - curr_dow + 7) % 7;
    IF days_ahead = 0 THEN
        RETURN (base_date + (interval_count * 7) * INTERVAL '1 day')::DATE;
    ELSE
        RETURN (base_date + (days_ahead + 7 * GREATEST(interval_count-1,0)) * INTERVAL '1 day')::DATE;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Next QUARTERLY anchored by quarter (1-4), month index in quarter (1-3), and day-of-month (1-31)
CREATE OR REPLACE FUNCTION next_quarterly_anchored(
    base_date DATE,
    interval_count INTEGER,
    quarter INT,
    month_in_quarter INT,
    day_in_month INT
)
RETURNS DATE AS $$
DECLARE
    y INT := EXTRACT(YEAR FROM base_date)::INT;
    target_month INT;
    cand DATE;
    last_day DATE;
BEGIN
    IF quarter IS NULL OR month_in_quarter IS NULL OR day_in_month IS NULL THEN
        RETURN (base_date + ((interval_count * 3) || ' months')::INTERVAL)::DATE;
    END IF;

    -- Compute initial candidate in current year
    target_month := (quarter - 1) * 3 + month_in_quarter; -- 1..12
    last_day := (DATE_TRUNC('month', MAKE_DATE(y, target_month, 1)) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    cand := MAKE_DATE(y, target_month, LEAST(day_in_month, EXTRACT(DAY FROM last_day)::INT));

    -- Advance in steps of interval_count quarters until >= base_date
    WHILE cand < base_date LOOP
        cand := (cand + (interval_count * 3) * INTERVAL '1 month')::DATE;
        -- Clamp day in the new month
        last_day := (DATE_TRUNC('month', cand) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
        cand := MAKE_DATE(EXTRACT(YEAR FROM cand)::INT, EXTRACT(MONTH FROM cand)::INT, LEAST(day_in_month, EXTRACT(DAY FROM last_day)::INT));
    END LOOP;

    RETURN cand;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Next MONTHLY anchored by specific day-of-month (clamped to month length)
CREATE OR REPLACE FUNCTION next_monthly_anchored(
    base_date DATE,
    interval_count INTEGER,
    month_day INT
)
RETURNS DATE AS $$
DECLARE
    target_month_start DATE;
    last_day_of_target DATE;
    day_in_month INT;
BEGIN
    IF month_day IS NULL THEN
        RETURN (base_date + (interval_count || ' months')::INTERVAL)::DATE;
    END IF;
    target_month_start := date_trunc('month', base_date)::DATE + (interval_count || ' months')::INTERVAL;
    last_day_of_target := (date_trunc('month', target_month_start) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    day_in_month := LEAST(month_day, EXTRACT(DAY FROM last_day_of_target)::INT);
    RETURN (date_trunc('month', target_month_start)::DATE + (day_in_month - 1) * INTERVAL '1 day')::DATE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Normalize anchors and initial next_recurrence_date on insert/update
-- Drop trigger và function nếu đã tồn tại
DROP TRIGGER IF EXISTS trigger_set_recurring_anchors ON public.tasks;
DROP FUNCTION IF EXISTS set_recurring_anchors() CASCADE;

CREATE OR REPLACE FUNCTION set_recurring_anchors()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.task_type = 'recurring' THEN
        IF NEW.recurrence_frequency = 'weekly' THEN
            IF NEW.recurrence_weekday IS NULL AND NEW.due_date IS NOT NULL THEN
                NEW.recurrence_weekday := EXTRACT(DOW FROM NEW.due_date)::INT;
            END IF;
        ELSIF NEW.recurrence_frequency = 'monthly' THEN
            IF NEW.recurrence_month_day IS NULL AND NEW.due_date IS NOT NULL THEN
                NEW.recurrence_month_day := EXTRACT(DAY FROM NEW.due_date)::INT;
            END IF;
        ELSIF NEW.recurrence_frequency = 'quarterly' THEN
            IF NEW.recurrence_quarter IS NULL AND NEW.due_date IS NOT NULL THEN
                NEW.recurrence_quarter := ((EXTRACT(MONTH FROM NEW.due_date)::INT - 1) / 3) + 1;
            END IF;
            IF NEW.recurrence_quarter_month_index IS NULL AND NEW.due_date IS NOT NULL THEN
                NEW.recurrence_quarter_month_index := ((EXTRACT(MONTH FROM NEW.due_date)::INT - 1) % 3) + 1;
            END IF;
            IF NEW.recurrence_month_day IS NULL AND NEW.due_date IS NOT NULL THEN
                NEW.recurrence_month_day := EXTRACT(DAY FROM NEW.due_date)::INT;
            END IF;
        END IF;

        -- Initialize next_recurrence_date to upcoming anchor if not set
        IF NEW.next_recurrence_date IS NULL THEN
            IF NEW.recurrence_frequency = 'weekly' AND NEW.recurrence_weekday IS NOT NULL THEN
                -- choose the next occurrence >= CURRENT_DATE
                NEW.next_recurrence_date := next_weekly_anchored(GREATEST(CURRENT_DATE, COALESCE(NEW.due_date, CURRENT_DATE)), 1, NEW.recurrence_weekday);
            ELSIF NEW.recurrence_frequency = 'monthly' AND NEW.recurrence_month_day IS NOT NULL THEN
                NEW.next_recurrence_date := next_monthly_anchored(GREATEST(CURRENT_DATE, COALESCE(NEW.due_date, CURRENT_DATE)), 0, NEW.recurrence_month_day);
                IF NEW.next_recurrence_date < CURRENT_DATE THEN
                    NEW.next_recurrence_date := next_monthly_anchored(CURRENT_DATE, 1, NEW.recurrence_month_day);
                END IF;
            ELSIF NEW.recurrence_frequency = 'quarterly' AND NEW.recurrence_quarter IS NOT NULL AND NEW.recurrence_quarter_month_index IS NOT NULL AND NEW.recurrence_month_day IS NOT NULL THEN
                NEW.next_recurrence_date := next_quarterly_anchored(GREATEST(CURRENT_DATE, COALESCE(NEW.due_date, CURRENT_DATE)), 1, NEW.recurrence_quarter, NEW.recurrence_quarter_month_index, NEW.recurrence_month_day);
            ELSIF NEW.due_date IS NOT NULL THEN
                NEW.next_recurrence_date := NEW.due_date;
            ELSE
                NEW.next_recurrence_date := CURRENT_DATE;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_recurring_anchors
    BEFORE INSERT OR UPDATE OF due_date, task_type, recurrence_frequency, recurrence_weekday, recurrence_month_day ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_recurring_anchors();

-- Hàm tạo reminder tự động khi tạo/cập nhật task
-- Drop trigger và function nếu đã tồn tại
DROP TRIGGER IF EXISTS trigger_create_task_reminders ON public.tasks;
DROP FUNCTION IF EXISTS create_task_reminders() CASCADE;

CREATE OR REPLACE FUNCTION create_task_reminders()
RETURNS TRIGGER AS $$
DECLARE
    setting RECORD;
    reminder_config JSONB;
    before_due_hours INTEGER[];
    overdue_hours INTEGER[];
    hour_val INTEGER;
BEGIN
    -- Xóa reminders cũ chưa gửi
    DELETE FROM public.task_reminders 
    WHERE task_id = NEW.id AND is_sent = false;

    -- Tìm reminder setting phù hợp
    SELECT * INTO setting
    FROM public.reminder_settings
    WHERE is_active = true
    AND (priority IS NULL OR priority = NEW.priority)
    AND (status IS NULL OR status = NEW.status)
    AND (task_type IS NULL OR task_type = NEW.task_type)
    ORDER BY 
        (CASE WHEN priority = NEW.priority THEN 1 ELSE 0 END) +
        (CASE WHEN status = NEW.status THEN 1 ELSE 0 END) +
        (CASE WHEN task_type = NEW.task_type THEN 1 ELSE 0 END) DESC
    LIMIT 1;

    -- Nếu không tìm thấy setting, dùng mặc định
    IF setting IS NULL THEN
        reminder_config := '{"before_due_hours": [24], "overdue_hours": [24]}'::jsonb;
    ELSE
        reminder_config := setting.reminder_config;
    END IF;

    -- Tạo reminders trước deadline
    IF NEW.due_date IS NOT NULL AND reminder_config ? 'before_due_hours' THEN
        before_due_hours := ARRAY(SELECT jsonb_array_elements_text(reminder_config->'before_due_hours')::INTEGER);
        FOREACH hour_val IN ARRAY before_due_hours
        LOOP
            INSERT INTO public.task_reminders (task_id, reminder_type, reminder_time)
            VALUES (
                NEW.id,
                'before_due',
                (NEW.due_date::TIMESTAMP - (hour_val || ' hours')::INTERVAL)::TIMESTAMPTZ
            );
        END LOOP;
    END IF;

    -- Tạo reminder vào đúng ngày deadline
    IF NEW.due_date IS NOT NULL THEN
        INSERT INTO public.task_reminders (task_id, reminder_type, reminder_time)
        VALUES (
            NEW.id,
            'on_due',
            NEW.due_date::TIMESTAMPTZ
        );
    END IF;

    -- Tạo reminders cho công việc định kỳ
    IF NEW.task_type = 'recurring' AND NEW.next_recurrence_date IS NOT NULL THEN
        INSERT INTO public.task_reminders (task_id, reminder_type, reminder_time)
        VALUES (
            NEW.id,
            'recurring',
            (NEW.next_recurrence_date - INTERVAL '1 day')::TIMESTAMPTZ
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hàm tự động tạo task mới cho công việc định kỳ
-- Drop function nếu signature khác
DROP FUNCTION IF EXISTS auto_create_recurring_task();

CREATE OR REPLACE FUNCTION auto_create_recurring_task()
RETURNS void AS $$
DECLARE
    task RECORD;
    new_task_id UUID;
BEGIN
    -- Tìm các task định kỳ cần tạo bản sao
        FOR task IN
                SELECT *
                FROM public.tasks
                WHERE task_type = 'recurring' AND parent_task_id IS NULL
        AND next_recurrence_date <= CURRENT_DATE
        AND (recurrence_end_date IS NULL OR next_recurrence_date <= recurrence_end_date)
        AND status != 'cancelled'
        AND EXISTS (
            SELECT 1 FROM public.projects p WHERE p.id = tasks.project_id AND p.status != 'completed'
        )
    LOOP
                -- Xác định start/due theo quy tắc tuần/tháng (mặc định: anchor)
                DECLARE
                    new_start DATE;
                    new_due DATE;
                BEGIN
                    IF task.recurrence_frequency = 'weekly' AND task.recurrence_weekday IS NOT NULL THEN
                        new_start := COALESCE(task.start_date, task.next_recurrence_date) + INTERVAL '7 days';
                        new_due := COALESCE(task.due_date, task.next_recurrence_date) + INTERVAL '7 days';
                    ELSIF task.recurrence_frequency = 'monthly' AND task.recurrence_month_day IS NOT NULL THEN
                        new_due := next_monthly_anchored(GREATEST(CURRENT_DATE, COALESCE(task.next_recurrence_date, COALESCE(task.due_date, CURRENT_DATE))), 0, task.recurrence_month_day);
                        IF new_due < CURRENT_DATE THEN
                            new_due := next_monthly_anchored(CURRENT_DATE, 1, task.recurrence_month_day);
                        END IF;
                        new_start := COALESCE(task.due_date, task.next_recurrence_date) + INTERVAL '1 day';
                    ELSE
                        new_start := COALESCE(task.next_recurrence_date, task.due_date, CURRENT_DATE);
                        new_due := new_start;
                    END IF;

                -- Tạo task mới (vẫn là định kỳ)
        INSERT INTO public.tasks (
            project_id,
            title,
            description,
            assigned_to,
            start_date,
            due_date,
            priority,
            status,
            task_type,
                        parent_task_id,
                        report_cycle_number,
                        recurrence_frequency,
                        recurrence_interval,
                        recurrence_weekday,
                        recurrence_month_day,
                        recurrence_quarter,
                        recurrence_quarter_month_index,
                        recurrence_end_date
        ) VALUES (
            task.project_id,
            task.title,
            task.description,
            task.assigned_to,
                        new_start,
                        new_due,
            task.priority,
            'pending',
                        'recurring',
            task.id,
                        (COALESCE(task.recurrence_counter,0) + 1),
                        task.recurrence_frequency,
                        task.recurrence_interval,
                        task.recurrence_weekday,
                        task.recurrence_month_day,
                        task.recurrence_quarter,
                        task.recurrence_quarter_month_index,
                        task.recurrence_end_date
        ) RETURNING id INTO new_task_id;

                END;

        -- Cập nhật task gốc
        UPDATE public.tasks
        SET 
            last_recurrence_date = next_recurrence_date,
            next_recurrence_date = CASE 
                WHEN recurrence_frequency = 'weekly' AND recurrence_weekday IS NOT NULL THEN 
                    next_weekly_anchored(next_recurrence_date, recurrence_interval, recurrence_weekday)
                WHEN recurrence_frequency = 'monthly' AND recurrence_month_day IS NOT NULL THEN 
                    next_monthly_anchored(next_recurrence_date, recurrence_interval, recurrence_month_day)
                WHEN recurrence_frequency = 'quarterly' AND recurrence_quarter IS NOT NULL AND recurrence_quarter_month_index IS NOT NULL AND recurrence_month_day IS NOT NULL THEN
                    next_quarterly_anchored(next_recurrence_date, recurrence_interval, recurrence_quarter, recurrence_quarter_month_index, recurrence_month_day)
                ELSE calculate_next_recurrence(next_recurrence_date, recurrence_frequency, recurrence_interval)
            END,
            recurrence_counter = COALESCE(recurrence_counter,0) + 1,
            updated_at = NOW()
        WHERE id = task.id;

        -- Tạo thông báo
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            is_read
        ) VALUES (
            task.assigned_to,
            'Công việc định kỳ mới',
            'Công việc "' || task.title || '" đã được tạo tự động theo lịch định kỳ',
            'task',
            false
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enforcement: Must upload PDF report before allowing completion of weekly/monthly recurring tasks
-- Drop trigger và function nếu đã tồn tại
DROP TRIGGER IF EXISTS trigger_enforce_pdf_before_completion ON public.tasks;
DROP FUNCTION IF EXISTS enforce_pdf_before_completion() CASCADE;

CREATE OR REPLACE FUNCTION enforce_pdf_before_completion()
RETURNS TRIGGER AS $$
DECLARE
    needs_pdf BOOLEAN := false;
    has_pdf BOOLEAN := false;
BEGIN
    -- Only enforce when attempting to complete
    IF (
        COALESCE(OLD.is_completed, false) = false AND COALESCE(NEW.is_completed, false) = true
    ) OR (
        OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed'
    ) THEN
        -- Require for weekly/monthly recurring tasks
        needs_pdf := (NEW.task_type = 'recurring' AND NEW.recurrence_frequency IN ('weekly','monthly'));

        IF needs_pdf THEN
                        SELECT EXISTS (
                                SELECT 1 FROM public.task_attachments a
                                WHERE a.task_id = NEW.id
                                    AND is_pdf_attachment(a.file_type, a.file_name)
                        ) INTO has_pdf;

            IF NOT has_pdf THEN
                RAISE EXCEPTION 'Vui lòng tải báo cáo PDF trước khi hoàn thành công việc định kỳ.'
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hàm gửi reminder và tạo thông báo
-- Drop function nếu signature khác
DROP FUNCTION IF EXISTS send_task_reminders();

CREATE OR REPLACE FUNCTION send_task_reminders()
RETURNS void AS $$
DECLARE
    reminder RECORD;
    message TEXT;
    uid UUID;
BEGIN
    -- Tìm các reminder cần gửi
    FOR reminder IN
        SELECT r.*, t.title, t.due_date, t.assigned_to, t.priority, t.id AS t_id
        FROM public.task_reminders r
        JOIN public.tasks t ON t.id = r.task_id
        WHERE r.is_sent = false
        AND r.reminder_time <= NOW()
        AND (t.is_completed = false AND t.status <> 'completed')
    LOOP
        -- Tạo message tùy loại reminder
        message := CASE reminder.reminder_type
            WHEN 'before_due' THEN 'Công việc "' || reminder.title || '" sẽ đến hạn vào ' || TO_CHAR(reminder.due_date, 'DD/MM/YYYY')
            WHEN 'on_due' THEN 'Công việc "' || reminder.title || '" đến hạn hôm nay!'
            WHEN 'overdue' THEN 'Công việc "' || reminder.title || '" đã quá hạn!'
            WHEN 'recurring' THEN 'Công việc định kỳ "' || reminder.title || '" sẽ bắt đầu sớm'
            ELSE 'Nhắc nhở: ' || reminder.title
        END;

        -- Tạo notification cho tất cả người thực hiện (chính + phụ)
        FOR uid IN
            (
                SELECT DISTINCT u_id FROM (
                    SELECT reminder.assigned_to AS u_id
                    UNION ALL
                    SELECT ta.user_id FROM public.task_assignees ta WHERE ta.task_id = reminder.t_id
                ) s
                WHERE u_id IS NOT NULL
            )
        LOOP
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

        -- Đánh dấu đã gửi
        UPDATE public.task_reminders
        SET is_sent = true, sent_at = NOW()
        WHERE id = reminder.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Khi công việc định kỳ được hoàn thành VÀ đã có PDF báo cáo, ngừng nhắc việc
-- và tự động tạo công việc theo dõi cho kỳ tiếp theo (ngay lập tức),
-- đồng thời cập nhật next_recurrence_date sang kỳ tiếp theo nữa để tránh trùng với job tự động.
-- Drop trigger và function nếu đã tồn tại
DROP TRIGGER IF EXISTS trigger_complete_recurring_finalize ON public.tasks;
DROP FUNCTION IF EXISTS complete_recurring_task_finalize() CASCADE;

CREATE OR REPLACE FUNCTION complete_recurring_task_finalize()
RETURNS TRIGGER AS $$
DECLARE
    has_pdf BOOLEAN;
    next_date DATE;
    next_after DATE;
    next_task_id UUID;
BEGIN
    -- Chỉ xử lý khi chuyển trạng thái sang hoàn thành
    IF (
        COALESCE(OLD.is_completed, false) = false AND COALESCE(NEW.is_completed, false) = true
    ) OR (
        OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed'
    ) THEN

        -- Ngừng tất cả reminders chưa gửi của task này
        UPDATE public.task_reminders
        SET is_sent = true, sent_at = NOW()
        WHERE task_id = NEW.id AND is_sent = false;

        -- Nếu là công việc định kỳ thì kiểm tra PDF và tạo kỳ tiếp theo
        IF NEW.task_type = 'recurring' THEN
            SELECT EXISTS (
                SELECT 1 FROM public.task_attachments a
                WHERE a.task_id = NEW.id
                  AND a.file_type = 'application/pdf'
            ) INTO has_pdf;

            IF has_pdf THEN
                -- Tính ngày kỳ tiếp theo (sau khi hoàn thành)
                IF NEW.recurrence_frequency = 'weekly' AND NEW.recurrence_weekday IS NOT NULL THEN
                    next_date := next_weekly_anchored(GREATEST(CURRENT_DATE, COALESCE(NEW.next_recurrence_date, COALESCE(NEW.due_date, CURRENT_DATE))), GREATEST(NEW.recurrence_interval,1), NEW.recurrence_weekday);
                    next_after := next_weekly_anchored(next_date, GREATEST(NEW.recurrence_interval,1), NEW.recurrence_weekday);
                ELSIF NEW.recurrence_frequency = 'monthly' AND NEW.recurrence_month_day IS NOT NULL THEN
                    next_date := next_monthly_anchored(GREATEST(CURRENT_DATE, COALESCE(NEW.next_recurrence_date, COALESCE(NEW.due_date, CURRENT_DATE))), GREATEST(NEW.recurrence_interval-1,0), NEW.recurrence_month_day);
                    IF next_date < CURRENT_DATE THEN
                        next_date := next_monthly_anchored(CURRENT_DATE, GREATEST(NEW.recurrence_interval,1), NEW.recurrence_month_day);
                    END IF;
                    next_after := next_monthly_anchored(next_date, GREATEST(NEW.recurrence_interval,1), NEW.recurrence_month_day);
                ELSIF NEW.recurrence_frequency = 'quarterly' AND NEW.recurrence_quarter IS NOT NULL AND NEW.recurrence_quarter_month_index IS NOT NULL AND NEW.recurrence_month_day IS NOT NULL THEN
                    next_date := next_quarterly_anchored(GREATEST(CURRENT_DATE, COALESCE(NEW.next_recurrence_date, COALESCE(NEW.due_date, CURRENT_DATE))), GREATEST(NEW.recurrence_interval,1), NEW.recurrence_quarter, NEW.recurrence_quarter_month_index, NEW.recurrence_month_day);
                    next_after := next_quarterly_anchored(next_date, GREATEST(NEW.recurrence_interval,1), NEW.recurrence_quarter, NEW.recurrence_quarter_month_index, NEW.recurrence_month_day);
                ELSE
                    next_date := calculate_next_recurrence(GREATEST(CURRENT_DATE, COALESCE(NEW.next_recurrence_date, COALESCE(NEW.due_date, CURRENT_DATE))), NEW.recurrence_frequency, GREATEST(NEW.recurrence_interval,1));
                    next_after := calculate_next_recurrence(next_date, NEW.recurrence_frequency, GREATEST(NEW.recurrence_interval,1));
                END IF;

                                -- Nếu có đặt ngày kết thúc chu kỳ, chỉ tạo khi chưa quá hạn
                                IF NEW.recurrence_end_date IS NULL OR next_date <= NEW.recurrence_end_date THEN
                                        -- Tính start/due theo quy tắc tuần/tháng, mặc định dùng anchor
                                        DECLARE
                                            f_start DATE;
                                            f_due DATE;
                                        BEGIN
                                            IF NEW.recurrence_frequency = 'weekly' AND NEW.recurrence_weekday IS NOT NULL THEN
                                                f_start := COALESCE(NEW.start_date, NEW.due_date, next_date) + INTERVAL '7 days';
                                                f_due := COALESCE(NEW.due_date, next_date) + INTERVAL '7 days';
                                            ELSIF NEW.recurrence_frequency = 'monthly' AND NEW.recurrence_month_day IS NOT NULL THEN
                                                f_due := next_monthly_anchored(GREATEST(CURRENT_DATE, COALESCE(NEW.next_recurrence_date, COALESCE(NEW.due_date, CURRENT_DATE))), 0, NEW.recurrence_month_day);
                                                IF f_due < CURRENT_DATE THEN
                                                    f_due := next_monthly_anchored(CURRENT_DATE, 1, NEW.recurrence_month_day);
                                                END IF;
                                                f_start := COALESCE(NEW.due_date, next_date) + INTERVAL '1 day';
                                            ELSE
                                                f_start := next_date;
                                                f_due := next_date;
                                            END IF;

                                            INSERT INTO public.tasks (
                                                    project_id, title, description, assigned_to,
                                                    start_date, due_date, priority, status, task_type, parent_task_id, report_cycle_number,
                                                    recurrence_frequency, recurrence_interval, recurrence_weekday, recurrence_month_day,
                                                    recurrence_quarter, recurrence_quarter_month_index, recurrence_end_date
                                            ) VALUES (
                                                    NEW.project_id, NEW.title, NEW.description, NEW.assigned_to,
                                                    f_start, f_due, NEW.priority, 'pending', 'recurring', NEW.id,
                                                    (COALESCE(NEW.recurrence_counter,0) + 1),
                                                    NEW.recurrence_frequency, NEW.recurrence_interval, NEW.recurrence_weekday, NEW.recurrence_month_day,
                                                    NEW.recurrence_quarter, NEW.recurrence_quarter_month_index, NEW.recurrence_end_date
                                            ) RETURNING id INTO next_task_id;
                                            -- Copy multi-assignees if table exists
                                            BEGIN
                                                PERFORM 1 FROM pg_class WHERE relname = 'task_assignees' AND relnamespace = 'public'::regnamespace;
                                                IF FOUND THEN
                                                    INSERT INTO public.task_assignees (task_id, user_id, role_in_task)
                                                    SELECT next_task_id, user_id, role_in_task
                                                    FROM public.task_assignees WHERE task_id = NEW.id
                                                    ON CONFLICT DO NOTHING;
                                                END IF;
                                            EXCEPTION WHEN others THEN
                                                -- ignore copy errors to avoid breaking completion flow
                                                NULL;
                                            END;
                                        END;

                    -- Cập nhật mốc của task định kỳ để tránh job tự động tạo trùng
                    UPDATE public.tasks
                    SET last_recurrence_date = next_date,
                        next_recurrence_date = next_after,
                        recurrence_counter = COALESCE(recurrence_counter,0) + 1,
                        updated_at = NOW()
                    WHERE id = NEW.id;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE TRIGGER trigger_create_task_reminders
    AFTER INSERT OR UPDATE OF due_date, priority, status, task_type ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION create_task_reminders();

-- Trigger: enforce PDF before marking completion for recurring weekly/monthly tasks
CREATE TRIGGER trigger_enforce_pdf_before_completion
    BEFORE UPDATE OF is_completed, status ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION enforce_pdf_before_completion();

-- Trigger: finalize recurring completion (stop reminders + create next period)
CREATE TRIGGER trigger_complete_recurring_finalize
    AFTER UPDATE OF is_completed, status ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION complete_recurring_task_finalize();

-- Auto-uncomplete task if the last PDF report is removed
-- Drop trigger và function nếu đã tồn tại
DROP TRIGGER IF EXISTS trg_task_pdf_deleted ON public.task_attachments;
DROP FUNCTION IF EXISTS handle_pdf_attachment_deletion() CASCADE;

CREATE OR REPLACE FUNCTION handle_pdf_attachment_deletion()
RETURNS TRIGGER AS $$
DECLARE
    remaining_pdfs INT;
BEGIN
    IF is_pdf_attachment(OLD.file_type, OLD.file_name) THEN
        SELECT COUNT(1) INTO remaining_pdfs
        FROM public.task_attachments
        WHERE task_id = OLD.task_id AND is_pdf_attachment(file_type, file_name);

        IF COALESCE(remaining_pdfs,0) = 0 THEN
            UPDATE public.tasks
            SET is_completed = false,
                    status = CASE WHEN status = 'completed' THEN 'in_progress' ELSE status END,
                    updated_at = NOW()
            WHERE id = OLD.task_id AND (is_completed = true OR status = 'completed');
            -- Note: this UPDATE will trigger create_task_reminders() due to status change
        END IF;
    END IF;
    RETURN NULL; -- AFTER DELETE trigger, no row to return
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_pdf_deleted
    AFTER DELETE ON public.task_attachments
    FOR EACH ROW
    EXECUTE FUNCTION handle_pdf_attachment_deletion();

-- Also handle converting a PDF attachment into a non-PDF via update
-- Drop trigger và function nếu đã tồn tại
DROP TRIGGER IF EXISTS trg_task_pdf_filetype_update ON public.task_attachments;
DROP FUNCTION IF EXISTS handle_pdf_attachment_filetype_update() CASCADE;

CREATE OR REPLACE FUNCTION handle_pdf_attachment_filetype_update()
RETURNS TRIGGER AS $$
DECLARE
    remaining_pdfs INT;
BEGIN
    IF is_pdf_attachment(OLD.file_type, OLD.file_name) AND NOT is_pdf_attachment(NEW.file_type, NEW.file_name) THEN
        SELECT COUNT(1) INTO remaining_pdfs
        FROM public.task_attachments
        WHERE task_id = NEW.task_id AND is_pdf_attachment(file_type, file_name);

        IF COALESCE(remaining_pdfs,0) = 0 THEN
            UPDATE public.tasks
            SET is_completed = false,
                    status = CASE WHEN status = 'completed' THEN 'in_progress' ELSE status END,
                    updated_at = NOW()
            WHERE id = NEW.task_id AND (is_completed = true OR status = 'completed');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_pdf_filetype_update
    AFTER UPDATE OF file_type ON public.task_attachments
    FOR EACH ROW
    EXECUTE FUNCTION handle_pdf_attachment_filetype_update();

-- Insert default reminder settings
INSERT INTO public.reminder_settings (name, description, priority, reminder_config) VALUES
('High Priority Tasks', 'Nhắc việc cho công việc ưu tiên cao', 'high', 
 '{"before_due_hours": [48, 24, 12, 6], "overdue_hours": [1, 6, 24]}'::jsonb),
('Medium Priority Tasks', 'Nhắc việc cho công việc ưu tiên trung bình', 'medium',
 '{"before_due_hours": [24, 12], "overdue_hours": [24]}'::jsonb),
('Low Priority Tasks', 'Nhắc việc cho công việc ưu tiên thấp', 'low',
 '{"before_due_hours": [24], "overdue_hours": [48]}'::jsonb),
('Recurring Tasks', 'Nhắc việc cho công việc định kỳ', NULL,
 '{"before_due_hours": [24], "recurring_before_hours": [24]}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Comments
COMMENT ON COLUMN public.tasks.task_type IS 'Loại công việc: one_time (đột xuất) hoặc recurring (định kỳ)';
COMMENT ON COLUMN public.tasks.recurrence_frequency IS 'Tần suất lặp lại: daily, weekly, monthly, quarterly, yearly';
COMMENT ON COLUMN public.tasks.recurrence_interval IS 'Khoảng cách lặp lại (ví dụ: 2 tuần)';
COMMENT ON COLUMN public.tasks.next_recurrence_date IS 'Ngày tạo task tiếp theo';
COMMENT ON TABLE public.task_reminders IS 'Lưu trữ các lời nhắc cho công việc';
COMMENT ON TABLE public.reminder_settings IS 'Cấu hình mặc định cho nhắc việc theo loại, cấp độ, trạng thái';
