-- Add order_index columns and RPCs to support inserting items at arbitrary positions
-- 1) Add order_index to tasks
alter table if exists public.tasks
  add column if not exists order_index int;

-- Ensure non-negative when present (safe-guard)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_order_index_nonneg'
  ) then
    alter table public.tasks
      add constraint tasks_order_index_nonneg
      check (order_index is null or order_index >= 0);
  end if;
end$$;

-- Initialize order_index per project when null
with ranked as (
  select id, row_number() over (partition by project_id order by created_at asc) - 1 as rn
  from public.tasks
)
update public.tasks t
set order_index = r.rn
from ranked r
where t.id = r.id and t.order_index is null;

-- Helpful index
create index if not exists tasks_project_order_idx on public.tasks(project_id, order_index asc);

-- 2) Add order_index to progress_items
alter table if exists public.progress_items
  add column if not exists order_index int;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'progress_items_order_index_nonneg'
  ) then
    alter table public.progress_items
      add constraint progress_items_order_index_nonneg
      check (order_index is null or order_index >= 0);
  end if;
end$$;

with ranked_pi as (
  select id, row_number() over (partition by project_id order by created_at asc) - 1 as rn
  from public.progress_items
)
update public.progress_items t
set order_index = r.rn
from ranked_pi r
where t.id = r.id and t.order_index is null;

create index if not exists progress_items_project_order_idx on public.progress_items(project_id, order_index asc);

-- 3) RPCs to shift order to make room for insertion
-- Shift tasks order starting from p_from (0-based index)
create or replace function public.shift_task_order(p_project_id uuid, p_from int, p_count int)
returns int language plpgsql security definer set search_path = public as $$
declare v_changed int;
begin
  -- permission guard: project member or global manager/admin
  if not (
    exists (select 1 from public.project_members pm where pm.project_id = p_project_id and pm.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin'))
  ) then
    raise exception 'not allowed';
  end if;

  update public.tasks
     set order_index = order_index + p_count
   where project_id = p_project_id
     and order_index >= p_from;
  get diagnostics v_changed = row_count;
  return coalesce(v_changed,0);
end;$$;

revoke all on function public.shift_task_order(uuid,int,int) from public;
grant execute on function public.shift_task_order(uuid,int,int) to authenticated;

-- Shift progress_items order starting from p_from (0-based index)
create or replace function public.shift_progress_order(p_project_id uuid, p_from int, p_count int)
returns int language plpgsql security definer set search_path = public as $$
declare v_changed int;
begin
  -- permission guard: project member or global manager/admin
  if not (
    exists (select 1 from public.project_members pm where pm.project_id = p_project_id and pm.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin'))
  ) then
    raise exception 'not allowed';
  end if;

  update public.progress_items
     set order_index = order_index + p_count
   where project_id = p_project_id
     and order_index >= p_from;
  get diagnostics v_changed = row_count;
  return coalesce(v_changed,0);
end;$$;

revoke all on function public.shift_progress_order(uuid,int,int) from public;
grant execute on function public.shift_progress_order(uuid,int,int) to authenticated;

-- 4) Recreate list_tasks_overview to include order_index and prefer ordering by it
DROP FUNCTION IF EXISTS public.list_tasks_overview();

CREATE OR REPLACE FUNCTION public.list_tasks_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $LIST_TASKS_OVERVIEW$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(t)) FROM (
      SELECT tk.id,
             tk.title,
             tk.description,
             tk.status,
             tk.priority,
             tk.start_date,
             tk.due_date,
             tk.created_at,
             tk.project_id,
             tk.assigned_to,
             tk.assigned_by,
             tk.order_index,
             -- Include task type and recurrence columns for UI
             tk.task_type,
             tk.recurrence_frequency,
             tk.recurrence_interval,
             tk.recurrence_end_date,
             tk.recurrence_weekday,
             tk.recurrence_month_day,
             tk.recurrence_quarter,
             tk.recurrence_quarter_month_index,
             tk.next_recurrence_date,
             (SELECT jsonb_build_object('id', p1.id,'full_name',p1.full_name,'email',p1.email)
              FROM public.profiles p1 WHERE p1.id = tk.assigned_to) AS assigned_to_user,
             (SELECT jsonb_build_object('id', p2.id,'full_name',p2.full_name,'email',p2.email)
              FROM public.profiles p2 WHERE p2.id = tk.assigned_by) AS assigned_by_user,
             (SELECT jsonb_build_object('id', pr.id,'name',pr.name,'code',pr.code)
              FROM public.projects pr WHERE pr.id = tk.project_id) AS project,
             -- New: list of co-assignees and count
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email))
               FROM public.task_assignees ta
               JOIN public.profiles p ON p.id = ta.user_id
               WHERE ta.task_id = tk.id
             ), '[]'::jsonb) AS additional_assignees,
             (SELECT COUNT(*) FROM public.task_assignees ta WHERE ta.task_id = tk.id) AS multi_assignee_count
      FROM public.tasks tk
      WHERE (
        EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = tk.project_id AND pm.user_id = auth.uid())
      ) OR (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager','admin'))
      )
      ORDER BY (CASE WHEN tk.order_index IS NULL THEN 1 ELSE 0 END) ASC, tk.order_index ASC, tk.created_at DESC
    ) t
  );
END;
$LIST_TASKS_OVERVIEW$;

REVOKE ALL ON FUNCTION public.list_tasks_overview() FROM public;
GRANT EXECUTE ON FUNCTION public.list_tasks_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tasks_overview() TO service_role;

-- 5) Move helpers: atomically move a single row within a project's ordering
-- Move a task to a target 0-based position, shifting others accordingly
create or replace function public.move_task_order(p_project_id uuid, p_item_id uuid, p_to int)
returns void language plpgsql security definer set search_path = public as $$
declare 
  v_from int;
  v_max int;
begin
  -- permission guard: project member or global manager/admin
  if not (
    exists (select 1 from public.project_members pm where pm.project_id = p_project_id and pm.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin'))
  ) then
    raise exception 'not allowed';
  end if;

  select order_index into v_from from public.tasks where id = p_item_id and project_id = p_project_id;
  if v_from is null then
    -- item not found or no order_index yet -> initialize at end, then continue
    select coalesce(max(order_index), -1) + 1 into v_from from public.tasks where project_id = p_project_id;
    update public.tasks set order_index = v_from where id = p_item_id and project_id = p_project_id;
  end if;
  if p_to is null or p_to = v_from then return; end if;
  if p_to < 0 then p_to := 0; end if;
  -- clamp to current list size
  select coalesce(max(order_index), -1) into v_max from public.tasks where project_id = p_project_id;
  if p_to > v_max then p_to := v_max + 1; end if;

  if p_to > v_from then
    -- moving down: pull up rows between (v_from, p_to]
    update public.tasks
       set order_index = order_index - 1
     where project_id = p_project_id
       and order_index > v_from and order_index <= p_to;
  else
    -- moving up: push down rows between [p_to, v_from)
    update public.tasks
       set order_index = order_index + 1
     where project_id = p_project_id
       and order_index >= p_to and order_index < v_from;
  end if;
  -- place the item
  update public.tasks set order_index = p_to where id = p_item_id and project_id = p_project_id;
end;$$;

revoke all on function public.move_task_order(uuid,uuid,int) from public;
grant execute on function public.move_task_order(uuid,uuid,int) to authenticated;

-- Move a progress item to a target 0-based position, shifting others accordingly
create or replace function public.move_progress_order(p_project_id uuid, p_item_id uuid, p_to int)
returns void language plpgsql security definer set search_path = public as $$
declare 
  v_from int;
  v_max int;
begin
  -- permission guard: project member or global manager/admin
  if not (
    exists (select 1 from public.project_members pm where pm.project_id = p_project_id and pm.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin'))
  ) then
    raise exception 'not allowed';
  end if;

  select order_index into v_from from public.progress_items where id = p_item_id and project_id = p_project_id;
  if v_from is null then
    select coalesce(max(order_index), -1) + 1 into v_from from public.progress_items where project_id = p_project_id;
    update public.progress_items set order_index = v_from where id = p_item_id and project_id = p_project_id;
  end if;
  if p_to is null or p_to = v_from then return; end if;
  if p_to < 0 then p_to := 0; end if;
  select coalesce(max(order_index), -1) into v_max from public.progress_items where project_id = p_project_id;
  if p_to > v_max then p_to := v_max + 1; end if;

  if p_to > v_from then
    update public.progress_items
       set order_index = order_index - 1
     where project_id = p_project_id
       and order_index > v_from and order_index <= p_to;
  else
    update public.progress_items
       set order_index = order_index + 1
     where project_id = p_project_id
       and order_index >= p_to and order_index < v_from;
  end if;
  update public.progress_items set order_index = p_to where id = p_item_id and project_id = p_project_id;
end;$$;

revoke all on function public.move_progress_order(uuid,uuid,int) from public;
grant execute on function public.move_progress_order(uuid,uuid,int) to authenticated;

-- 6) Triggers to auto-assign order_index at insert (append to end if not provided)
create or replace function public.set_default_task_order_index()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.order_index is null then
    select coalesce(max(order_index), -1) + 1 into new.order_index from public.tasks where project_id = new.project_id;
  end if;
  return new;
end;$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_tasks_set_default_order_index'
  ) then
    create trigger trg_tasks_set_default_order_index
    before insert on public.tasks
    for each row execute function public.set_default_task_order_index();
  end if;
end$$;

create or replace function public.set_default_progress_order_index()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.order_index is null then
    select coalesce(max(order_index), -1) + 1 into new.order_index from public.progress_items where project_id = new.project_id;
  end if;
  return new;
end;$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_progress_set_default_order_index'
  ) then
    create trigger trg_progress_set_default_order_index
    before insert on public.progress_items
    for each row execute function public.set_default_progress_order_index();
  end if;
end$$;

-- 7) Maintenance helpers: rebuild contiguous ordering per project (0..n-1)
create or replace function public.rebuild_task_order(p_project_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_changed int;
begin
  if not (
    exists (select 1 from public.project_members pm where pm.project_id = p_project_id and pm.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin'))
  ) then
    raise exception 'not allowed';
  end if;

  with ranked as (
    select id,
           row_number() over (partition by project_id order by order_index asc nulls last, created_at asc) - 1 as rn
    from public.tasks
    where project_id = p_project_id
  )
  update public.tasks t
     set order_index = r.rn
    from ranked r
   where t.id = r.id;
  get diagnostics v_changed = row_count;
  return coalesce(v_changed,0);
end;$$;

revoke all on function public.rebuild_task_order(uuid) from public;
grant execute on function public.rebuild_task_order(uuid) to authenticated;

create or replace function public.rebuild_progress_order(p_project_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_changed int;
begin
  if not (
    exists (select 1 from public.project_members pm where pm.project_id = p_project_id and pm.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin'))
  ) then
    raise exception 'not allowed';
  end if;

  with ranked as (
    select id,
           row_number() over (partition by project_id order by order_index asc nulls last, created_at asc) - 1 as rn
    from public.progress_items
    where project_id = p_project_id
  )
  update public.progress_items t
     set order_index = r.rn
    from ranked r
   where t.id = r.id;
  get diagnostics v_changed = row_count;
  return coalesce(v_changed,0);
end;$$;

revoke all on function public.rebuild_progress_order(uuid) from public;
grant execute on function public.rebuild_progress_order(uuid) to authenticated;
