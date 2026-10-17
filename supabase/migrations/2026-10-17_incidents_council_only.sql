-- Дневник на случаите — записва и вижда само екипът: Координационният съвет, координиращият екип и управата.
-- Класният вижда случаите на децата от своята паралелка само в досието (за четене); не пише, не добавя бележки.

-- „екипът“: управата, членовете на Координационния съвет (текущата година) и координиращият екип
create or replace function public.incident_is_council() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('admin', 'zdud', 'director')
    or exists (select 1 from staff_profiles s where s.id = get_my_staff_id() and s.is_coordinator)
    or exists (select 1 from bullying_council_members m join academic_years y on y.id = m.academic_year_id and y.is_current
               where m.staff_id = get_my_staff_id())
$$;

-- вижда: екипът — всички; класният — случаите с деца от паралелката му (само за четене)
create or replace function public.incident_can_see(p_case uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select incident_is_council()
    or exists (select 1 from incident_participants p
               join student_enrollments e on e.student_id = p.student_id
               join academic_years y on y.id = e.academic_year_id and y.is_current
               join class_teacher_assignments t on t.class_id = e.class_id and t.academic_year_id = e.academic_year_id
               where p.case_id = p_case and t.staff_id = get_my_staff_id())
$$;

drop policy if exists "incident_cases_insert" on public.incident_cases;
create policy "incident_cases_insert" on public.incident_cases for insert to authenticated
  with check (incident_is_council() and reported_by = get_my_staff_id());
drop policy if exists "incident_cases_update" on public.incident_cases;
create policy "incident_cases_update" on public.incident_cases for update to authenticated
  using (incident_is_council()) with check (incident_is_council());

drop policy if exists "incident_participants_write" on public.incident_participants;
create policy "incident_participants_write" on public.incident_participants for all to authenticated
  using (incident_is_council()) with check (incident_is_council());

drop policy if exists "incident_events_insert" on public.incident_events;
create policy "incident_events_insert" on public.incident_events for insert to authenticated
  with check (staff_id = get_my_staff_id() and incident_is_council());

notify pgrst, 'reload schema';
