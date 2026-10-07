-- Седмично разписание по учебния план: предметът от НЕИСПУО (както е във вноса) → предмет в EIS (subjects).
-- Пази се в curriculum_name_map с вид 'subject' — оцелява при нов внос (редовете на плана се записват наново).
alter table public.curriculum_name_map drop constraint if exists curriculum_name_map_kind_check;
alter table public.curriculum_name_map add constraint curriculum_name_map_kind_check
  check (kind in ('staff', 'class', 'coud', 'subject'));

notify pgrst, 'reload schema';
