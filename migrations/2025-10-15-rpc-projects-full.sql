-- Migration: list_projects_full RPC
-- Purpose: Provide full project details (including durations, dates, budget, extension counts, progress, member counts, task stats)
-- Eliminates need for wide client joins & repeated queries on projects page.

create or replace function public.list_projects_full()
returns table(
  id uuid,
  code text,
  name text,
  description text,
  location text,
  start_date date,
  end_date date,
  duration_months int,
  duration_days int,
  total_days int,
  contract_number text,
  status text,
  budget numeric,
  extension_count int,
  extension_date date,
  progress_percent numeric,
  manager jsonb,
  member_count int,
  active_task_count int,
  completed_task_count int,
  created_at timestamptz
) security definer
set search_path = public
language plpgsql as $$
begin
  return query
  select
    pr.id,
    pr.code,
    pr.name,
    pr.description,
    pr.location,
    pr.start_date,
    pr.end_date,
    pr.duration_months,
    pr.duration_days,
    pr.total_days,
    pr.contract_number,
    pr.status,
    pr.budget,
    pr.extension_count,
    pr.extension_date,
    pr.progress_percent,
    (select to_jsonb(mgr) - 'password' - 'raw_app_meta_data'
       from public.profiles mgr where mgr.id = pr.manager_id) as manager,
    (select count(*) from public.project_members pm where pm.project_id = pr.id) as member_count,
    (select count(*) from public.tasks t where t.project_id = pr.id and t.status <> 'completed') as active_task_count,
    (select count(*) from public.tasks t where t.project_id = pr.id and t.status = 'completed') as completed_task_count,
    pr.created_at
  from public.projects pr
  where (
    exists (select 1 from public.project_members pm2 where pm2.project_id = pr.id and pm2.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('manager','admin'))
  )
  order by pr.created_at desc;
end;
$$;

revoke all on function public.list_projects_full() from public;
grant execute on function public.list_projects_full() to authenticated;
grant execute on function public.list_projects_full() to service_role;

comment on function public.list_projects_full() is 'Returns full project information with aggregated stats for authorized user';
