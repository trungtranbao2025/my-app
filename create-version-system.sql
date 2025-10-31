-- Tạo bảng error_logs để lưu lỗi hệ thống
-- Chạy script này trong Supabase SQL Editor

-- Tạo bảng error_logs
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    error_type TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    user_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo index cho hiệu suất
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON public.error_logs(error_type);

-- RLS Policies
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Chỉ Manager mới có thể xem error logs
DROP POLICY IF EXISTS "Managers can view error logs" ON public.error_logs;
CREATE POLICY "Managers can view error logs"
ON public.error_logs FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Tất cả user có thể insert error logs
DROP POLICY IF EXISTS "Users can insert error logs" ON public.error_logs;
CREATE POLICY "Users can insert error logs"
ON public.error_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Chỉ Manager mới có thể xóa error logs
DROP POLICY IF EXISTS "Managers can delete error logs" ON public.error_logs;
CREATE POLICY "Managers can delete error logs"
ON public.error_logs FOR DELETE
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Thêm comment cho bảng
COMMENT ON TABLE public.error_logs IS 'Lưu trữ lỗi hệ thống để debug và theo dõi';
COMMENT ON COLUMN public.error_logs.error_message IS 'Thông điệp lỗi';
COMMENT ON COLUMN public.error_logs.error_stack IS 'Stack trace của lỗi';
COMMENT ON COLUMN public.error_logs.error_type IS 'Loại lỗi (Error, TypeError, etc.)';
COMMENT ON COLUMN public.error_logs.context IS 'Thông tin ngữ cảnh (URL, user agent, version, etc.)';

-- Tạo function để tự động xóa log cũ (> 30 ngày)
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.error_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tạo scheduled job để tự động cleanup (cần extension pg_cron)
-- Uncomment dòng dưới nếu muốn tự động cleanup
-- SELECT cron.schedule('cleanup-error-logs', '0 2 * * *', 'SELECT cleanup_old_error_logs()');

COMMENT ON FUNCTION cleanup_old_error_logs IS 'Xóa error logs cũ hơn 30 ngày';
