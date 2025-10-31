create table if not exists overlay_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  base_pdf text not null,
  overlay_pdf text not null,
  base_page int not null default 0,
  overlay_page int not null default 0,
  p1b jsonb not null,
  p2b jsonb not null,
  p1o jsonb not null,
  p2o jsonb not null,
  transform jsonb,
  created_at timestamptz default now()
);

create table if not exists clash_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references overlay_sessions(id) on delete cascade,
  total_overlap_px2 double precision not null,
  regions jsonb not null,
  preview_url text,
  geojson_url text,
  created_at timestamptz default now()
);

alter table overlay_sessions enable row level security;
alter table clash_reports enable row level security;

create policy "owner_can_rw_sessions"
on overlay_sessions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "owner_can_rw_reports"
on clash_reports for all
  to authenticated
  using (session_id in (select id from overlay_sessions where user_id = auth.uid()))
  with check (session_id in (select id from overlay_sessions where user_id = auth.uid()));
