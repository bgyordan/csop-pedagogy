-- Родители/настойници на дете: въвеждат и редактират админ, ЗДУД, деловодството
-- и КЛАСНИЯТ на паралелката на детето за текущата учебна година (по разпределението
-- class_teacher_assignments, не по роля — класен може да е и с роля „учител“).
-- Само ДОБАВЯ права (ново разрешаващо правило); досегашните правила остават.
-- Безопасно за повторно пускане. Пуска се веднъж в Studio → SQL Editor.

create or replace function public.can_edit_student_guardians(sid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(get_my_role()::text in ('admin', 'zdud', 'secretary'), false)
  or exists (
    select 1
    from student_enrollments e
    join academic_years y on y.id = e.academic_year_id and y.is_current
    join class_teacher_assignments c
      on c.class_id = e.class_id and c.academic_year_id = e.academic_year_id
    where e.student_id = sid
      and c.staff_id = get_my_staff_id()
  )
$$;

drop policy if exists "guardians_edit_dossier" on public.student_guardians;
create policy "guardians_edit_dossier" on public.student_guardians
  for all to authenticated
  using (public.can_edit_student_guardians(student_id))
  with check (public.can_edit_student_guardians(student_id));
