-- Migration: Fix profile insert policies & trigger (idempotent)
-- Date: 2025-10-06
-- Purpose: Allow creating new auth users via supabase.auth.signUp (trigger creates profile)

BEGIN;

-- 1. Ensure enum user_role exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('manager','admin','user');
  END IF;
END$$;

-- 2. Re-add missing enum values safely (in case schema evolved)
DO $$
DECLARE v text; BEGIN
  FOR v IN SELECT unnest(ARRAY['manager','admin','user']) LOOP
    BEGIN
      EXECUTE format('ALTER TYPE user_role ADD VALUE IF NOT EXISTS %L', v);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END$$;

-- 3. Enable RLS on profiles (safe)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop conflicting / legacy policies (ignore if absent)
DROP POLICY IF EXISTS "Only managers can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Profiles self insert" ON public.profiles;

-- 5. Core policies
-- View (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='Users can view all profiles' AND tablename='profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true)';
  END IF;
END$$;

-- Update own (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname='Users can update own profile' AND tablename='profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
  END IF;
END$$;

-- Insert (self) policy (always recreate for clarity)
CREATE POLICY "Profiles self insert" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 6. Recreate trigger function for new auth user -> profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE meta jsonb;
BEGIN
  meta := NEW.raw_user_meta_data;
  INSERT INTO public.profiles (id,email,full_name,phone,birthday,join_date,is_active,role,created_at,updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(meta->>'full_name', split_part(NEW.email,'@',1)),
    meta->>'phone',
    (meta->>'birthday')::date,
    COALESCE((meta->>'join_date')::date, current_date),
    COALESCE((meta->>'is_active')::boolean, true),
    COALESCE(meta->>'role','user'),
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;$$;

-- 7. Re-bind trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Diagnostics (simple select at end instead of DO/RAISE to avoid syntax issues)
COMMIT;

-- View resulting policies
SELECT policyname, cmd FROM pg_policies WHERE tablename='profiles' ORDER BY policyname;

-- Test suggestions (manual):
-- SELECT * FROM public.profiles LIMIT 5;
-- Sign up a new user via auth -> expect profile auto-created.
