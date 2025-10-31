-- Step 1: Drop all existing policies first
-- Run this FIRST in Supabase SQL Editor

-- Drop ALL policies on project_members
DROP POLICY IF EXISTS "Users can view project members of their projects" ON public.project_members;
DROP POLICY IF EXISTS "Managers can modify project members" ON public.project_members;
DROP POLICY IF EXISTS "Project admins can modify members" ON public.project_members;
DROP POLICY IF EXISTS "Managers can view all project_members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON public.project_members;

-- Drop ALL policies on projects
DROP POLICY IF EXISTS "Users can view projects they're assigned to" ON public.projects;
DROP POLICY IF EXISTS "Managers can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Managers and project admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Managers can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Project managers can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Managers can modify projects" ON public.projects;

-- Drop ALL policies on tasks
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks assigned to them or in their projects" ON public.tasks;
DROP POLICY IF EXISTS "Managers can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Managers can modify all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
