-- Migration: Fix recursive profiles policy causing infinite recursion (42P17)
-- Date: 2025-10-15
-- Purpose: Remove self-referential policy "Only managers can insert profiles" that SELECTs from profiles inside a profiles policy.
-- Safe, idempotent: checks existence before (re)creating policies.

BEGIN;

-- 1. Drop the problematic policy if it still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Only managers can insert profiles'
      AND tablename = 'profiles'
  ) THEN
    EXECUTE 'DROP POLICY "Only managers can insert profiles" ON public.profiles';
  END IF;
END$$;

-- 1b. Aggressively drop any legacy recursive / broad policies that reference profiles again
DO $$
DECLARE p text;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename='profiles' AND policyname IN (
    'Admins and Managers can view all profiles',
    'Admins and Managers can update all profiles',
    'Admins and Managers can insert profiles',
    'Admins can view all profiles',
    'Admins can update all profiles',
    'Admins can insert all profiles',
    'Enable read access for authenticated users',
    'Enable update for users based on id',
    'Enable insert for authenticated users'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p);
  END LOOP;
END$$;

-- 2. Create (or recreate) a safe self-insert policy (no subquery) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Profiles self insert' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id)';
  END IF;
END$$;

-- 3. Ensure existing safe policies exist (view + update own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view all profiles' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true)';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
  END IF;
END$$;

-- 3b. (Optional) Ensure delete remains restricted (commented out unless needed)
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_policies WHERE policyname = 'Allow service role to delete profiles' AND tablename='profiles'
--   ) THEN
--     EXECUTE 'CREATE POLICY "Allow service role to delete profiles" ON public.profiles FOR DELETE USING (false)';
--   END IF;
-- END$$;

-- 4. Diagnostics (optional selects; safe if run in SQL editor) - commented out for migration
-- SELECT policyname, cmd, roles FROM pg_policies WHERE tablename='profiles' ORDER BY policyname;

COMMIT;

-- Post-deploy verification (manual):
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='profiles';
-- SELECT * FROM public.profiles LIMIT 1;