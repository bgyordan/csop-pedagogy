-- „На линия сега“: кога служителят е бил активен за последно в JORDAN (обновява се най-много веднъж на 5 мин.)
alter table public.staff_profiles add column if not exists last_seen_at timestamptz;
