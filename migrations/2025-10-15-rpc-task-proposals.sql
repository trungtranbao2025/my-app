-- Migration: list_task_proposals RPC
-- Purpose: Centralize task proposals visibility logic & avoid recursive profile joins from client
-- Returns proposals with lightweight embedded user metadata & project/task refs

create or replace function public.list_task_proposals(
  p_project_id uuid default null,
  p_mode text default 'all'  -- 'all' | 'by_project' | 'pending_for_approval'
)
returns table(
  id uuid,
  task_id uuid,
  project_id uuid,
  status text,
  proposed_action text,
  proposed_changes jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  approved_at timestamptz,
  proposed_by_user jsonb,
  proposed_assignee_user jsonb,
  approver_user jsonb
) security definer
set search_path = public
language plpgsql as $$
declare
  v_uid uuid;
begin
  select auth.uid() into v_uid;

  return query
  with base as (
    select 
      tp.id,
      null::uuid as task_id,                -- No task_id column in current schema (compat placeholder)
      tp.project_id,
      tp.status::text as status,
      null::text as proposed_action,        -- Not present in table
      null::jsonb as proposed_changes,      -- Not present in table
      tp.created_at,
      tp.updated_at,
      tp.approved_at,
      null::jsonb as proposed_by_user,      -- No proposed_by column available
      (select to_jsonb(pa) - 'password' - 'raw_app_meta_data' from public.profiles pa where pa.id = tp.proposed_assignee) as proposed_assignee_user,
      (select to_jsonb(ap) - 'password' - 'raw_app_meta_data' from public.profiles ap where ap.id = tp.approver_id) as approver_user
    from public.task_proposals tp
    where (
      p_mode = 'all'
      or (p_mode = 'by_project' and tp.project_id = p_project_id)
      or (p_mode = 'pending_for_approval' and tp.status = 'pending' and tp.approver_id = v_uid)
    )
    and (p_project_id is null or tp.project_id = p_project_id or p_mode <> 'by_project')
  )
  select * from base order by created_at desc;
end;
$$;

revoke all on function public.list_task_proposals(uuid, text) from public;
grant execute on function public.list_task_proposals(uuid, text) to authenticated;
grant execute on function public.list_task_proposals(uuid, text) to service_role;

comment on function public.list_task_proposals(uuid, text) is 'List task proposals with lightweight user JSON; mode: all|by_project|pending_for_approval';
