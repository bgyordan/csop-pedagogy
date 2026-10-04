-- Учебни планове: индивидуални часове (ИЧ) — часовете на ИФО децата, формално в паралелка в НЕИСПУО.
alter table public.curriculum_lines add column if not exists individual boolean not null default false;
