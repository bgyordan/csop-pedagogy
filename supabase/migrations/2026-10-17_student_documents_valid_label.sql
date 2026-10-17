-- Заповед РЦПППО: валидна до края на клас / етап („до края на IV клас“, „до края на начален етап“).
-- Пази се като текст до датата; датата се изчислява (30.06 на съответната година), за да работят напомнянията.
-- Безопасно за повторно пускане.
alter table public.student_documents add column if not exists valid_label text;
notify pgrst, 'reload schema';
