-- ОНЛАЙН СТАЯ 3: ранно приключване на ОРЕС от стаята и защита на хронологията.
-- Безопасно за повторно пускане. Изисква 2026-10-11_online_room.sql и _2.sql.

-- 1. „Приключи ОРЕС“: линкът спира веднага; „Отвори отново“ връща предишната крайна дата
alter table public.student_ores add column if not exists room_closed_at timestamptz;
alter table public.student_ores add column if not exists room_closed_by uuid references public.staff_profiles(id) on delete set null;
alter table public.student_ores add column if not exists to_date_before_close date;

drop policy if exists "student_ores_close" on public.student_ores;
create policy "student_ores_close" on public.student_ores for update to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));

-- 2. ОРЕС с публикации не може да се изтрие — хронологията е доказателство (приключва се, не се трие)
alter table public.online_room_posts drop constraint if exists online_room_posts_ores_id_fkey;
alter table public.online_room_posts add constraint online_room_posts_ores_id_fkey
  foreign key (ores_id) references public.student_ores(id) on delete restrict;
