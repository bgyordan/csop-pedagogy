-- Отсъствие на директора: кой изпълнява функциите на директор (по заповедта за ролята).
-- Само за листчето „Днес отсъстват“ — „замества я: …“. Кой води часовете ѝ остава в substitute_staff_id / разпределението по дни.
-- Безопасно за повторно пускане.
alter table public.substitutions
  add column if not exists acting_staff_id uuid references public.staff_profiles(id) on delete set null;

notify pgrst, 'reload schema';
