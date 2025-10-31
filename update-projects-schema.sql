-- Cập nhật bảng projects: Thêm các cột mới và tính toán tự động
-- Chạy script này trong Supabase SQL Editor

-- 1. Xóa trigger và function cũ nếu có (để tránh conflict)
DROP TRIGGER IF EXISTS trigger_calculate_total_days ON projects;
DROP TRIGGER IF EXISTS trigger_calculate_end_date ON projects;
DROP FUNCTION IF EXISTS calculate_total_days();
DROP FUNCTION IF EXISTS calculate_end_date();

-- 2. Thêm các cột mới vào bảng projects
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS total_days INTEGER,
ADD COLUMN IF NOT EXISTS extension_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extension_date DATE;

-- 3. Thêm comment cho các cột
COMMENT ON COLUMN projects.end_date IS 'Ngày hoàn thành dự kiến (tính từ start_date + total_days)';
COMMENT ON COLUMN projects.total_days IS 'Tổng số ngày thực hiện (duration_months * 30 hoặc duration_days)';
COMMENT ON COLUMN projects.extension_count IS 'Số lần gia hạn hợp đồng';
COMMENT ON COLUMN projects.extension_date IS 'Ngày gia hạn hợp đồng gần nhất';

-- 4. Tạo function để tính toán total_days và end_date
CREATE OR REPLACE FUNCTION calculate_project_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Tính total_days từ duration_months hoặc duration_days
  IF NEW.duration_days IS NOT NULL AND NEW.duration_days > 0 THEN
    NEW.total_days := NEW.duration_days;
  ELSIF NEW.duration_months IS NOT NULL AND NEW.duration_months > 0 THEN
    NEW.total_days := NEW.duration_months * 30;
  END IF;
  
  -- Đồng bộ ngược lại duration_days và duration_months
  IF NEW.total_days IS NOT NULL AND NEW.total_days > 0 THEN
    NEW.duration_days := NEW.total_days;
    NEW.duration_months := ROUND(NEW.total_days::NUMERIC / 30);
  END IF;
  
  -- Tính end_date từ start_date + total_days
  IF NEW.start_date IS NOT NULL AND NEW.total_days IS NOT NULL AND NEW.total_days > 0 THEN
    NEW.end_date := NEW.start_date + (NEW.total_days || ' days')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Tạo trigger để tự động tính toán khi INSERT hoặc UPDATE
CREATE TRIGGER trigger_calculate_project_dates
  BEFORE INSERT OR UPDATE 
  ON projects
  FOR EACH ROW
  EXECUTE FUNCTION calculate_project_dates();

-- 6. Cập nhật dữ liệu hiện có (tính toán cho các dự án đã tồn tại)
UPDATE projects
SET 
  total_days = CASE 
    WHEN duration_days IS NOT NULL AND duration_days > 0 THEN duration_days
    WHEN duration_months IS NOT NULL AND duration_months > 0 THEN duration_months * 30
    ELSE NULL
  END
WHERE id IS NOT NULL;

-- Cập nhật end_date dựa trên total_days vừa tính
UPDATE projects
SET 
  end_date = CASE 
    WHEN start_date IS NOT NULL AND total_days IS NOT NULL AND total_days > 0
    THEN start_date + (total_days || ' days')::INTERVAL
    ELSE NULL
  END
WHERE id IS NOT NULL;

-- Đặt extension_count mặc định
UPDATE projects
SET extension_count = 0
WHERE extension_count IS NULL;

-- 7. Tạo index cho các cột mới để tăng hiệu suất truy vấn
CREATE INDEX IF NOT EXISTS idx_projects_end_date ON projects(end_date);
CREATE INDEX IF NOT EXISTS idx_projects_extension_count ON projects(extension_count);

-- 8. Kiểm tra kết quả
SELECT 
  code,
  name,
  start_date,
  duration_months,
  duration_days,
  total_days,
  end_date,
  extension_count,
  extension_date
FROM projects
ORDER BY created_at DESC
LIMIT 10;

-- Hoàn thành!
-- Bây giờ bảng projects đã có:
-- - total_days: Tổng số ngày thực hiện (tự động tính từ duration_months * 30 hoặc duration_days)
-- - end_date: Ngày hoàn thành (tự động tính từ start_date + total_days)
-- - extension_count: Số lần gia hạn hợp đồng
-- - extension_date: Ngày gia hạn gần nhất
-- 
-- Trigger sẽ tự động tính toán khi INSERT hoặc UPDATE bất kỳ trường nào
-- Bạn có thể cập nhật thủ công end_date nếu cần (ví dụ: khi gia hạn)
