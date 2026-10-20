-- Съобщения до колегите — пишат ги и деловодството (секретар), и директорът, освен админ и ЗДУД.
-- Пример: „Срокът за членския внос изтича на 30.10“ — изскача веднъж на всеки като листче.
-- Безопасно за повторно пускане.
drop policy if exists "announcements_write" on public.announcements;
create policy "announcements_write" on public.announcements for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary'));

-- авторът вижда и своите изключени (неактивни) съобщения в списъка
drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements for select to authenticated
  using (is_active = true or get_my_role()::text in ('admin', 'zdud', 'director', 'secretary'));

notify pgrst, 'reload schema';
