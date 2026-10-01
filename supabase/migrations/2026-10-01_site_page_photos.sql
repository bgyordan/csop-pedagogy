-- Снимки по страниците на публичния сайт: { "za-nas": ["url", ...], ... }
-- Попълва се от ЕИС → Сайт → „Снимки за сайта“ (избор на страница под всяка снимка).
insert into public.site_settings (key, value)
select 'page_photos', '{}'::jsonb
where not exists (select 1 from public.site_settings where key = 'page_photos');
