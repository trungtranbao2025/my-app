-- User Activity Tracking (Login events, presence, summary view, RPC)
-- Idempotent and safe to run multiple times

-- Enable extension if needed (uncomment if not available)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Tables
CREATE TABLE IF NOT EXISTS public.login_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) RLS
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Policies: allow user to insert own event/presence, managers/admin can select all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'login_events' AND policyname = 'login_events_insert_self'
  ) THEN
    CREATE POLICY login_events_insert_self ON public.login_events
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'login_events' AND policyname = 'login_events_select_manager'
  ) THEN
    CREATE POLICY login_events_select_manager ON public.login_events
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_presence' AND policyname = 'user_presence_upsert_self'
  ) THEN
    CREATE POLICY user_presence_upsert_self ON public.user_presence
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_presence' AND policyname = 'user_presence_select_manager'
  ) THEN
    CREATE POLICY user_presence_select_manager ON public.user_presence
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
        )
      );
  END IF;
END $$;

-- 3) View: user_activity_summary
CREATE OR REPLACE VIEW public.user_activity_summary AS
SELECT
  u.id AS user_id,
  up.last_seen_at,
  up.last_login_at,
  (now() - COALESCE(up.last_seen_at, 'epoch'::timestamptz)) < interval '5 minutes' AS is_online,
  (
    SELECT COUNT(*)::int
    FROM public.login_events le
    WHERE le.user_id = u.id
      AND le.occurred_at >= (now() - interval '7 days')
  ) AS weekly_login_count
FROM public.profiles u
LEFT JOIN public.user_presence up ON up.user_id = u.id;

-- Secure the view with RLS via underlying tables; additionally, create a wrapper policy via security definer function
CREATE OR REPLACE FUNCTION public.get_user_activity_summary()
RETURNS SETOF public.user_activity_summary
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT uas.*
  FROM public.user_activity_summary uas
  WHERE EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('manager','admin')
  );
$$;

-- 4) RPC: record_login & heartbeat
CREATE OR REPLACE FUNCTION public.record_login(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert login event
  INSERT INTO public.login_events(user_id) VALUES (p_user_id);
  -- Upsert presence
  INSERT INTO public.user_presence(user_id, last_seen_at, last_login_at, updated_at)
  VALUES (p_user_id, now(), now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at,
        last_login_at = EXCLUDED.last_login_at,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_presence(user_id, last_seen_at, updated_at)
  VALUES (p_user_id, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at,
        updated_at = now();
END;
$$;

-- 5) Grants
GRANT EXECUTE ON FUNCTION public.record_login(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_activity_summary() TO authenticated;

-- Note: Managers/Admins will be allowed to SELECT via get_user_activity_summary();
-- normal users cannot read others' activity.
