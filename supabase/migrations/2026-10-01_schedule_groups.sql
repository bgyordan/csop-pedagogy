-- Делене на паралелка на групи: в един и същи час на паралелката може да има няколко учители,
-- ако часът е отбелязан като група (is_group). Обикновените часове остават по един на клетка.
alter table public.schedule_slots add column if not exists is_group boolean not null default false;

drop index if exists public.schedule_slots_one_per_cell;
create unique index if not exists schedule_slots_one_per_cell
  on public.schedule_slots (schedule_id, day, period) where not is_group;

notify pgrst, 'reload schema';
