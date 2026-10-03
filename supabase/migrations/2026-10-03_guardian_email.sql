-- Имейл на родителя/настойника — за връзка и за поканите в Google Classroom. Безопасно за повторно пускане.
alter table public.student_guardians add column if not exists email text;
