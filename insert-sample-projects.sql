-- Insert sample projects
-- Run this in Supabase SQL Editor to create demo data
-- Uses INSERT ON CONFLICT to handle existing records

-- Insert or update sample projects
INSERT INTO public.projects (code, name, description, location, start_date, duration_months, manager_id, status, budget, contract_number)
VALUES 
('DA001', 'Dự án Chung cư Sunshine City', 'Tư vấn giám sát thi công chung cư cao cấp 40 tầng', 'Hà Nội', '2024-01-15', 24, '1857c25b-9847-40b9-88be-ed76c2301c0a', 'active', 150000000000, 'HĐ-2024-001'),
('DA002', 'Dự án Cầu Nhật Tân 2', 'Giám sát thi công cầu dây văng qua sông Hồng', 'Hà Nội', '2024-03-01', 36, '1857c25b-9847-40b9-88be-ed76c2301c0a', 'active', 2500000000000, 'HĐ-2024-002'),
('DA003', 'Trung tâm thương mại Vincom', 'Tư vấn thiết kế và giám sát thi công TTTM', 'TP.HCM', '2024-06-01', 18, '1857c25b-9847-40b9-88be-ed76c2301c0a', 'planning', 300000000000, 'HĐ-2024-003'),
('DA004', 'Khu đô thị mới Ecopark', 'Giám sát hạ tầng kỹ thuật khu đô thị', 'Hưng Yên', '2023-09-01', 30, '1857c25b-9847-40b9-88be-ed76c2301c0a', 'active', 500000000000, 'HĐ-2023-005'),
('DA005', 'Nhà máy điện mặt trời', 'Tư vấn giám sát lắp đặt hệ thống điện mặt trời', 'Ninh Thuận', '2024-02-01', 12, '1857c25b-9847-40b9-88be-ed76c2301c0a', 'completed', 800000000000, 'HĐ-2024-004')
ON CONFLICT (code) 
DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    location = EXCLUDED.location,
    start_date = EXCLUDED.start_date,
    duration_months = EXCLUDED.duration_months,
    manager_id = EXCLUDED.manager_id,
    status = EXCLUDED.status,
    budget = EXCLUDED.budget,
    contract_number = EXCLUDED.contract_number;

-- Update progress for demo
UPDATE public.projects SET progress_percent = 65 WHERE code = 'DA001';
UPDATE public.projects SET progress_percent = 40 WHERE code = 'DA002';
UPDATE public.projects SET progress_percent = 5 WHERE code = 'DA003';
UPDATE public.projects SET progress_percent = 85 WHERE code = 'DA004';
UPDATE public.projects SET progress_percent = 100 WHERE code = 'DA005';
