-- PECS (комуникация чрез размяна на картинки) — профил на детето, речник, занимания с опити,
-- преходи между етапите и „Кое избира?“ (подреждане на мотиваторите).
-- Пишат и четат всички, които работят с детето (класен, учители с часове в паралелката, ИФО, ЦОУД,
-- терапевти, ЕПЛР екип), координаторите и ръководството. Безопасно за повторно пускане.

-- Работи ли текущият служител с това дете (през текущата година)
create or replace function public.works_with_student(p_student uuid) returns boolean
language sql stable as $$
  select get_my_role()::text in ('admin', 'zdud', 'director')
    or exists (select 1 from staff_profiles where id = get_my_staff_id() and is_coordinator)
    or exists (select 1 from students s where s.id = p_student and get_my_staff_id() in (
         s.therapist_psychologist_id, s.therapist_speech_id, s.therapist_rehab_id, s.therapist_rehab2_id))
    or exists (select 1 from eplr_teams t join academic_years y on y.id = t.academic_year_id and y.is_current
               where t.student_id = p_student and get_my_staff_id() in (
                 t.psychologist_id, t.speech_therapist_id, t.rehabilitator_id, t.class_teacher_id))
    -- класен на паралелката
    or exists (select 1 from student_enrollments e
               join academic_years y on y.id = e.academic_year_id and y.is_current
               join class_teacher_assignments c on c.class_id = e.class_id and c.academic_year_id = e.academic_year_id
               where e.student_id = p_student and c.staff_id = get_my_staff_id())
    -- има часове в паралелката
    or exists (select 1 from student_enrollments e
               join academic_years y on y.id = e.academic_year_id and y.is_current
               join class_schedules cs on cs.class_id = e.class_id and cs.academic_year_id = e.academic_year_id
               join schedule_slots sl on sl.schedule_id = cs.id
               where e.student_id = p_student and sl.staff_id = get_my_staff_id())
    -- ИФО часове с детето
    or exists (select 1 from teacher_ifo_slots f join academic_years y on y.id = f.academic_year_id and y.is_current
               where f.student_id = p_student and f.teacher_id = get_my_staff_id())
    -- възпитател на ЦОУД групата му
    or exists (select 1 from coud_enrollments ce
               join coud_groups g on g.id = ce.coud_group_id
               join academic_years y on y.id = ce.academic_year_id and y.is_current
               where ce.student_id = p_student and g.teacher_id = get_my_staff_id())
$$;

-- Профил: етап, от кога, критерий за преминаване
create table if not exists public.pecs_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  phase smallint not null default 1 check (phase between 1 and 6),
  phase_since date not null default current_date,
  started_at date not null default current_date,
  started_by uuid references public.staff_profiles(id) on delete set null,
  criterion_pct smallint not null default 80 check (criterion_pct between 50 and 100),
  criterion_sessions smallint not null default 3 check (criterion_sessions between 1 and 10),
  note text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- История на етапите (пътят на детето)
create table if not exists public.pecs_phase_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  phase smallint not null check (phase between 1 and 6),
  changed_on date not null default current_date,
  changed_by uuid references public.staff_profiles(id) on delete set null,
  note text
);
create index if not exists pecs_phase_log_idx on public.pecs_phase_log (student_id, changed_on);

-- Речникът на детето: картинки (пиктограма или снимка) и мотиватори
create table if not exists public.pecs_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  label text not null,
  picto_key text,                 -- пиктограма от public/pictos
  photo text,                     -- или малка снимка (JPEG dataURL, ~50 KB)
  is_reinforcer boolean not null default false,
  status text not null default 'learning' check (status in ('learning', 'independent', 'archived')),
  added_on date not null default current_date,
  mastered_on date,
  added_by uuid references public.staff_profiles(id) on delete set null,
  sort int not null default 0
);
create index if not exists pecs_items_idx on public.pecs_items (student_id);

-- Занимания (броячите са тук за бързите графики) и опитите в тях
create table if not exists public.pecs_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  held_on date not null default current_date,
  phase smallint not null check (phase between 1 and 6),
  place text,
  trials int not null default 0,
  independent int not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists pecs_sessions_idx on public.pecs_sessions (student_id, held_on);

create table if not exists public.pecs_trials (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pecs_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  item_id uuid references public.pecs_items(id) on delete set null,
  prompt text not null check (prompt in ('independent', 'partial', 'full', 'error')),
  seq int not null default 0
);
create index if not exists pecs_trials_idx on public.pecs_trials (student_id, item_id);

-- „Кое избира?“ — избор между два предмета (за подреждане на мотиваторите)
create table if not exists public.pecs_preferences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  item_a uuid not null references public.pecs_items(id) on delete cascade,
  item_b uuid not null references public.pecs_items(id) on delete cascade,
  chosen uuid references public.pecs_items(id) on delete cascade,   -- празно = не избра нито едно
  chosen_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Достъп: само който работи с детето (+ координатори и ръководство)
do $$
declare t text;
begin
  foreach t in array array['pecs_profiles', 'pecs_phase_log', 'pecs_items', 'pecs_sessions', 'pecs_trials', 'pecs_preferences'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select to authenticated using (works_with_student(student_id))', t, t);
    execute format('drop policy if exists "%s_insert" on public.%I', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check (works_with_student(student_id))', t, t);
    execute format('drop policy if exists "%s_update" on public.%I', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using (works_with_student(student_id)) with check (works_with_student(student_id))', t, t);
  end loop;
end $$;

-- триене: картинки и предпочитания — всеки от екипа; занимания — авторът или ръководството; профил — ръководството
drop policy if exists "pecs_items_delete" on public.pecs_items;
create policy "pecs_items_delete" on public.pecs_items for delete to authenticated using (works_with_student(student_id));
drop policy if exists "pecs_preferences_delete" on public.pecs_preferences;
create policy "pecs_preferences_delete" on public.pecs_preferences for delete to authenticated using (works_with_student(student_id));
drop policy if exists "pecs_sessions_delete" on public.pecs_sessions;
create policy "pecs_sessions_delete" on public.pecs_sessions for delete to authenticated
  using (works_with_student(student_id) and (staff_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director')));
drop policy if exists "pecs_trials_delete" on public.pecs_trials;
create policy "pecs_trials_delete" on public.pecs_trials for delete to authenticated
  using (exists (select 1 from pecs_sessions s where s.id = session_id
                 and (s.staff_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'))));
drop policy if exists "pecs_profiles_delete" on public.pecs_profiles;
create policy "pecs_profiles_delete" on public.pecs_profiles for delete to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'));
