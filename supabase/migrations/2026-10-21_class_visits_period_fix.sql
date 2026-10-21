-- Посещения на час — часът може да е и ЦОУД (21–26); старото ограничение беше 0–13 и спираше записа на учителите ЦОУД.
alter table public.visit_bookings drop constraint if exists visit_bookings_period_check;
alter table public.visit_bookings add constraint visit_bookings_period_check check (period between 0 and 26);
notify pgrst, 'reload schema';
