-- Create user_reminder_preferences table for storing user-specific reminder settings
-- Run in Supabase SQL Editor. Safe to run multiple times.

-- 1) Create the table with comprehensive reminder configuration
create table if not exists public.user_reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Configuration for one-time (ad-hoc) tasks
  one_time_config jsonb default '{
    "active": true,
    "by_status": {
      "in_progress": {
        "enabled": true,
        "specific_times": ["09:00", "15:00"],
        "repeat_every_hours": 4,
        "repeat_every_days": 1,
        "max_per_day": 3,
        "days_of_week": [1,2,3,4,5]
      },
      "nearly_due": {
        "enabled": true,
        "specific_times": ["08:00", "12:00", "17:00"],
        "repeat_every_hours": 2,
        "repeat_every_days": 1,
        "max_per_day": 5,
        "days_of_week": [1,2,3,4,5,6,7]
      },
      "overdue": {
        "enabled": true,
        "specific_times": ["08:00", "10:00", "14:00", "16:00"],
        "repeat_every_hours": 2,
        "repeat_every_days": 1,
        "max_per_day": 6,
        "days_of_week": [1,2,3,4,5,6,7]
      }
    },
    "quiet_hours": {"start": "22:00", "end": "07:00"}
  }'::jsonb,
  
  -- Configuration for recurring tasks
  recurring_config jsonb default '{
    "active": true,
    "by_status": {
      "in_progress": {
        "enabled": true,
        "specific_times": ["09:00"],
        "repeat_every_hours": 0,
        "repeat_every_days": 1,
        "max_per_day": 1,
        "days_of_week": [1,2,3,4,5],
        "days_of_month": [],
        "months_of_quarter": [],
        "months_of_year": []
      },
      "nearly_due": {
        "enabled": true,
        "specific_times": ["08:00", "16:00"],
        "repeat_every_hours": 0,
        "repeat_every_days": 1,
        "max_per_day": 2,
        "days_of_week": [1,2,3,4,5,6,7],
        "days_of_month": [],
        "months_of_quarter": [],
        "months_of_year": []
      },
      "overdue": {
        "enabled": true,
        "specific_times": ["08:00", "12:00", "17:00"],
        "repeat_every_hours": 0,
        "repeat_every_days": 1,
        "max_per_day": 3,
        "days_of_week": [1,2,3,4,5,6,7],
        "days_of_month": [],
        "months_of_quarter": [],
        "months_of_year": []
      }
    },
    "quiet_hours": {"start": "22:00", "end": "07:00"}
  }'::jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  unique(user_id)
);

comment on table public.user_reminder_preferences is 'User-specific reminder preferences with detailed scheduling options for one-time and recurring tasks by status';
comment on column public.user_reminder_preferences.one_time_config is 'Reminder config for one-time tasks: specific_times (HH:MM array), repeat_every_hours (0=disabled), repeat_every_days (1=daily), max_per_day, days_of_week (1-7)';
comment on column public.user_reminder_preferences.recurring_config is 'Reminder config for recurring tasks: adds repeat_every_days (1=daily), days_of_month (1-31), months_of_quarter (1-3), months_of_year (1-12)';

-- 2) Enable RLS
alter table public.user_reminder_preferences enable row level security;

-- 3) RLS Policies - users can only see and modify their own preferences
do $$ begin
  drop policy if exists user_reminder_prefs_select_own on public.user_reminder_preferences;
  create policy user_reminder_prefs_select_own on public.user_reminder_preferences
    for select to authenticated
    using (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  drop policy if exists user_reminder_prefs_insert_own on public.user_reminder_preferences;
  create policy user_reminder_prefs_insert_own on public.user_reminder_preferences
    for insert to authenticated
    with check (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  drop policy if exists user_reminder_prefs_update_own on public.user_reminder_preferences;
  create policy user_reminder_prefs_update_own on public.user_reminder_preferences
    for update to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when others then null; end $$;

do $$ begin
  drop policy if exists user_reminder_prefs_delete_own on public.user_reminder_preferences;
  create policy user_reminder_prefs_delete_own on public.user_reminder_preferences
    for delete to authenticated
    using (auth.uid() = user_id);
exception when others then null; end $$;

-- 4) Create index for faster lookups
create index if not exists idx_user_reminder_prefs_user_id 
  on public.user_reminder_preferences(user_id);

-- 5) Create updated_at trigger
create or replace function public._update_user_reminder_prefs_timestamp()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;$$;

do $$ begin
  drop trigger if exists trg_update_user_reminder_prefs_timestamp on public.user_reminder_preferences;
  create trigger trg_update_user_reminder_prefs_timestamp
    before update on public.user_reminder_preferences
    for each row execute function public._update_user_reminder_prefs_timestamp();
exception when others then null; end $$;

-- 6) Seed default preferences for existing users (optional)
-- To enable seeding, remove the leading dashes on the statements below and run them once.
-- insert into public.user_reminder_preferences (user_id)
-- select id from auth.users
-- where not exists (
--   select 1 from public.user_reminder_preferences
--   where user_id = auth.users.id
-- )
-- on conflict (user_id) do nothing;
