-- 1) Rules table: map task status/priority to a flexible repeat schedule
create table if not exists public.status_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('pending','in_progress','upcoming','overdue')),
  priority text, -- null = all priorities
  start_mode text not null check (start_mode in ('on_create','on_upcoming','on_overdue')),
  
  -- Flexible repeat interval
  repeat_interval_unit text not null check (repeat_interval_unit in ('hours', 'days', 'weeks', 'months', 'quarters', 'years')),
  repeat_interval_value int not null check (repeat_interval_value > 0),

  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(status, priority)
);

comment on table public.status_reminder_rules is 'Cấu hình lịch nhắc theo trạng thái/cấp độ -> tạo/upsert vào task_reminder_settings';

-- RLS: everyone can read; only managers can manage
alter table public.status_reminder_rules enable row level security;
do $$ begin
  drop policy if exists status_rules_select on public.status_reminder_rules;
  create policy status_rules_select on public.status_reminder_rules
    for select to authenticated using (true);
exception when others then null; end $$;

do $$ begin
  drop policy if exists status_rules_manage on public.status_reminder_rules;
  create policy status_rules_manage on public.status_reminder_rules
    for all to authenticated
    using ((select role from public.profiles where id = auth.uid()) in ('manager','admin'))
    with check ((select role from public.profiles where id = auth.uid()) in ('manager','admin'));
exception when others then null; end $$;

-- 1.1) Also update task_reminder_settings for flexible intervals
-- This part should be run carefully, consider data migration if needed.
do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'task_reminder_settings' and column_name = 'repeat_interval_unit'
    ) then
        -- Drop old column if it exists
        if exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'task_reminder_settings' and column_name = 'repeat_hours'
        ) then
            alter table public.task_reminder_settings drop column repeat_hours;
        end if;

        -- Add new flexible columns
        alter table public.task_reminder_settings
            add column repeat_interval_unit text check (repeat_interval_unit in ('hours', 'days', 'weeks', 'months', 'quarters', 'years')),
            add column repeat_interval_value int check (repeat_interval_value > 0);
    end if;
end$$;

-- 1.2) Add is_custom flag to prevent overwrites
do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'task_reminder_settings' and column_name = 'is_custom'
    ) then
        alter table public.task_reminder_settings
            add column is_custom boolean not null default false;
    end if;
end$$;

comment on column public.task_reminder_settings.is_custom is 'True if the user set this reminder manually, false if generated from a rule.';

-- 2) Helper: check if table exists
create or replace function public._table_exists(p_schema text, p_table text)
returns boolean language plpgsql as $$
begin
  return exists (
    select 1 from information_schema.tables
    where table_schema=p_schema and table_name=p_table
  );
end;$$;

-- 3) Upsert settings for ONE task based on rules
create or replace function public.sync_task_reminder_for_task(p_task_id uuid)
returns void language plpgsql security definer as $$
declare
  t record;
  r record;
  u_id uuid;
  use_multi boolean := false;
  cur refcursor;
  is_custom_setting boolean;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found then return; end if;

  -- First, check if a custom reminder exists for the main assignee. If so, do nothing.
  select is_custom into is_custom_setting from public.task_reminder_settings where task_id = p_task_id and user_id = t.assigned_to;
  if found and is_custom_setting then
    -- A custom reminder is set, so we don't apply automatic rules.
    -- We might still want to apply rules for OTHER assignees, but for now, we skip.
    -- This logic can be refined based on product requirements.
    return;
  end if;

  -- choose rules matching task status/priority (priority null = wildcard)
  for r in
    select * from public.status_reminder_rules
    where active
      and status = coalesce(t.status::text, 'pending')
      and (priority is null or priority = t.priority::text)
  loop
    -- Collect assignees safely
    use_multi := public._table_exists('public','task_assignees');

    -- 1) main assignee
    u_id := t.assigned_to;
    if u_id is not null then
      insert into public.task_reminder_settings(
        task_id, user_id, active, repeat_interval_unit, repeat_interval_value, start_mode, timezone, quiet_hours, channels, escalate_after, is_custom
      ) values (
        t.id, u_id, true, r.repeat_interval_unit, r.repeat_interval_value, r.start_mode, 'Asia/Ho_Chi_Minh', '{"start":"22:00","end":"07:00"}', '{push}', 0, false
      )
      on conflict (task_id, user_id) do update
        set active = true,
            repeat_interval_unit = excluded.repeat_interval_unit,
            repeat_interval_value = excluded.repeat_interval_value,
            start_mode = excluded.start_mode,
            timezone = excluded.timezone,
            channels = excluded.channels,
            is_custom = false, -- Always reset to false when applying a rule
            updated_at = now()
        where task_reminder_settings.is_custom = false; -- IMPORTANT: Do not overwrite custom settings
    end if;

    -- 2) multi-assignees (if table exists)
    if use_multi then
      for u_id in execute format('select user_id from public.task_assignees where task_id = %L', t.id)
      loop
        continue when u_id is null;
        insert into public.task_reminder_settings(
          task_id, user_id, active, repeat_interval_unit, repeat_interval_value, start_mode, timezone, quiet_hours, channels, escalate_after, is_custom
        ) values (
          t.id, u_id, true, r.repeat_interval_unit, r.repeat_interval_value, r.start_mode, 'Asia/Ho_Chi_Minh', '{"start":"22:00","end":"07:00"}', '{push}', 0, false
        )
        on conflict (task_id, user_id) do update
          set active = true,
              repeat_interval_unit = excluded.repeat_interval_unit,
              repeat_interval_value = excluded.repeat_interval_value,
              start_mode = excluded.start_mode,
              timezone = excluded.timezone,
              channels = excluded.channels,
              is_custom = false, -- Always reset to false when applying a rule
              updated_at = now()
          where task_reminder_settings.is_custom = false; -- IMPORTANT: Do not overwrite custom settings
      end loop;
    end if;
  end loop;
end;$$;

-- 4) Upsert settings for ALL relevant tasks (batch)
create or replace function public.apply_status_reminder_rules()
returns void language plpgsql security definer as $$
declare
  t_id uuid;
begin
  -- Only consider tasks that are not completed
  for t_id in
    select id from public.tasks
    where coalesce(status,'pending') != 'completed'
  loop
    perform public.sync_task_reminder_for_task(t_id);
  end loop;
end;$$;

-- 5) Trigger: keep settings in sync when tasks change
-- Wrapper trigger function (triggers can't pass arguments)
create or replace function public._trg_sync_status_reminders()
returns trigger language plpgsql security definer as $$
begin
  perform public.sync_task_reminder_for_task(coalesce(NEW.id, OLD.id));
  return NEW; -- AFTER trigger, return value ignored but must be valid
end;$$;

do $$ begin
  if exists (
    select 1 from information_schema.tables where table_schema='public' and table_name='tasks'
  ) then
    drop trigger if exists trg_sync_status_reminders on public.tasks;
    create trigger trg_sync_status_reminders
      after insert or update of status, priority, due_date, assigned_to on public.tasks
      for each row execute function public._trg_sync_status_reminders();
  end if;
exception when others then null; end $$;

-- 6) Defaults for the two statuses in the screenshot
--   ⚠️ Sắp đến hạn (upcoming): Medium + Low with periodic reminders
--   ⏳ Chờ xử lý (pending): Medium + Low with slower cadence
insert into public.status_reminder_rules(status, priority, start_mode, repeat_interval_unit, repeat_interval_value)
values
  ('upcoming','medium','on_upcoming', 'hours', 6),
  ('upcoming','low','on_upcoming', 'hours', 12),
  ('pending','medium','on_create', 'days', 1),
  ('pending','low','on_create', 'days', 2)
on conflict (status, priority) do update
  set start_mode = excluded.start_mode,
      repeat_interval_unit = excluded.repeat_interval_unit,
      repeat_interval_value = excluded.repeat_interval_value,
      active = true,
      updated_at = now();

-- 7) Prime settings for existing tasks now
select public.apply_status_reminder_rules();

-- 8) Ensure notifications RLS select-own (Edge Function writes with service role)
do $$ begin
  perform 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_select_own';
  if not found then
    execute 'alter table public.notifications enable row level security';
    execute 'create policy notifications_select_own on public.notifications for select using (auth.uid() = user_id)';
  end if;
exception when others then null; end $$;
