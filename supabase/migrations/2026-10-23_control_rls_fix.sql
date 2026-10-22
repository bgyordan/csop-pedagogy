-- Контролна дейност — поправка: ЗДУД/ЗДАСД не можеха да създадат проверка
-- („new row violates row-level security policy for table control_checks“).
-- Причина: при insert ... returning новият ред минава и през правилото за четене, а control_can_see()
-- търси реда в таблицата и още не го вижда. Проверяващият вижда своите проверки направо по inspector_id.
-- Безопасно за повторно пускане.
drop policy if exists "control_checks_read" on public.control_checks;
create policy "control_checks_read" on public.control_checks for select to authenticated
  using (inspector_id = get_my_staff_id() or control_can_see(id));

notify pgrst, 'reload schema';
