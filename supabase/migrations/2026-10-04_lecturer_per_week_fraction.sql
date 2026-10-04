-- Лекторски на седмица могат да са дробни (напр. 2,5): цялата част — цяла година, дробта — още един час за част от годината.
alter table public.lecturer_plans alter column per_week type numeric(4,2);
