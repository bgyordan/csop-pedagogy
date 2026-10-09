-- Заместване по ЧАСОВЕ: в един ден часовете на отсъстващия (напр. всеки ИЧ в ИФО) може да се поемат от различни хора.
-- periods = номерата на часовете (както в разписанието) за този заместник; null = всички часове в дните.
-- Безопасно за повторно пускане.
alter table public.substitution_assignments add column if not exists periods smallint[];
notify pgrst, 'reload schema';
