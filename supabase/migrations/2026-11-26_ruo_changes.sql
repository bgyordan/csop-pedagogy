-- Доклад за промени в паралелките до РУО.
-- ruo_snapshots: съставът на паралелките в момента на подаден доклад (начален или за промени).
--   Следващият доклад се смята като разлика между текущия състав и последната снимка.
-- ruo_change_details: номерата на документите за децата, които постъпват или излизат,
--   спрямо определена снимка (попълват се постепенно; липсващите излизат в жълто в Word).
-- Безопасно за повторно пускане.

create table if not exists public.ruo_snapshots (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references public.academic_years(id) on delete cascade,
  out_number text,                 -- изх. № на подадения доклад
  out_date date,
  note text,
  data jsonb not null,             -- [{ className, students: [{ id, name, school, externalClass }] }]
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ruo_snapshots_year_idx on public.ruo_snapshots (academic_year_id, created_at);

create table if not exists public.ruo_change_details (
  snapshot_id uuid not null references public.ruo_snapshots(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null check (kind in ('in', 'out')),   -- in = постъпва в ЦСОП, out = отписан
  parent_name text,
  application_no text,             -- вх. № на заявлението (за записване / за отписване)
  opinion_no text,                 -- № на становището на РЦПППО
  opinion_in_no text,              -- вх. № на становището при нас
  order_no text,                   -- заповед за отписване
  updated_at timestamptz not null default now(),
  primary key (snapshot_id, student_id, kind)
);

alter table public.ruo_snapshots enable row level security;
alter table public.ruo_change_details enable row level security;

drop policy if exists "ruo_snapshots_all" on public.ruo_snapshots;
create policy "ruo_snapshots_all" on public.ruo_snapshots for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));

drop policy if exists "ruo_change_details_all" on public.ruo_change_details;
create policy "ruo_change_details_all" on public.ruo_change_details for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));

notify pgrst, 'reload schema';
