-- Safe migration: normalize user column to user_id (uuid) on public.task_reminders
-- Run in Supabase SQL editor. Idempotent.

do $mig$
declare
  v_old_col text;
  v_has_user_id boolean;
  v_data_type text;
  r record;
begin
  -- Skip if table doesn't exist
  if not exists (
    select 1 from information_schema.tables 
    where table_schema='public' and table_name='task_reminders'
  ) then
    raise notice 'Table public.task_reminders not found, nothing to migrate.';
    return;
  end if;

  -- Check if user_id exists
  select exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='task_reminders' and column_name='user_id'
  ) into v_has_user_id;

  if not v_has_user_id then
    -- Try to find one legacy column to rename to user_id
    select column_name into v_old_col
    from information_schema.columns
    where table_schema='public' and table_name='task_reminders'
      and column_name in ('owner_id','account_id','profile_id','created_by','uid','user')
    limit 1;

    if v_old_col is not null then
      execute format('alter table public.task_reminders rename column %I to user_id', v_old_col);
    else
      -- No legacy column; ensure column exists
      execute 'alter table public.task_reminders add column if not exists user_id uuid';
    end if;
  end if;

  -- Ensure type uuid (coerce if needed)
  select data_type into v_data_type
  from information_schema.columns
  where table_schema='public' and table_name='task_reminders' and column_name='user_id';

  if v_data_type is not null and v_data_type <> 'uuid' then
    -- Create temp uuid column, attempt to cast data, then swap
    execute 'alter table public.task_reminders add column if not exists user_id_tmp uuid';
    begin
      execute 'update public.task_reminders set user_id_tmp = nullif(user_id::text, '''')::uuid';
    exception when others then
      -- Fallback: set null if cast fails on any row
      execute 'update public.task_reminders set user_id_tmp = null';
    end;
    execute 'alter table public.task_reminders drop column user_id';
    execute 'alter table public.task_reminders rename column user_id_tmp to user_id';
  end if;

  -- Drop any legacy FK(s) on column user_id with unknown names
  for r in (
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage k
      on tc.constraint_name = k.constraint_name
     and tc.table_schema = k.table_schema
    where tc.table_schema='public' and tc.table_name='task_reminders'
      and tc.constraint_type='FOREIGN KEY'
      and k.column_name='user_id'
  ) loop
    execute format('alter table public.task_reminders drop constraint %I', r.constraint_name);
  end loop;

  -- Add standardized FK to auth.users(id) if it does not already exist
  if not exists (
    select 1 from information_schema.table_constraints 
    where table_schema='public' and table_name='task_reminders' and constraint_name='task_reminders_user_fk'
  ) then
    execute 'alter table public.task_reminders 
             add constraint task_reminders_user_fk 
             foreign key (user_id) references auth.users(id) on delete cascade';
  end if;

  -- Drop legacy indexes that might conflict with new names (best-effort)
  begin
    execute 'drop index if exists public.task_reminders_user_id_idx';
    execute 'drop index if exists public.task_reminders_user_idx';
    execute 'drop index if exists public.idx_task_reminders_userid_time';
  exception when others then
    -- ignore
  end;

  -- Recreate helpful indexes
  execute 'create index if not exists idx_task_reminders_user_time on public.task_reminders(user_id, remind_at)';
  execute 'create index if not exists idx_task_reminders_due on public.task_reminders(is_sent, remind_at)';

  raise notice 'Migration completed for public.task_reminders.user_id';
end;
$mig$;
