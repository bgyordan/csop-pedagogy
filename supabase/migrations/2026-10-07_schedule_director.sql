-- Разписание: директорът (като админ и ЗДУД) може да редактира часовете от името на друг служител
-- и да освобождава чужди часове. Своите часове всеки служител пише и досега (staff_id = аз).
drop policy if exists slots_write on public.schedule_slots;
create policy slots_write on public.schedule_slots for all to public
  using (
    staff_id in (select id from public.staff_profiles where user_id = auth.uid())
    or exists (select 1 from public.staff_profiles where user_id = auth.uid() and role in ('admin', 'zdud', 'director'))
  )
  with check (
    staff_id in (select id from public.staff_profiles where user_id = auth.uid())
    or exists (select 1 from public.staff_profiles where user_id = auth.uid() and role in ('admin', 'zdud', 'director'))
  );

drop policy if exists teacher_ifo_write on public.teacher_ifo_slots;
create policy teacher_ifo_write on public.teacher_ifo_slots for all to public
  using (exists (select 1 from public.staff_profiles sp where sp.user_id = auth.uid()
    and (sp.role in ('admin', 'zdud', 'director') or sp.id = teacher_ifo_slots.teacher_id)))
  with check (exists (select 1 from public.staff_profiles sp where sp.user_id = auth.uid()
    and (sp.role in ('admin', 'zdud', 'director') or sp.id = teacher_ifo_slots.teacher_id)));

notify pgrst, 'reload schema';
