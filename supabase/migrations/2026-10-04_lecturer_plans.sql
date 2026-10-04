-- Лекторски: годишният брой часове над норматива за всеки учител (бърза таблица)
-- и колко седмици е II срок за неговите класове (18 / 16 / 14).
-- От тях системата разпределя часовете в разписанието (lecturer_slots).

create table if not exists public.lecturer_plans (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  total_hours integer not null default 0 check (total_hours >= 0),
  term2_weeks smallint not null default 18 check (term2_weeks between 1 and 26),
  distributed_at timestamptz,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (staff_id, academic_year_id)
);

alter table public.lecturer_plans enable row level security;

drop policy if exists lecturer_plans_read on public.lecturer_plans;
create policy lecturer_plans_read on public.lecturer_plans for select to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director') or staff_id = get_my_staff_id());

drop policy if exists lecturer_plans_write on public.lecturer_plans;
create policy lecturer_plans_write on public.lecturer_plans for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));
