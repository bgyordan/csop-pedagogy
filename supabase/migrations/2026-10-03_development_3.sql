-- РАЗВИТИЕ 3: оценките, профила, целите и GAS ги записват само психолозите, логопедите, координиращият екип и управата.
-- Останалите от екипа (рехабилитатор, класен…) само разглеждат. Безопасно за повторно пускане.
create or replace function public.dev_can_assess() returns boolean
language sql stable as $$
  select get_my_role()::text in ('psychologist', 'speech_therapist', 'admin', 'zdud', 'director')
      or exists (select 1 from staff_profiles where id = get_my_staff_id() and is_coordinator)
$$;

drop policy if exists "dev_assessments_insert" on public.dev_assessments;
create policy "dev_assessments_insert" on public.dev_assessments for insert to authenticated
  with check (assessor_id = get_my_staff_id() and dev_can_assess() and dev_can_see_student(student_id));

drop policy if exists "dev_skills_add" on public.dev_skills;
create policy "dev_skills_add" on public.dev_skills for insert to authenticated with check (dev_can_assess());

drop policy if exists "dev_targets_write" on public.dev_targets;
create policy "dev_targets_write" on public.dev_targets for all to authenticated
  using (dev_can_assess() and dev_can_see_student(student_id)) with check (dev_can_assess() and dev_can_see_student(student_id));

drop policy if exists "dev_profiles_write" on public.dev_profiles;
create policy "dev_profiles_write" on public.dev_profiles for all to authenticated
  using (dev_can_assess() and dev_can_see_student(student_id)) with check (dev_can_assess() and dev_can_see_student(student_id));

drop policy if exists "dev_gas_write" on public.dev_gas;
create policy "dev_gas_write" on public.dev_gas for all to authenticated
  using (dev_can_assess() and exists (select 1 from dev_targets t where t.id = target_id and dev_can_see_student(t.student_id)))
  with check (dev_can_assess() and exists (select 1 from dev_targets t where t.id = target_id and dev_can_see_student(t.student_id)));
