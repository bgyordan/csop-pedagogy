-- Лекторски: часовете, сложени или преместени на ръка в „График“, се пазят при „Наново“.
alter table public.lecturer_slots add column if not exists is_manual boolean not null default false;
