-- Следобеден час „ИФО 6“ (period = 13, 15:40–16:10): ИФО часовете на учителя приемат до 13.
alter table public.teacher_ifo_slots drop constraint if exists teacher_ifo_slots_period_check;
alter table public.teacher_ifo_slots add constraint teacher_ifo_slots_period_check check (period >= 0 and period <= 13);

notify pgrst, 'reload schema';
