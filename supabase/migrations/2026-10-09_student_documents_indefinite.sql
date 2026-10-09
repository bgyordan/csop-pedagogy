-- Документи на ученика (ТЕЛК / РЦПППО / алергии): отметка „безсрочен“ — различно от „не е въведен срок“.
-- Безопасно за повторно пускане.
alter table public.student_documents add column if not exists indefinite boolean not null default false;
notify pgrst, 'reload schema';
