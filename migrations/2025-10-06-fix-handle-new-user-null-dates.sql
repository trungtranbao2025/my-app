-- Migration: Harden handle_new_user trigger against invalid / empty metadata
-- Date: 2025-10-06
-- Issue: 500 "Database error saving new user" likely caused by invalid ::date / ::boolean casts when metadata fields are empty strings.
-- Fix: Safe casting + fallback + exception logging (RAISE LOG) so auth signup does not fail.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb;
  v_full_name text;
  v_phone text;
  v_birthday date;
  v_join_date date;
  v_is_active boolean;
  v_role text;
BEGIN
  meta := NEW.raw_user_meta_data;

  v_full_name := NULLIF(meta->>'full_name','');
  IF v_full_name IS NULL THEN
    v_full_name := split_part(NEW.email,'@',1);
  END IF;

  v_phone := NULLIF(meta->>'phone','');

  -- Birthday (safe cast)
  BEGIN
    v_birthday := NULLIF(meta->>'birthday','')::date;
  EXCEPTION WHEN others THEN
    v_birthday := NULL; -- ignore invalid format
  END;

  -- Join date (safe cast with fallback today)
  BEGIN
    v_join_date := COALESCE(NULLIF(meta->>'join_date','')::date, CURRENT_DATE);
  EXCEPTION WHEN others THEN
    v_join_date := CURRENT_DATE;
  END;

  -- is_active (safe cast)
  BEGIN
    v_is_active := COALESCE(NULLIF(meta->>'is_active','')::boolean, true);
  EXCEPTION WHEN others THEN
    v_is_active := true;
  END;

  v_role := COALESCE(NULLIF(meta->>'role',''),'user');
  IF NOT (v_role = ANY(ARRAY['user','admin','manager'])) THEN
    v_role := 'user';
  END IF;

  INSERT INTO public.profiles(
    id, email, full_name, phone, birthday, join_date, is_active, role
  ) VALUES (
    NEW.id, NEW.email, v_full_name, v_phone, v_birthday, v_join_date, v_is_active, v_role
  ) ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Log error but do not block auth user creation
  RAISE LOG 'handle_new_user failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;

-- After running:
-- 1. Try creating a new user with blank dates/flags.
-- 2. Check Logs (Database > Logs) for any RAISE LOG lines if failure occurs but user still created.
