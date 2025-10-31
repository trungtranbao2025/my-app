-- Fresh minimal reminders module
-- Ensure uuid generator is available (Supabase uses schema "extensions")
create extension if not exists pgcrypto with schema extensions;

-- 1) Table
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note text,
  remind_at timestamptz not null,
  is_done boolean default false,
  created_at timestamptz default now()
);

-- 2) Indexes
create index if not exists idx_reminders_user on public.reminders(user_id);
create index if not exists idx_reminders_remind_at on public.reminders(remind_at);

-- 3) Enable RLS
alter table public.reminders enable row level security;

-- Note: PostgreSQL doesn't support IF NOT EXISTS on CREATE POLICY
-- Use DROP IF EXISTS first, then CREATE
drop policy if exists reminders_select_own on public.reminders;
create policy reminders_select_own on public.reminders
for select to authenticated using (auth.uid() = user_id);

drop policy if exists reminders_insert_own on public.reminders;
create policy reminders_insert_own on public.reminders
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists reminders_update_own on public.reminders;
create policy reminders_update_own on public.reminders
for update to authenticated using (auth.uid() = user_id);

drop policy if exists reminders_delete_own on public.reminders;
create policy reminders_delete_own on public.reminders
for delete to authenticated using (auth.uid() = user_id);

-- 5) Optional: helper view for upcoming reminders (next 7 days)
create or replace view public.v_upcoming_reminders as
select * from public.reminders
where remind_at >= now() - interval '1 hour'
  and remind_at <= now() + interval '7 days';
