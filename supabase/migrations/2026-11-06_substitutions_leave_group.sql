-- Отпуск в няколко периода по едно заявление (напр. 02–04.11 и 07–10.11): всеки период е свой ред в
-- „Отсъствия и замествания“, а leave_group ги свързва — заместникът се задава веднъж и заповедта за
-- заместване е една, с всички периоди. Безопасно за повторно пускане.
alter table public.substitutions add column if not exists leave_group uuid;
create index if not exists substitutions_leave_group_idx on public.substitutions(leave_group) where leave_group is not null;
notify pgrst, 'reload schema';
