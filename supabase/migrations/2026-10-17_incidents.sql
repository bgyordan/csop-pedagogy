-- Дневник на случаите — тормоз (по Механизма за противодействие на тормоза и насилието) и инциденти с поведение.
-- Заменя хартиената книга: всеки случай остава с диря от констатирането до приключването (събития по време)
-- и може да се анализира (кога, къде, кои деца, какво предшества поведението).
-- Вижда: Координационният съвет и ръководството — всички; колегата, който е констатирал — своите;
-- класният — случаите с деца от паралелката му. Записва всеки служител. Безопасно за повторно пускане.

create table if not exists public.incident_cases (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references public.academic_years(id) on delete set null,
  number int not null,                                  -- пореден № в годината (като в книгата)
  kind text not null check (kind in ('bullying', 'behavior')),
  occurred_on date not null default current_date,
  occurred_time time,
  place text,
  forms text[] not null default '{}',                   -- форми на тормоза / видове поведение
  level smallint check (level between 1 and 3),         -- ниво I–III (тормоз) / тежест (поведение)
  description text not null,                            -- какво точно се е случило (факти)
  antecedents text[] not null default '{}',             -- какво предшества (за анализ)
  antecedent_note text,
  consequences text[] not null default '{}',            -- какво последва / как реагирахме
  consequence_note text,
  actions text[] not null default '{}',                 -- незабавни действия
  parents_notified boolean not null default false,
  status text not null default 'new' check (status in ('new', 'review', 'measures', 'closed')),
  closed_on date,
  outcome text,
  protocol_id uuid references public.bullying_protocols(id) on delete set null,
  reported_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists incident_cases_year_idx on public.incident_cases (academic_year_id, occurred_on);

create table if not exists public.incident_participants (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.incident_cases(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  name text,                                            -- ако не е от ЦСОП / не е известен
  role text not null check (role in ('victim', 'perpetrator', 'witness', 'involved', 'affected'))
);
create index if not exists incident_participants_case_idx on public.incident_participants (case_id);
create index if not exists incident_participants_student_idx on public.incident_participants (student_id);

-- Дирята: бележки, мерки, разговори с родители, смяна на статуса
create table if not exists public.incident_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.incident_cases(id) on delete cascade,
  kind text not null check (kind in ('note', 'status', 'measure', 'parent', 'protocol')),
  text text not null,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  at timestamptz not null default now()
);
create index if not exists incident_events_case_idx on public.incident_events (case_id, at);

-- Член на Координационния съвет (текущата година) или ръководство
create or replace function public.incident_is_council() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('admin', 'zdud', 'director')
    or exists (select 1 from bullying_council_members m join academic_years y on y.id = m.academic_year_id and y.is_current
               where m.staff_id = get_my_staff_id())
$$;

-- Вижда ли текущият служител случая
create or replace function public.incident_can_see(p_case uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select incident_is_council()
    or exists (select 1 from incident_cases c where c.id = p_case and c.reported_by = get_my_staff_id())
    or exists (select 1 from incident_participants p
               join student_enrollments e on e.student_id = p.student_id
               join academic_years y on y.id = e.academic_year_id and y.is_current
               join class_teacher_assignments t on t.class_id = e.class_id and t.academic_year_id = e.academic_year_id
               where p.case_id = p_case and t.staff_id = get_my_staff_id())
$$;

alter table public.incident_cases enable row level security;
alter table public.incident_participants enable row level security;
alter table public.incident_events enable row level security;

drop policy if exists "incident_cases_read" on public.incident_cases;
create policy "incident_cases_read" on public.incident_cases for select to authenticated using (incident_can_see(id));
drop policy if exists "incident_cases_insert" on public.incident_cases;
create policy "incident_cases_insert" on public.incident_cases for insert to authenticated with check (reported_by = get_my_staff_id());
-- редакция: съветът и ръководството; авторът — докато случаят е „нов“
drop policy if exists "incident_cases_update" on public.incident_cases;
create policy "incident_cases_update" on public.incident_cases for update to authenticated
  using (incident_is_council() or (reported_by = get_my_staff_id() and status = 'new'))
  with check (incident_is_council() or (reported_by = get_my_staff_id() and status = 'new'));
drop policy if exists "incident_cases_delete" on public.incident_cases;
create policy "incident_cases_delete" on public.incident_cases for delete to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'));

drop policy if exists "incident_participants_read" on public.incident_participants;
create policy "incident_participants_read" on public.incident_participants for select to authenticated using (incident_can_see(case_id));
drop policy if exists "incident_participants_write" on public.incident_participants;
create policy "incident_participants_write" on public.incident_participants for all to authenticated
  using (incident_is_council() or exists (select 1 from incident_cases c where c.id = case_id and c.reported_by = get_my_staff_id() and c.status = 'new'))
  with check (incident_is_council() or exists (select 1 from incident_cases c where c.id = case_id and c.reported_by = get_my_staff_id() and c.status = 'new'));

drop policy if exists "incident_events_read" on public.incident_events;
create policy "incident_events_read" on public.incident_events for select to authenticated using (incident_can_see(case_id));
-- бележка добавя всеки, който вижда случая (напр. класният); триене — само ръководството
drop policy if exists "incident_events_insert" on public.incident_events;
create policy "incident_events_insert" on public.incident_events for insert to authenticated
  with check (staff_id = get_my_staff_id() and incident_can_see(case_id));
drop policy if exists "incident_events_delete" on public.incident_events;
create policy "incident_events_delete" on public.incident_events for delete to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'));

-- Пореден номер в годината — от базата, за да няма два еднакви
create or replace function public.incident_next_number(p_year uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(number), 0) + 1 from incident_cases where academic_year_id is not distinct from p_year
$$;

notify pgrst, 'reload schema';
