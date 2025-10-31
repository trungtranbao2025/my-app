-- ONE-STEP FIX: Drop all old policies and create new ones
-- Run this ENTIRE script at once in Supabase SQL Editor

-- ===== STEP 1: DROP ALL OLD POLICIES =====

DROP POLICY IF EXISTS "Users can view project members of their projects" ON public.project_members;
DROP POLICY IF EXISTS "Managers can modify project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins can modify members" ON public.project_members;
DROP POLICY IF EXISTS "Managers can view all project_members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON public.project_members;

DROP POLICY IF EXISTS "Users can view projects they're assigned to" ON public.projects;
DROP POLICY IF EXISTS "Managers can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Managers and project admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Managers can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Project managers can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Managers can modify projects" ON public.projects;

DROP POLICY IF EXISTS "Users can view tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks assigned to them or in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Managers can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Managers can modify all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;

-- ===== STEP 2: CREATE NEW SIMPLE POLICIES =====

-- Project_members policies
CREATE POLICY "pm_managers_view" ON public.project_members
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "pm_users_own" ON public.project_members
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "pm_managers_modify" ON public.project_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

-- Projects policies
CREATE POLICY "proj_managers_view" ON public.projects
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "proj_owner_view" ON public.projects
    FOR SELECT USING (manager_id = auth.uid());

CREATE POLICY "proj_managers_modify" ON public.projects
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

-- Tasks policies
CREATE POLICY "task_managers_view" ON public.tasks
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "task_assigned_view" ON public.tasks
    FOR SELECT USING (assigned_to = auth.uid());

CREATE POLICY "task_managers_modify" ON public.tasks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "task_assigned_update" ON public.tasks
    FOR UPDATE USING (assigned_to = auth.uid());

-- Grant permissions
GRANT SELECT ON task_statistics TO authenticated;
