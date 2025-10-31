-- Thêm bảng task_proposals để lưu đề xuất công việc cần phê duyệt
-- Chạy script này trong Supabase SQL Editor

-- Tạo enum cho trạng thái đề xuất
DO $$ BEGIN
    CREATE TYPE proposal_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tạo bảng task_proposals
CREATE TABLE IF NOT EXISTS public.task_proposals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    proposed_assignee UUID REFERENCES public.profiles(id), -- Người được đề xuất giao việc
    proposed_by UUID REFERENCES public.profiles(id) NOT NULL, -- Người đề xuất
    approver_id UUID REFERENCES public.profiles(id), -- Người có thẩm quyền phê duyệt
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    priority task_priority DEFAULT 'medium',
    status proposal_status DEFAULT 'pending',
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT, -- Ghi chú từ người đề xuất
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm cột để đánh dấu task được tạo từ đề xuất
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES public.task_proposals(id);

-- Tạo index cho hiệu suất
CREATE INDEX IF NOT EXISTS idx_task_proposals_status ON public.task_proposals(status);
CREATE INDEX IF NOT EXISTS idx_task_proposals_approver ON public.task_proposals(approver_id);
CREATE INDEX IF NOT EXISTS idx_task_proposals_proposed_by ON public.task_proposals(proposed_by);

-- Thêm hàm tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_task_proposals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger
DROP TRIGGER IF EXISTS trigger_task_proposals_updated_at ON public.task_proposals;
CREATE TRIGGER trigger_task_proposals_updated_at
    BEFORE UPDATE ON public.task_proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_task_proposals_updated_at();

-- RLS Policies
ALTER TABLE public.task_proposals ENABLE ROW LEVEL SECURITY;

-- Người dùng có thể xem đề xuất của mình hoặc đề xuất cần họ phê duyệt
DROP POLICY IF EXISTS "Users can view their proposals or proposals to approve" ON public.task_proposals;
CREATE POLICY "Users can view their proposals or proposals to approve"
ON public.task_proposals FOR SELECT
TO authenticated
USING (
    proposed_by = auth.uid() 
    OR approver_id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Người dùng có thể tạo đề xuất nếu là thành viên dự án
DROP POLICY IF EXISTS "Project members can create proposals" ON public.task_proposals;
CREATE POLICY "Project members can create proposals"
ON public.task_proposals FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_id = task_proposals.project_id 
        AND user_id = auth.uid()
        AND is_active = true
    )
);

-- Chỉ người được chỉ định hoặc manager mới có thể cập nhật đề xuất
DROP POLICY IF EXISTS "Approvers can update proposals" ON public.task_proposals;
CREATE POLICY "Approvers can update proposals"
ON public.task_proposals FOR UPDATE
TO authenticated
USING (
    approver_id = auth.uid()
    OR proposed_by = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Chỉ người đề xuất hoặc manager mới có thể xóa đề xuất đang chờ
DROP POLICY IF EXISTS "Users can delete their pending proposals" ON public.task_proposals;
CREATE POLICY "Users can delete their pending proposals"
ON public.task_proposals FOR DELETE
TO authenticated
USING (
    (proposed_by = auth.uid() AND status = 'pending')
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Thêm comment cho bảng
COMMENT ON TABLE public.task_proposals IS 'Lưu trữ đề xuất công việc cần phê duyệt từ nhân viên';
COMMENT ON COLUMN public.task_proposals.proposed_by IS 'Người đề xuất công việc';
COMMENT ON COLUMN public.task_proposals.approver_id IS 'Người có thẩm quyền phê duyệt (manager hoặc admin của dự án)';
COMMENT ON COLUMN public.task_proposals.status IS 'Trạng thái: pending (chờ duyệt), approved (đã duyệt), rejected (từ chối)';

-- ============================================================
-- REALTIME NOTIFICATIONS
-- ============================================================

-- Hàm tạo thông báo khi có đề xuất mới
CREATE OR REPLACE FUNCTION notify_new_proposal()
RETURNS TRIGGER AS $$
BEGIN
    -- Tạo thông báo cho người phê duyệt
        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            related_id,
            is_read
        ) VALUES (
            NEW.approver_id,
            'Đề xuất công việc mới',
            (SELECT full_name FROM public.profiles WHERE id = NEW.proposed_by) || ' đề xuất công việc: ' || NEW.title,
            'proposal',
            NEW.id,
            false
        );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hàm tạo thông báo khi đề xuất được phê duyệt/từ chối
CREATE OR REPLACE FUNCTION notify_proposal_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Chỉ thông báo khi trạng thái thay đổi
    IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
        -- Tạo thông báo cho người đề xuất
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type,
                related_id,
                is_read
            ) VALUES (
                NEW.proposed_by,
                CASE 
                    WHEN NEW.status = 'approved' THEN 'Đề xuất được chấp nhận'
                    ELSE 'Đề xuất bị từ chối'
                END,
                CASE 
                    WHEN NEW.status = 'approved' THEN 'Đề xuất "' || NEW.title || '" đã được phê duyệt'
                    ELSE 'Đề xuất "' || NEW.title || '" bị từ chối. Lý do: ' || COALESCE(NEW.rejection_reason, 'Không có lý do')
                END,
                CASE 
                    WHEN NEW.status = 'approved' THEN 'success'
                    ELSE 'error'
                END,
                NEW.id,
                false
            );
        
        -- Nếu được duyệt, thông báo cho người được giao việc
        IF NEW.status = 'approved' AND NEW.proposed_assignee IS NOT NULL THEN
            INSERT INTO public.notifications (
                user_id,
                title,
                message,
                type,
                is_read
            ) VALUES (
                NEW.proposed_assignee,
                'Công việc mới',
                'Bạn được giao công việc: ' || NEW.title,
                'task',
                false
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo triggers cho notifications
DROP TRIGGER IF EXISTS trigger_notify_new_proposal ON public.task_proposals;
CREATE TRIGGER trigger_notify_new_proposal
    AFTER INSERT ON public.task_proposals
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_proposal();

DROP TRIGGER IF EXISTS trigger_notify_proposal_status_change ON public.task_proposals;
CREATE TRIGGER trigger_notify_proposal_status_change
    AFTER UPDATE ON public.task_proposals
    FOR EACH ROW
    EXECUTE FUNCTION notify_proposal_status_change();
