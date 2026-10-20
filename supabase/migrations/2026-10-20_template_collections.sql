-- Образци: колекции „по ситуация“ (един образец може да е в няколко), брояч на изтеглянията и любими.
-- Старите категории остават в базата, но вече не се показват. Безопасно за повторно пускане.

create table if not exists public.template_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default 'folder',
  sort int not null default 100,
  created_at timestamptz not null default now()
);
alter table public.template_collections enable row level security;
drop policy if exists "template_collections_read" on public.template_collections;
create policy "template_collections_read" on public.template_collections for select to authenticated using (true);
drop policy if exists "template_collections_write" on public.template_collections;
create policy "template_collections_write" on public.template_collections for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary')
         or exists (select 1 from staff_profiles s where s.id = get_my_staff_id() and s.is_coordinator))
  with check (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary')
         or exists (select 1 from staff_profiles s where s.id = get_my_staff_id() and s.is_coordinator));

alter table public.document_templates add column if not exists collection_ids uuid[] not null default '{}';
alter table public.document_templates add column if not exists download_count int not null default 0;

-- брояч: всеки може да го увеличи, без да има право да редактира образеца
create or replace function public.template_downloaded(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update document_templates set download_count = download_count + 1 where id = p_id
$$;
grant execute on function public.template_downloaded(uuid) to authenticated;

-- любими — всеки за себе си
create table if not exists public.template_favorites (
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  template_id uuid not null references public.document_templates(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_id, template_id)
);
alter table public.template_favorites enable row level security;
drop policy if exists "template_favorites_own" on public.template_favorites;
create policy "template_favorites_own" on public.template_favorites for all to authenticated
  using (staff_id = get_my_staff_id()) with check (staff_id = get_my_staff_id());

-- начални колекции (после се редактират от EIS)
insert into public.template_collections (name, icon, sort) values
  ('Отпуск и отсъствия', 'plane', 10),
  ('Заместване и лекторски', 'repeat', 20),
  ('Прием и нов ученик', 'user-plus', 30),
  ('ЕПЛР, ИУП и подкрепа', 'heart', 40),
  ('Родители и съгласия', 'users', 50),
  ('Заседания и протоколи', 'clipboard', 60),
  ('Командировки и пътуване', 'bus', 70),
  ('Безопасност и инструктажи', 'shield', 80),
  ('Персонал и труд', 'briefcase', 90),
  ('Финанси', 'wallet', 100)
on conflict (name) do nothing;

-- разпределяне на съществуващите образци по ключови думи в заглавието/пояснението
-- (само ако образецът още няма колекции — второ пускане не пипа ръчно подредените)
update public.document_templates t
set collection_ids = coalesce((
  select array_agg(c.id order by c.sort)
  from (values
    ('Отпуск и отсъствия', '(отпуск|отсъств|болничн|неплатен)'),
    ('Заместване и лекторски', '(заместв|лекторск|норматив|без свободен час)'),
    ('Прием и нов ученик', '(прием|записван|постъпв|насочван|преместван)'),
    ('ЕПЛР, ИУП и подкрепа', '(еплр|иуп|подкрепа|оценка на|индивидуален|учебен план|функционал)'),
    ('Родители и съгласия', '(родител|съгласие|информиран|лични данни|настойник)'),
    ('Заседания и протоколи', '(протокол|заседани|педагогически съвет|съвет)'),
    ('Командировки и пътуване', '(командиров|пътн|екскурз|транспорт|пътуван)'),
    ('Безопасност и инструктажи', '(инструктаж|безопасн|пожар|евакуац|бедстви|здравосл)'),
    ('Персонал и труд', '(трудов|длъжностн|назначав|служител|работно време|атестац|квалификац)'),
    ('Финанси', '(сметк|плащан|фактур|бюджет|заплат|разход|аванс|финанс)')
  ) as k(name, pat)
  join public.template_collections c on c.name = k.name
  where lower(t.title || ' ' || coalesce(t.description, '')) ~ k.pat
), '{}')
where cardinality(t.collection_ids) = 0;

notify pgrst, 'reload schema';
