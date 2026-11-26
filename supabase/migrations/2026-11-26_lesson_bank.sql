-- БАНКА С УРОЦИ: колегите качват готови файлове (план на урок, презентация, работен лист…) с кратка карта —
-- предмети и възрасти с отметки. Качването е анонимно по подразбиране.
-- Авторът се пази в отделна таблица, която НИКОЙ не вижда освен самият автор (за да може да изтрие своето).
-- Кой разглежда или изтегля — не се записва никъде. „Ползвах го“ пази само брояча; кой го е натиснал вижда само той.
-- Безопасно за повторно пускане.

create table if not exists public.lesson_bank_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null default 'lesson' check (kind in ('lesson', 'presentation', 'worksheet', 'game', 'test', 'other')),
  subjects text[] not null default '{}',
  levels text[] not null default '{}',
  checks text[] not null default '{}',     -- за план на урок: goal · result · check · learned  (4 = „Пълен урок“)
  author_label text,                      -- името — само ако авторът е избрал „С моето име“
  file_path text not null,                -- в кофата lesson-bank
  file_name text not null,
  mime_type text,
  size bigint,
  uses_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists lesson_bank_items_created_idx on public.lesson_bank_items (created_at desc);

-- Скрит автор: вижда реда само самият автор
create table if not exists public.lesson_bank_owners (
  item_id uuid primary key references public.lesson_bank_items(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade
);

-- „Ползвах го“: един глас на колега; редовете вижда само самият колега
create table if not exists public.lesson_bank_uses (
  item_id uuid not null references public.lesson_bank_items(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  primary key (item_id, staff_id)
);

alter table public.lesson_bank_items enable row level security;
alter table public.lesson_bank_owners enable row level security;
alter table public.lesson_bank_uses enable row level security;

-- Кой е педагогически персонал (секретар и помощен персонал — не)
create or replace function public.lesson_bank_can_use() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(get_my_role()::text not in ('secretary', 'support'), false)
$$;

-- Файлове: четат всички педагогически роли. Добавянето е само през функцията lesson_bank_add.
-- Поправя/трие авторът; ръководството може само да трие (без да вижда кой е авторът).
drop policy if exists "lesson_bank_items_read" on public.lesson_bank_items;
create policy "lesson_bank_items_read" on public.lesson_bank_items for select to authenticated
  using (lesson_bank_can_use());
drop policy if exists "lesson_bank_items_update" on public.lesson_bank_items;
create policy "lesson_bank_items_update" on public.lesson_bank_items for update to authenticated
  using (exists (select 1 from public.lesson_bank_owners o where o.item_id = lesson_bank_items.id and o.staff_id = get_my_staff_id()))
  with check (exists (select 1 from public.lesson_bank_owners o where o.item_id = lesson_bank_items.id and o.staff_id = get_my_staff_id()));
drop policy if exists "lesson_bank_items_delete" on public.lesson_bank_items;
create policy "lesson_bank_items_delete" on public.lesson_bank_items for delete to authenticated
  using (exists (select 1 from public.lesson_bank_owners o where o.item_id = lesson_bank_items.id and o.staff_id = get_my_staff_id())
         or get_my_role()::text in ('admin', 'zdud', 'director'));

drop policy if exists "lesson_bank_owners_own" on public.lesson_bank_owners;
create policy "lesson_bank_owners_own" on public.lesson_bank_owners for select to authenticated
  using (staff_id = get_my_staff_id());

drop policy if exists "lesson_bank_uses_own" on public.lesson_bank_uses;
create policy "lesson_bank_uses_own" on public.lesson_bank_uses for select to authenticated
  using (staff_id = get_my_staff_id());

-- Добавяне: записът и скритият автор наведнъж
create or replace function public.lesson_bank_add(
  p_title text, p_description text, p_kind text, p_subjects text[], p_levels text[], p_checks text[],
  p_show_name boolean, p_file_path text, p_file_name text, p_mime_type text, p_size bigint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := get_my_staff_id(); v_id uuid; v_name text;
begin
  if v_me is null or not lesson_bank_can_use() then raise exception 'Нямате достъп до банката'; end if;
  if p_show_name then select first_name || ' ' || last_name into v_name from staff_profiles where id = v_me; end if;
  insert into lesson_bank_items (title, description, kind, subjects, levels, checks, author_label, file_path, file_name, mime_type, size)
  values (p_title, nullif(trim(coalesce(p_description, '')), ''), p_kind, coalesce(p_subjects, '{}'), coalesce(p_levels, '{}'),
          coalesce(p_checks, '{}'), v_name, p_file_path, p_file_name, p_mime_type, p_size)
  returning id into v_id;
  insert into lesson_bank_owners (item_id, staff_id) values (v_id, v_me);
  return v_id;
end $$;

-- Авторът сменя „анонимно ↔ с име“ за свой файл
create or replace function public.lesson_bank_set_name(p_item uuid, p_show_name boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := get_my_staff_id();
begin
  if not exists (select 1 from lesson_bank_owners where item_id = p_item and staff_id = v_me) then raise exception 'Не е ваш файл'; end if;
  update lesson_bank_items set author_label = case when p_show_name
    then (select first_name || ' ' || last_name from staff_profiles where id = v_me) else null end
  where id = p_item;
end $$;

-- „Ползвах го“ — включва/изключва гласа ми и връща новия брой
create or replace function public.lesson_bank_toggle_use(p_item uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := get_my_staff_id(); v_n int;
begin
  if v_me is null or not lesson_bank_can_use() then raise exception 'Нямате достъп до банката'; end if;
  if exists (select 1 from lesson_bank_uses where item_id = p_item and staff_id = v_me) then
    delete from lesson_bank_uses where item_id = p_item and staff_id = v_me;
  else
    insert into lesson_bank_uses (item_id, staff_id) values (p_item, v_me);
  end if;
  select count(*) into v_n from lesson_bank_uses where item_id = p_item;
  update lesson_bank_items set uses_count = v_n where id = p_item;
  return v_n;
end $$;

grant execute on function public.lesson_bank_add(text, text, text, text[], text[], text[], boolean, text, text, text, bigint) to authenticated;
grant execute on function public.lesson_bank_set_name(uuid, boolean) to authenticated;
grant execute on function public.lesson_bank_toggle_use(uuid) to authenticated;

-- Файловете: качват се през сървъра (подписан адрес), затова в storage не остава кой е качил
insert into storage.buckets (id, name, public) values ('lesson-bank', 'lesson-bank', false)
on conflict (id) do nothing;
drop policy if exists "lesson_bank_files_read" on storage.objects;
create policy "lesson_bank_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'lesson-bank' and lesson_bank_can_use());
