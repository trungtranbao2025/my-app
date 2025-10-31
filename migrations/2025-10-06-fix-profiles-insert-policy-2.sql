-- Migration: Relax insert policy so trigger can insert profile rows
-- Date: 2025-10-06
-- NOTE: Temporary broader policy to unblock user creation. Tighten later if needed.

BEGIN;

-- 1. Remove prior insert policies
DROP POLICY IF EXISTS "Profiles self insert" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Allow profiles insert (trigger + signUp)" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_any" ON public.profiles;

-- 2. Create permissive insert policy (trigger context sometimes has no auth.uid())
-- We allow insert when:
--   a) auth.uid() = id (normal self insert) OR
--   b) auth.uid() IS NULL (trigger/system/internal) 
-- This blocks random logged-in user from inserting row for another user (since their auth.uid() != id and not null)
CREATE POLICY "Allow profiles insert (trigger + signUp)"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id OR auth.uid() IS NULL
);

COMMIT;

-- Verify
SELECT policyname, cmd, permissive, roles FROM pg_policies WHERE tablename='profiles';
