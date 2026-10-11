-- ПАСПОРТ НА ДЕТЕТО: една страница „как да подкрепим детето“ — за заместници, възпитатели в ЦОУД и нови колеги.
-- Четат го педагогическите роли (без деловодител и помощен персонал), както „Развитие“.
-- Пишат го управата, координаторите, класният на паралелката и ЕПЛР екипът / терапевтите на детето.
-- Безопасно за повторно пускане.

create table if not exists public.student_passports (
  student_id uuid primary key references public.students(id) on delete cascade,
  communication text[] not null default '{}',      -- speech / words / gestures / pictures / device
  communication_note text,
  likes text,                                      -- какво харесва и го мотивира
  triggers text,                                   -- какво го тревожи или провокира
  calming text,                                    -- какво го успокоява
  eating text check (eating in ('self', 'help')),
  eating_note text,
  toilet text check (toilet in ('self', 'help', 'diaper')),
  mobility text check (mobility in ('self', 'help', 'wheelchair')),
  safety text,                                     -- важно за безопасността (кратко)
  updated_by uuid references public.staff_profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Кой може да попълва паспорта на това дете
create or replace function public.passport_can_edit(p_student uuid) returns boolean
language sql stable as $$
  select get_my_role()::text in ('admin', 'zdud', 'director')
    or exists (select 1 from staff_profiles where id = get_my_staff_id() and is_coordinator)
    -- терапевтите, които работят с детето
    or exists (select 1 from students s where s.id = p_student and get_my_staff_id() in (
         s.therapist_psychologist_id, s.therapist_speech_id, s.therapist_rehab_id, s.therapist_rehab2_id))
    -- ЕПЛР екипът за текущата година
    or exists (select 1 from eplr_teams t join academic_years y on y.id = t.academic_year_id and y.is_current
               where t.student_id = p_student and get_my_staff_id() in (
                 t.psychologist_id, t.speech_therapist_id, t.rehabilitator_id, t.class_teacher_id))
    -- класният ръководител на паралелката на детето
    or exists (select 1 from student_enrollments e
               join academic_years y on y.id = e.academic_year_id and y.is_current
               join class_teacher_assignments c on c.class_id = e.class_id and c.academic_year_id = e.academic_year_id
               where e.student_id = p_student and c.staff_id = get_my_staff_id())
$$;

alter table public.student_passports enable row level security;

drop policy if exists "passports_read" on public.student_passports;
create policy "passports_read" on public.student_passports for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));

drop policy if exists "passports_insert" on public.student_passports;
create policy "passports_insert" on public.student_passports for insert to authenticated
  with check (passport_can_edit(student_id));

drop policy if exists "passports_update" on public.student_passports;
create policy "passports_update" on public.student_passports for update to authenticated
  using (passport_can_edit(student_id)) with check (passport_can_edit(student_id));

drop policy if exists "passports_delete" on public.student_passports;
create policy "passports_delete" on public.student_passports for delete to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'));
