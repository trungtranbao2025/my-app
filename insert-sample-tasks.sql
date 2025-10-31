-- Insert sample tasks
-- Run this in Supabase SQL Editor after running insert-sample-projects.sql

-- Get project and user IDs (adjust if needed)
-- Manager: 1857c25b-9847-40b9-88be-ed76c2301c0a
-- Admin: 12716509-f93e-4e04-bce6-0b7e3dd247a3
-- User: f459b983-2e40-479b-b7f3-9ef80cb7c50d

-- Insert tasks for DA001 (Chung cư Sunshine City)
INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent, self_assessment_percent)
SELECT 
  'Khảo sát mặt bằng và đo đạc',
  'Tiến hành khảo sát địa hình, đo đạc chi tiết mặt bằng thi công',
  p.id,
  '1857c25b-9847-40b9-88be-ed76c2301c0a',
  'high',
  'completed',
  '2024-01-20',
  '2024-02-01',
  100,
  95
FROM public.projects p WHERE p.code = 'DA001'
ON CONFLICT DO NOTHING;

INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent)
SELECT 
  'Kiểm tra móng và kết cấu tầng hầm',
  'Giám sát thi công móng cọc khoan nhồi D1000, kiểm tra chất lượng bê tông',
  p.id,
  '12716509-f93e-4e04-bce6-0b7e3dd247a3',
  'urgent',
  'in_progress',
  '2025-10-01',
  '2025-11-15',
  70
FROM public.projects p WHERE p.code = 'DA001'
ON CONFLICT DO NOTHING;

INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent)
SELECT 
  'Nghiệm thu kết cấu tầng 15-20',
  'Kiểm tra chất lượng thi công dầm sàn, cột bê tông tầng 15-20',
  p.id,
  'f459b983-2e40-479b-b7f3-9ef80cb7c50d',
  'high',
  'pending',
  '2025-11-15',
  '2025-12-01',
  0
FROM public.projects p WHERE p.code = 'DA001'
ON CONFLICT DO NOTHING;

-- Insert tasks for DA002 (Cầu Nhật Tân 2)
INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent)
SELECT 
  'Giám sát thi công trụ cầu T1-T3',
  'Kiểm tra chất lượng bê tông, cốt thép trụ cầu chính',
  p.id,
  '1857c25b-9847-40b9-88be-ed76c2301c0a',
  'urgent',
  'in_progress',
  '2025-09-01',
  '2025-10-20',
  45
FROM public.projects p WHERE p.code = 'DA002'
ON CONFLICT DO NOTHING;

INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent)
SELECT 
  'Kiểm tra hệ thống cáp dây văng',
  'Giám sát lắp đặt và căng cáp dây văng, đo độ võng',
  p.id,
  '12716509-f93e-4e04-bce6-0b7e3dd247a3',
  'high',
  'nearly_due',
  '2025-09-15',
  '2025-10-10',
  30
FROM public.projects p WHERE p.code = 'DA002'
ON CONFLICT DO NOTHING;

-- Insert tasks for DA003 (Vincom)
INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent)
SELECT 
  'Thẩm định thiết kế kỹ thuật',
  'Rà soát hồ sơ thiết kế kỹ thuật, bản vẽ thi công',
  p.id,
  'f459b983-2e40-479b-b7f3-9ef80cb7c50d',
  'medium',
  'in_progress',
  '2025-10-01',
  '2025-11-30',
  10
FROM public.projects p WHERE p.code = 'DA003'
ON CONFLICT DO NOTHING;

INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent)
SELECT 
  'Lập kế hoạch giám sát thi công',
  'Xây dựng kế hoạch giám sát chi tiết theo giai đoạn',
  p.id,
  '1857c25b-9847-40b9-88be-ed76c2301c0a',
  'medium',
  'pending',
  '2025-11-01',
  '2025-12-15',
  5
FROM public.projects p WHERE p.code = 'DA003'
ON CONFLICT DO NOTHING;

-- Insert tasks for DA004 (Ecopark)
INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent, self_assessment_percent)
SELECT 
  'Nghiệm thu hệ thống thoát nước',
  'Kiểm tra hệ thống cống thoát nước khu vực A1-A5',
  p.id,
  '12716509-f93e-4e04-bce6-0b7e3dd247a3',
  'high',
  'completed',
  '2024-10-01',
  '2024-11-01',
  100,
  90
FROM public.projects p WHERE p.code = 'DA004'
ON CONFLICT DO NOTHING;

INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent)
SELECT 
  'Giám sát thi công đường nội bộ',
  'Kiểm tra chất lượng nền đường, lớp móng, lớp mặt',
  p.id,
  'f459b983-2e40-479b-b7f3-9ef80cb7c50d',
  'high',
  'in_progress',
  '2025-09-20',
  '2025-10-25',
  80
FROM public.projects p WHERE p.code = 'DA004'
ON CONFLICT DO NOTHING;

-- Insert tasks for DA005 (Nhà máy điện mặt trời)
INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent, self_assessment_percent)
SELECT 
  'Nghiệm thu tổng thể công trình',
  'Kiểm tra toàn bộ hệ thống, lập biên bản nghiệm thu',
  p.id,
  '1857c25b-9847-40b9-88be-ed76c2301c0a',
  'urgent',
  'completed',
  '2024-12-01',
  '2024-12-31',
  100,
  100
FROM public.projects p WHERE p.code = 'DA005'
ON CONFLICT DO NOTHING;

INSERT INTO public.tasks (title, description, project_id, assigned_to, priority, status, start_date, due_date, progress_percent, self_assessment_percent)
SELECT 
  'Lập hồ sơ hoàn công',
  'Tổng hợp toàn bộ hồ sơ, biên bản, bản vẽ hoàn công',
  p.id,
  '12716509-f93e-4e04-bce6-0b7e3dd247a3',
  'high',
  'completed',
  '2024-01-01',
  '2024-01-15',
  100,
  95
FROM public.projects p WHERE p.code = 'DA005'
ON CONFLICT DO NOTHING;
