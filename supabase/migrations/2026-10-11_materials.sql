-- МАТЕРИАЛИ: обща библиотека на ЦСОП — готови материали за децата (работни листове, табла, игри, правени с Boardmaker…).
-- Колегите търсят, печатат и качват. Лицензите не ги виждат: всеки материал е към „източник“ (собствен, Boardmaker…),
-- а ръководството поддържа източниците — какво позволяват и до кога. Безопасно за повторно пускане.

-- Източници (само ръководството ги управлява; колегите само избират от списъка при качване)
create table if not exists public.material_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  allow_parents boolean not null default false,   -- може да се дава на родител (онлайн стая)
  valid_until date,                               -- до кога важи лицензът/разрешението (празно = безсрочно)
  note text,                                      -- за ръководството: договор, номер, контакт…
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Материалите
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  kind text not null default 'worksheet' check (kind in ('worksheet', 'board', 'game', 'cards', 'story', 'other')),
  areas text[] not null default '{}',              -- области от „Развитие“ (fine_motor, self_care…)
  source_id uuid references public.material_sources(id) on delete set null,
  file_path text not null,                         -- в кофата materials
  file_name text not null,
  mime_type text,
  size bigint,
  uploaded_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists materials_created_idx on public.materials (created_at desc);

alter table public.material_sources enable row level security;
alter table public.materials enable row level security;

-- Източници: виждат ги всички педагогически роли (за да се изчисли какво е позволено), пише ръководството
drop policy if exists "material_sources_read" on public.material_sources;
create policy "material_sources_read" on public.material_sources for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "material_sources_write" on public.material_sources;
create policy "material_sources_write" on public.material_sources for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));

-- Материали: четат и качват педагогическите роли; редактира/трие авторът или ръководството
drop policy if exists "materials_read" on public.materials;
create policy "materials_read" on public.materials for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "materials_insert" on public.materials;
create policy "materials_insert" on public.materials for insert to authenticated
  with check (uploaded_by = get_my_staff_id() and get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "materials_change" on public.materials;
create policy "materials_change" on public.materials for update to authenticated
  using (uploaded_by = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (uploaded_by = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'));
drop policy if exists "materials_delete" on public.materials;
create policy "materials_delete" on public.materials for delete to authenticated
  using (uploaded_by = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'));

-- Файловете
insert into storage.buckets (id, name, public) values ('materials', 'materials', false)
on conflict (id) do nothing;
drop policy if exists "materials_files_read" on storage.objects;
create policy "materials_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "materials_files_insert" on storage.objects;
create policy "materials_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "materials_files_delete" on storage.objects;
create policy "materials_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and (owner = auth.uid() or get_my_role()::text in ('admin', 'zdud', 'director')));

-- Начални източници (ръководството ги допълва/поправя от „Материали → Източници“)
insert into public.material_sources (name, allow_parents, sort) values
  ('Собствен материал', true, 1),
  ('Boardmaker', false, 2)
on conflict (name) do nothing;
