-- Дневник случаи — поправка: класен ръководител (или друг извън Координационния съвет) не можеше
-- да запише нов случай („new row violates row-level security policy for table incident_cases“).
-- Причина: при insert ... returning новият ред минава и през правилото за четене, а incident_can_see()
-- търси реда в таблицата и още не го вижда. Подалият случая го вижда направо по reported_by.
-- Безопасно за повторно пускане.
drop policy if exists "incident_cases_read" on public.incident_cases;
create policy "incident_cases_read" on public.incident_cases for select to authenticated
  using (reported_by = get_my_staff_id() or incident_can_see(id));

notify pgrst, 'reload schema';
