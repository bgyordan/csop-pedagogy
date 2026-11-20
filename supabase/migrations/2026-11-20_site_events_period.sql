-- Събития на сайта: период (до дата) и час на край. event_date/event_time остават начало.
alter table public.site_events
  add column if not exists event_end_date date,
  add column if not exists event_end_time text;
