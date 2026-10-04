-- Учебни планове: норма на предмета — 21 или 30 ч./седм. (терапии, ДПЛР = 30 → 0,7 час към норматив 21).
alter table public.curriculum_lines add column if not exists subject_norm smallint not null default 21;
