-- Учебни планове от НЕИСПУО (внос от обобщената справка „generalInformation.xlsx“).
-- Нова, отделна таблица — нищо съществуващо в EIS не се променя.
-- Всеки ред: паралелка / група ЦОУД / специалист · предмет · часове и седмици по срокове · общо · брой деца · преподавател.

create table if not exists public.curriculum_lines (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  holder_label text not null,                -- както е в НЕИСПУО: „10 паралелка“, „ЦОУД №3“, „Рая Стефанова“
  class_id uuid references public.classes(id) on delete set null,
  coud_group_id uuid references public.coud_groups(id) on delete set null,
  subject text not null,
  hours_t1 numeric(4,1) not null default 0,  -- часове седмично, I срок
  weeks_t1 smallint not null default 0,      -- учебни седмици, I срок
  hours_t2 numeric(4,1) not null default 0,
  weeks_t2 smallint not null default 0,
  total_hours numeric(6,1) not null default 0,
  students smallint,
  teacher_name text,                         -- както е в НЕИСПУО
  staff_id uuid references public.staff_profiles(id) on delete set null,
  imported_at timestamptz not null default now(),
  imported_by uuid references public.staff_profiles(id) on delete set null
);
create index if not exists curriculum_lines_year_idx on public.curriculum_lines (academic_year_id);
create index if not exists curriculum_lines_staff_idx on public.curriculum_lines (staff_id);
create index if not exists curriculum_lines_class_idx on public.curriculum_lines (class_id);

-- Ръчно свързани имена (учител / паралелка от НЕИСПУО → запис в EIS) — помнят се при следващ внос
create table if not exists public.curriculum_name_map (
  kind text not null check (kind in ('staff', 'class', 'coud')),
  source_name text not null,
  target_id uuid not null,
  primary key (kind, source_name)
);

alter table public.curriculum_lines enable row level security;
alter table public.curriculum_name_map enable row level security;

drop policy if exists curriculum_lines_read on public.curriculum_lines;
create policy curriculum_lines_read on public.curriculum_lines for select to authenticated using (true);
drop policy if exists curriculum_lines_write on public.curriculum_lines;
create policy curriculum_lines_write on public.curriculum_lines for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));

drop policy if exists curriculum_name_map_read on public.curriculum_name_map;
create policy curriculum_name_map_read on public.curriculum_name_map for select to authenticated using (true);
drop policy if exists curriculum_name_map_write on public.curriculum_name_map;
create policy curriculum_name_map_write on public.curriculum_name_map for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));
