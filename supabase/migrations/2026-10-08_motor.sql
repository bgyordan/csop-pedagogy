-- ДВИГАТЕЛНА ОЦЕНКА (раздел „Развитие“): педагогическа карта по ФВС с 62 проби в 13 области.
-- Скала 0–4 по степен на физическа помощ + кодове НП/НО/НР/ОТ (не са 0), опити, ляво/дясно, подкрепа за
-- инструкцията, отметки за качество на движението. Детето се сравнява само със себе си — без общ бал и норми.
-- Каталогът с пробите е в кода (src/lib/motor.ts); тук се пазят само резултатите. Безопасно за повторно пускане.
-- Изисква 2026-10-03_development.sql (dev_can_see_student).

create table if not exists public.motor_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  assessed_on date not null default current_date,
  stage text not null default 'entry' check (stage in ('entry','mid','exit','current')),
  detail text not null default 'basic' check (detail in ('basic','advanced')),
  assessor_id uuid references public.staff_profiles(id) on delete set null,
  -- условия: комуникация, помощни средства, ограничения, пособия/разстояния
  conditions jsonb not null default '{}'::jsonb,
  -- профил по области: { domain: { strengths, priority } }
  profile jsonb not null default '{}'::jsonb,
  observations text,
  created_at timestamptz not null default now()
);
create index if not exists motor_sessions_student_idx on public.motor_sessions (student_id, assessed_on);

create table if not exists public.motor_results (
  session_id uuid not null references public.motor_sessions(id) on delete cascade,
  item smallint not null check (item between 1 and 200),
  score smallint check (score between 0 and 4),
  code text check (code in ('НП','НО','НР','ОТ')),
  t1 numeric, t2 numeric,          -- опит 1 и опит 2 (сек, см, м, брой…)
  l numeric, r numeric,            -- ляво / дясно (за пробите по страни)
  pref text,                       -- предпочитана страна/око
  support text[] not null default '{}',   -- С, В, М, Ж, ПФ, ПП
  quality smallint[] not null default '{}', -- изпълнени критерии за качество (индекси)
  note text,
  primary key (session_id, item),
  check (score is null or code is null)
);

create table if not exists public.motor_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  item smallint,
  domain text,
  goal text not null,
  due date,
  gas smallint check (gas between -2 and 2),
  set_by uuid references public.staff_profiles(id) on delete set null,
  set_at timestamptz not null default now(),
  achieved_at timestamptz
);
create index if not exists motor_goals_student_idx on public.motor_goals (student_id);

alter table public.motor_sessions enable row level security;
alter table public.motor_results enable row level security;
alter table public.motor_goals enable row level security;

drop policy if exists "motor_sessions_read" on public.motor_sessions;
create policy "motor_sessions_read" on public.motor_sessions for select to authenticated
  using (dev_can_see_student(student_id));
drop policy if exists "motor_sessions_insert" on public.motor_sessions;
create policy "motor_sessions_insert" on public.motor_sessions for insert to authenticated
  with check (assessor_id = get_my_staff_id() and dev_can_see_student(student_id));
drop policy if exists "motor_sessions_change" on public.motor_sessions;
create policy "motor_sessions_change" on public.motor_sessions for update to authenticated
  using (assessor_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'));
drop policy if exists "motor_sessions_delete" on public.motor_sessions;
create policy "motor_sessions_delete" on public.motor_sessions for delete to authenticated
  using (assessor_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'));

drop policy if exists "motor_results_read" on public.motor_results;
create policy "motor_results_read" on public.motor_results for select to authenticated
  using (exists (select 1 from motor_sessions s where s.id = session_id));
drop policy if exists "motor_results_write" on public.motor_results;
create policy "motor_results_write" on public.motor_results for all to authenticated
  using (exists (select 1 from motor_sessions s where s.id = session_id
                 and (s.assessor_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'))))
  with check (exists (select 1 from motor_sessions s where s.id = session_id
                 and (s.assessor_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'))));

drop policy if exists "motor_goals_read" on public.motor_goals;
create policy "motor_goals_read" on public.motor_goals for select to authenticated
  using (dev_can_see_student(student_id));
drop policy if exists "motor_goals_write" on public.motor_goals;
create policy "motor_goals_write" on public.motor_goals for all to authenticated
  using (dev_can_see_student(student_id)) with check (dev_can_see_student(student_id));

notify pgrst, 'reload schema';
