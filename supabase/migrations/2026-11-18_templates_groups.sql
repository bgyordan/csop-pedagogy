-- Образци: групите (Декларации · Административни · За дейността · За родители) се пазят в category.
-- Ако старото поле има ограничение за стойностите — махаме го. Безопасно за повторно пускане.
alter table public.document_templates drop constraint if exists document_templates_category_check;
-- групата на съществуващите образци (само ако още няма някоя от новите групи)
update public.document_templates set category = case
  when (title || ' ' || coalesce(description, '')) ilike '%деклар%' then 'Декларации'
  when (title || ' ' || coalesce(description, '')) ~* '(родител|съглас|информирано)' then 'За родители'
  when is_administrative then 'Административни'
  else 'За дейността' end
where category is null or category not in ('Декларации', 'Административни', 'За дейността', 'За родители');
notify pgrst, 'reload schema';
