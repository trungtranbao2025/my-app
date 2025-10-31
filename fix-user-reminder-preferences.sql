-- Ensure user_reminder_preferences exists + RLS + seed defaults
-- Copy-paste into Supabase SQL editor and run once

-- 1) Table
create table if not exists public.user_reminder_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  one_time_config jsonb default '{
    "specific_times": ["09:00","14:00"],
    "repeat_every_hours": 0,
    "repeat_every_days": 1,
    "max_per_day": 3,
    "days_of_week": [1,2,3,4,5]
  }',
  recurring_config jsonb default '{
    "specific_times": ["09:00"],
    "repeat_every_hours": 0,
    "repeat_every_days": 1,
    "days_of_week": [1,2,3,4,5],
    "days_of_month": [1,15],
    "months_of_quarter": [1],
    "months_of_year": [1,4,7,10]
  }',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) RLS
alter table public.user_reminder_preferences enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_reminder_preferences' and policyname='user_reminder_prefs_select_own'
  ) then
    execute 'create policy user_reminder_prefs_select_own on public.user_reminder_preferences for select using (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_reminder_preferences' and policyname='user_reminder_prefs_insert_own'
  ) then
    execute 'create policy user_reminder_prefs_insert_own on public.user_reminder_preferences for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_reminder_preferences' and policyname='user_reminder_prefs_update_own'
  ) then
    execute 'create policy user_reminder_prefs_update_own on public.user_reminder_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='user_reminder_preferences' and policyname='user_reminder_prefs_delete_own'
  ) then
    execute 'create policy user_reminder_prefs_delete_own on public.user_reminder_preferences for delete using (auth.uid() = user_id)';
  end if;
exception when others then null; end $$;

-- 3) Seed defaults for all existing users missing prefs
insert into public.user_reminder_preferences(user_id)
select p.id from public.profiles p
where not exists (
  select 1 from public.user_reminder_preferences up where up.user_id = p.id
);

-- 4) Touch updated_at trigger
create or replace function public._trg_touch_updated_at_user_reminder_prefs()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

drop trigger if exists trg_touch_updated_at_user_reminder_prefs on public.user_reminder_preferences;
create trigger trg_touch_updated_at_user_reminder_prefs
before update on public.user_reminder_preferences
for each row execute function public._trg_touch_updated_at_user_reminder_prefs();
