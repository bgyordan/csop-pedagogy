-- Образци: групите вляво се пазят в template_collections (редактират се от EIS — „Подреди“),
-- всеки образец е в ЕДНА група (collection_ids[1]).
-- Начални групи: Декларации · Административни · За дейността · За родители; образците се разпределят по заглавие.
-- ВНИМАНИЕ: замества досегашното разпределение по „ситуации“ — старите групи остават празни
-- и се трият от „Подреди“ → „Изтрий празните групи“. Пусни веднъж.
insert into public.template_collections (name, icon, sort) values
  ('Декларации', 'sign', 10),
  ('Административни', 'briefcase', 20),
  ('За дейността', 'clipboard', 30),
  ('За родители', 'users', 40)
on conflict (name) do update set sort = excluded.sort, icon = excluded.icon;

update public.document_templates t set collection_ids = array[(
  select c.id from public.template_collections c where c.name = case
    when t.category in ('Декларации', 'Административни', 'За дейността', 'За родители') then t.category
    when (t.title || ' ' || coalesce(t.description, '')) ilike '%деклар%' then 'Декларации'
    when (t.title || ' ' || coalesce(t.description, '')) ~* '(родител|съглас|информирано)' then 'За родители'
    when t.is_administrative then 'Административни'
    else 'За дейността' end
)];
notify pgrst, 'reload schema';
