-- Отсъствия на децата по период — отразява ги класният (семейни причини, медицинска бележка, друго),
-- за да ги видят терапевтите и учителите на детето и да си планират часовете.
-- Дневникът на отсъствията остава в НЕИСПУО; тук е само „детето няма да е тук от–до“.
-- Без диагнози — само видът на бележката. Безопасно за повторно пускане.

create table if not exists public.student_absences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  reason text not null check (reason in ('family', 'medical', 'other')),
  note text,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);
create index if not exists student_absences_idx on public.student_absences (student_id, date_from, date_to);

-- Кой отразява: класният на паралелката (текущата година), координаторите и ръководството
create or replace function public.can_mark_student_absence(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('admin', 'zdud', 'director')
    or exists (select 1 from staff_profiles where id = get_my_staff_id() and is_coordinator)
    or exists (select 1 from student_enrollments e
               join academic_years y on y.id = e.academic_year_id and y.is_current
               join class_teacher_assignments c on c.class_id = e.class_id and c.academic_year_id = e.academic_year_id
               where e.student_id = p_student and c.staff_id = get_my_staff_id())
$$;

alter table public.student_absences enable row level security;
-- виждат всички, които работят с детето (works_with_student — от PECS)
drop policy if exists "student_absences_read" on public.student_absences;
create policy "student_absences_read" on public.student_absences for select to authenticated
  using (works_with_student(student_id) or can_mark_student_absence(student_id));
drop policy if exists "student_absences_write" on public.student_absences;
create policy "student_absences_write" on public.student_absences for all to authenticated
  using (can_mark_student_absence(student_id)) with check (can_mark_student_absence(student_id));

notify pgrst, 'reload schema';
