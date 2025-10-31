-- Step 2: Create new simple policies
-- Run this AFTER running step1-drop-policies.sql

-- Project_members policies
CREATE POLICY "Managers can view all project_members" ON public.project_members
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "Users can view their own membership" ON public.project_members
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Managers can modify project_members" ON public.project_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

-- Projects policies
CREATE POLICY "Managers can view all projects" ON public.projects
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "Project managers can view their projects" ON public.projects
    FOR SELECT USING (manager_id = auth.uid());

CREATE POLICY "Managers can modify projects" ON public.projects
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

-- Tasks policies
CREATE POLICY "Managers can view all tasks" ON public.tasks
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "Users can view their assigned tasks" ON public.tasks
    FOR SELECT USING (assigned_to = auth.uid());

CREATE POLICY "Managers can modify all tasks" ON public.tasks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "Users can update their own tasks" ON public.tasks
    FOR UPDATE USING (assigned_to = auth.uid());

-- Grant permissions
GRANT SELECT ON task_statistics TO authenticated;
