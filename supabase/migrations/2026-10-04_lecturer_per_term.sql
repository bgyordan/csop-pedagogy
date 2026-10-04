-- Лекторски над норматива — отделно за I и II срок (часове на седмица). per_week = I срок, per_week_t2 = II срок.
alter table public.lecturer_plans add column if not exists per_week_t2 numeric(4,2) check (per_week_t2 is null or per_week_t2 between 0 and 30);
