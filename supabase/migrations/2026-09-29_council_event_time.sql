-- Час на съвета (по избор). Безопасно за повторно пускане; без колоната страницата работи само с дата.
alter table public.council_sets add column if not exists event_time time;
