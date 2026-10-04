-- Последен учебен ден по групи класове (по графика на МОН) — за лекторските часове.
-- Паралелката в ЦСОП учи до края на годината на детето с най-дълъг учебен срок в нея.

create table if not exists public.school_year_ends (
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  grp text not null check (grp in ('1-3', '4-6', '7-11', '12')),
  end_date date not null,
  primary key (academic_year_id, grp)
);

alter table public.school_year_ends enable row level security;

drop policy if exists school_year_ends_read on public.school_year_ends;
create policy school_year_ends_read on public.school_year_ends for select to authenticated using (true);

drop policy if exists school_year_ends_write on public.school_year_ends;
create policy school_year_ends_write on public.school_year_ends for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));

-- 2026/2027 по графика на МОН: XII — 13.05, I–III — 02.06, IV–VI — 16.06, VII–XI — 02.07.2027
insert into public.school_year_ends (academic_year_id, grp, end_date)
select y.id, v.grp, v.end_date::date
from public.academic_years y
cross join (values ('12', '2027-05-13'), ('1-3', '2027-06-02'), ('4-6', '2027-06-16'), ('7-11', '2027-07-02')) as v(grp, end_date)
where y.start_date >= '2026-08-01' and y.start_date < '2027-08-01'
on conflict (academic_year_id, grp) do nothing;

-- Лекторски могат да се въведат и като часове на седмица (2, 3…) — системата смята годишния брой.
alter table public.lecturer_plans add column if not exists per_week smallint check (per_week is null or per_week between 0 and 30);
