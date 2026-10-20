-- Дневник на случаите — и класният ръководител вписва случаи (освен Координационния съвет, координиращия екип и управата).
-- Класният: вписва случай, поправя го, докато е „Нов“, добавя бележки/мерки/разговори с родител;
-- вижда своите случаи и тези с деца от паралелката си. Статуса и протокола движи съветът. Безопасно за повторно пускане.

-- класен ръководител на паралелка в текущата година
create or replace function public.incident_is_class_teacher() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_teacher_assignments t join academic_years y on y.id = t.academic_year_id and y.is_current
                 where t.staff_id = get_my_staff_id())
$$;

-- вижда: екипът — всички; авторът — своите; класният — случаите с деца от паралелката му
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

drop policy if exists "incident_cases_insert" on public.incident_cases;
create policy "incident_cases_insert" on public.incident_cases for insert to authenticated
  with check ((incident_is_council() or incident_is_class_teacher()) and reported_by = get_my_staff_id());

drop policy if exists "incident_cases_update" on public.incident_cases;
create policy "incident_cases_update" on public.incident_cases for update to authenticated
  using (incident_is_council() or (reported_by = get_my_staff_id() and status = 'new'))
  with check (incident_is_council() or (reported_by = get_my_staff_id() and status = 'new'));

drop policy if exists "incident_participants_write" on public.incident_participants;
create policy "incident_participants_write" on public.incident_participants for all to authenticated
  using (incident_is_council() or exists (select 1 from incident_cases c where c.id = case_id and c.reported_by = get_my_staff_id() and c.status = 'new'))
  with check (incident_is_council() or exists (select 1 from incident_cases c where c.id = case_id and c.reported_by = get_my_staff_id() and c.status = 'new'));

-- бележка/мярка/разговор с родител — всеки, който вижда случая
drop policy if exists "incident_events_insert" on public.incident_events;
create policy "incident_events_insert" on public.incident_events for insert to authenticated
  with check (staff_id = get_my_staff_id() and incident_can_see(case_id));

notify pgrst, 'reload schema';
