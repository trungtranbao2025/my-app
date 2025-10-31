-- SQL Script for Supabase Database Setup
-- Copy and paste this into your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('manager', 'admin', 'user');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_type AS ENUM ('regular', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'nearly_due', 'overdue', 'completed');
CREATE TYPE project_status AS ENUM ('planning', 'active', 'completed', 'cancelled');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    position TEXT,
    role user_role DEFAULT 'user',
    join_date DATE DEFAULT CURRENT_DATE,
    birthday DATE,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Companies table
CREATE TABLE public.companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_date DATE NOT NULL,
    duration_months INTEGER,
    duration_days INTEGER,
    end_date DATE GENERATED ALWAYS AS (
        CASE 
            WHEN duration_months IS NOT NULL THEN start_date + INTERVAL '1 month' * duration_months
            WHEN duration_days IS NOT NULL THEN start_date + INTERVAL '1 day' * duration_days
            ELSE start_date
        END
    ) STORED,
    contract_number TEXT,
    status project_status DEFAULT 'planning',
    manager_id UUID REFERENCES public.profiles(id),
    company_id UUID REFERENCES public.companies(id),
    budget DECIMAL(15,2),
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project members table (many-to-many relationship between users and projects)
CREATE TABLE public.project_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_in_project TEXT NOT NULL, -- e.g., "Trưởng nhóm", "Kỹ sư", "Giám sát"
    assigned_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Tasks table
CREATE TABLE public.tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES public.profiles(id),
    assigned_by UUID REFERENCES public.profiles(id),
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    completed_date DATE,
    priority task_priority DEFAULT 'medium',
    task_type task_type DEFAULT 'regular',
    status task_status DEFAULT 'pending',
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    self_assessment_percent INTEGER CHECK (self_assessment_percent >= 0 AND self_assessment_percent <= 100),
    notes TEXT,
    is_completed BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task comments table
CREATE TABLE public.task_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task attachments table
CREATE TABLE public.task_attachments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'task_reminder', 'task_assigned', 'task_completed', 'birthday', 'anniversary'
    related_id UUID, -- ID của task, project, etc.
    is_read BOOLEAN DEFAULT false,
    sent_via_email BOOLEAN DEFAULT false,
    sent_via_push BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System settings table
CREATE TABLE public.system_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
('app_name', '"Phần mềm quản lý dự án tư vấn giám sát"', 'Application name'),
('email_notifications', 'true', 'Enable email notifications'),
('push_notifications', 'true', 'Enable push notifications'),
('reminder_time', '"09:00"', 'Daily reminder time'),
('company_logo', 'null', 'Company logo URL');

-- Create indexes for better performance
CREATE INDEX idx_projects_manager_id ON public.projects(manager_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Only managers can insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Companies policies
CREATE POLICY "All users can view companies" ON public.companies
    FOR SELECT USING (true);

CREATE POLICY "Only managers can modify companies" ON public.companies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Projects policies
CREATE POLICY "Users can view projects they're assigned to" ON public.projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_members 
            WHERE project_id = projects.id AND user_id = auth.uid()
        ) OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

CREATE POLICY "Managers can insert projects" ON public.projects
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

CREATE POLICY "Managers and project admins can update projects" ON public.projects
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        ) OR 
        EXISTS (
            SELECT 1 FROM public.project_members 
            WHERE project_id = projects.id AND user_id = auth.uid() 
            AND role_in_project ILIKE '%admin%'
        )
    );

-- Project members policies
CREATE POLICY "Users can view project members of their projects" ON public.project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm2
            WHERE pm2.project_id = project_members.project_id AND pm2.user_id = auth.uid()
        ) OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Tasks policies
CREATE POLICY "Users can view tasks in their projects" ON public.tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.project_members 
            WHERE project_id = tasks.project_id AND user_id = auth.uid()
        ) OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

CREATE POLICY "Users can insert tasks in their projects" ON public.tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.project_members 
            WHERE project_id = tasks.project_id AND user_id = auth.uid()
        ) OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

CREATE POLICY "Users can update tasks assigned to them or in their projects" ON public.tasks
    FOR UPDATE USING (
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.project_members 
            WHERE project_id = tasks.project_id AND user_id = auth.uid() 
            AND role_in_project ILIKE '%admin%'
        ) OR 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- System settings policies
CREATE POLICY "All users can view system settings" ON public.system_settings
    FOR SELECT USING (true);

CREATE POLICY "Only managers can modify system settings" ON public.system_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Create functions for automatic task status updates
CREATE OR REPLACE FUNCTION update_task_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update task status based on due date and completion
    IF NEW.is_completed = true THEN
        NEW.status = 'completed';
        NEW.completed_date = CURRENT_DATE;
        NEW.progress_percent = 100;
    ELSE
        IF CURRENT_DATE > NEW.due_date THEN
            NEW.status = 'overdue';
        ELSIF CURRENT_DATE >= (NEW.due_date - INTERVAL '3 days') THEN
            NEW.status = 'nearly_due';
        ELSIF NEW.progress_percent > 0 THEN
            NEW.status = 'in_progress';
        ELSE
            NEW.status = 'pending';
        END IF;
    END IF;
    
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task status updates
CREATE TRIGGER trigger_update_task_status
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_task_status();

-- Create function to update project progress
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.projects 
    SET progress_percent = (
        SELECT COALESCE(AVG(progress_percent), 0)
        FROM public.tasks 
        WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.project_id, OLD.project_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for project progress updates
CREATE TRIGGER trigger_update_project_progress
    AFTER INSERT OR UPDATE OR DELETE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_project_progress();

-- Create function for updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional, for testing)
INSERT INTO public.companies (name, address, phone, email) VALUES
('Công ty TNHH Tư vấn ABC', 'Hà Nội, Việt Nam', '024-1234567', 'contact@abc.com');

-- Create a view for task statistics
CREATE VIEW task_statistics AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.status = 'overdue' THEN 1 END) as overdue_tasks,
    COUNT(CASE WHEN t.status = 'nearly_due' THEN 1 END) as nearly_due_tasks,
    ROUND(AVG(t.progress_percent), 2) as avg_progress
FROM public.projects p
LEFT JOIN public.tasks t ON p.id = t.project_id
GROUP BY p.id, p.name;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
