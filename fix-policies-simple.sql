-- Simple fix for infinite recursion - Run this in Supabase SQL Editor
-- This completely removes the problematic policies and creates simpler ones

-- 1. Drop ALL existing policies on project_members
DROP POLICY IF EXISTS "Users can view project members of their projects" ON public.project_members;
DROP POLICY IF EXISTS "Managers can modify project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins can modify members" ON public.project_members;
DROP POLICY IF EXISTS "Managers can view all project_members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON public.project_members;
DROP POLICY IF EXISTS "Managers can modify project_members" ON public.project_members;

-- 2. Drop ALL existing policies on projects
DROP POLICY IF EXISTS "Users can view projects they're assigned to" ON public.projects;
DROP POLICY IF EXISTS "Managers can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Managers and project admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Managers can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Project managers can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Managers can modify projects" ON public.projects;

-- 3. Drop ALL existing policies on tasks
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks assigned to them or in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Managers can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Managers can modify all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;

-- 4. Create SIMPLE policies without recursion

-- Allow managers to see everything
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

-- Projects policies - simple version
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

-- Tasks policies - simple version  
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

-- Grant SELECT on task_statistics view to all authenticated users
GRANT SELECT ON task_statistics TO authenticated;
