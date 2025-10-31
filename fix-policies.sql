-- Fix infinite recursion in RLS policies
-- Run this in Supabase SQL Editor AFTER running the main schema

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view project members of their projects" ON public.project_members;

-- Recreate with simpler logic that doesn't cause recursion
CREATE POLICY "Users can view project members of their projects" ON public.project_members
    FOR SELECT USING (
        user_id = auth.uid() OR -- Can see themselves
        project_id IN ( -- Or projects they're in
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid()
        ) OR
        EXISTS ( -- Or if they're a manager
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Also simplify the projects policy to avoid potential recursion
DROP POLICY IF EXISTS "Users can view projects they're assigned to" ON public.projects;

CREATE POLICY "Users can view projects they're assigned to" ON public.projects
    FOR SELECT USING (
        manager_id = auth.uid() OR -- Project manager can see
        id IN ( -- Or user is a member
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid()
        ) OR
        EXISTS ( -- Or user is a manager role
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Add policy for project_members INSERT/UPDATE
DROP POLICY IF EXISTS "Managers can modify project members" ON public.project_members;

CREATE POLICY "Managers can modify project members" ON public.project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Allow users to insert/update in their own projects
DROP POLICY IF EXISTS "Project admins can modify members" ON public.project_members;

CREATE POLICY "Project admins can modify members" ON public.project_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('manager', 'admin')
        )
    );
