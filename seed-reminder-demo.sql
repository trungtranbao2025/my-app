-- Seed demo for reminder scheduler
-- USAGE: Replace :user_email with your login email, then run this script in Supabase SQL editor.
-- It will create a test task due in ~2 hours and a reminder setting that sends immediately (on_create).

do $$
declare
  v_user   uuid;
  v_task   uuid;
  v_email  text := trim(':user_email'); -- placeholder may remain as ':user_email'
  v_is_placeholder boolean := false;
begin
  -- Detect placeholder formats like ':user_email' or any value starting with ':'
  if v_email is null or v_email = '' or v_email like ':%' then
    v_is_placeholder := true;
  end if;

  -- If placeholder or empty, fallback to most recent user
  if v_is_placeholder then
    select email into v_email from auth.users order by created_at desc limit 1;
  end if;

  if v_email is null then
    raise exception 'No users found in auth.users. Please create a user or set :user_email to an existing email.';
  end if;

  select id into v_user from auth.users where email ilike v_email;
  if v_user is null then
    raise exception 'User with email % not found. Please edit seed-reminder-demo.sql and set :user_email to an existing email.', v_email;
  end if;

  -- Ensure required columns exist on public.tasks for the demo insert
  perform 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='due_at';
  if not found then
    execute 'alter table public.tasks add column due_at timestamptz';
  end if;
  perform 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='priority';
  if not found then
    execute 'alter table public.tasks add column priority text default ''medium''';
  end if;
  perform 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='status';
  if not found then
    execute 'alter table public.tasks add column status text default ''pending''';
  end if;
  perform 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='description';
  if not found then
    execute 'alter table public.tasks add column description text';
  end if;

  -- Create a demo task due in 2 hours (handle schemas where start_date is NOT NULL)
  -- Detect start_date nullability/type
  declare
  v_start_date_nullable text;
  v_start_date_type text;
  v_due_date_nullable text;
  v_due_date_type text;
    v_cols text := 'id, title, description, priority, status, due_at';
    v_vals text := 'gen_random_uuid(), ''DEMO Nhắc việc'', ''Task demo để kiểm tra bộ nhắc'', ''medium'', ''pending'', now() + interval ''2 hours''' ;
  begin
    select is_nullable, data_type
      into v_start_date_nullable, v_start_date_type
    from information_schema.columns
    where table_schema='public' and table_name='tasks' and column_name='start_date';

    if found and v_start_date_nullable = 'NO' then
      -- Add start_date with a safe default based on column type
      v_cols := v_cols || ', start_date';
      if v_start_date_type = 'date' then
        v_vals := v_vals || ', current_date';
      else
        v_vals := v_vals || ', now()';
      end if;
    end if;

    -- Handle due_date if it exists and is NOT NULL
    select is_nullable, data_type
      into v_due_date_nullable, v_due_date_type
    from information_schema.columns
    where table_schema='public' and table_name='tasks' and column_name='due_date';

    if found and v_due_date_nullable = 'NO' then
      v_cols := v_cols || ', due_date';
      if v_due_date_type = 'date' then
        v_vals := v_vals || ', (now() + interval ''2 hours'')::date';
      else
        v_vals := v_vals || ', now() + interval ''2 hours''';
      end if;
    end if;

    execute format('insert into public.tasks (%s) values (%s) returning id', v_cols, v_vals)
      into v_task;
  end;

  -- Per-user reminder setting: start immediately and repeat every 4 hours
  insert into public.task_reminder_settings(
    task_id, user_id, active, repeat_hours, start_mode, timezone, quiet_hours, channels, escalate_after
  ) values (
    v_task, v_user, true, 4, 'on_create', 'Asia/Ho_Chi_Minh', '{"start":"22:00","end":"07:00"}', '{push}', 0
  )
  on conflict (task_id, user_id) do update set active = excluded.active;

  -- Optional: immediate smoke test - insert a notification directly
  -- comment this out if you only want the scheduler/script to generate
  insert into public.notifications(user_id, title, message, type)
  values (v_user, '🔔 Test thông báo', 'Thông báo test để kiểm tra chuông', 'task_reminder');
end $$;

-- Ensure select-own policy on notifications (client can read its own)
do $$ begin
  perform 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_select_own';
  if not found then
    execute 'alter table public.notifications enable row level security';
    execute 'create policy notifications_select_own on public.notifications for select using (auth.uid() = user_id)';
  end if;
exception when others then null; end $$;
