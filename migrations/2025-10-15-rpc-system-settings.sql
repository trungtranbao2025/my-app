-- Migration: create RPC get_system_settings to safely read system settings without triggering recursive profile policies
-- Purpose: Replace direct client queries to system_settings (used for version control & logo) with SECURITY DEFINER function
-- Strategy: SECURITY DEFINER so that RLS on system_settings (if any) does not block reads; enforce limited key allowlist if needed
-- Notes: Accepts array of keys (text[]). Returns SETOF records (key text, value jsonb, description text)

create or replace function public.get_system_settings(keys text[] DEFAULT NULL)
returns table(
  key text,
  value jsonb,
  description text
) security definer
set search_path = public
language plpgsql as $$
declare
begin
  -- If keys is provided (non-null and not empty) filter by it, else return all
  return query
  select s.key, s.value, s.description
  from public.system_settings s
  where keys is null
     or array_length(keys,1) is null
     or s.key = any(keys);
end;
$$;

-- Optional: restrict execution to authenticated users
revoke all on function public.get_system_settings(text[]) from public;
grant execute on function public.get_system_settings(text[]) to authenticated;
grant execute on function public.get_system_settings(text[]) to service_role; -- safety for service operations

comment on function public.get_system_settings(text[]) is 'Returns selected (or all) system settings as key/value JSON (SECURITY DEFINER) to avoid complex client joins';
