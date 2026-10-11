-- ОНЛАЙН СТАЯ: когато дете е на ОРЕС (обучение от разстояние), учителите му пускат материали и указания,
-- а родителят ги вижда по личен линк без регистрация. Стаята е към конкретния ОРЕС запис:
-- нов ОРЕС период = нова стая и нов линк; щом периодът свърши, линкът спира да работи.
-- Безопасно за повторно пускане.

-- личният линк на родителя (по един за всеки ОРЕС период)
alter table public.student_ores add column if not exists room_token uuid not null default gen_random_uuid();
create unique index if not exists student_ores_room_token_idx on public.student_ores (room_token);

create table if not exists public.online_room_posts (
  id uuid primary key default gen_random_uuid(),
  ores_id uuid not null references public.student_ores(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  author_id uuid references public.staff_profiles(id) on delete set null,
  body text,                         -- указания за родителя
  link_url text,                     -- клип, Drive файл, видеовръзка…
  file_path text,                    -- файл в кофата online-room
  file_name text,
  created_at timestamptz not null default now()
);
create index if not exists online_room_posts_ores_idx on public.online_room_posts (ores_id, created_at desc);

alter table public.online_room_posts enable row level security;

-- Виждат и пишат педагогическите роли (без деловодител и помощен персонал); трие авторът или управата.
drop policy if exists "online_room_read" on public.online_room_posts;
create policy "online_room_read" on public.online_room_posts for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "online_room_insert" on public.online_room_posts;
create policy "online_room_insert" on public.online_room_posts for insert to authenticated
  with check (author_id = get_my_staff_id() and get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "online_room_delete" on public.online_room_posts;
create policy "online_room_delete" on public.online_room_posts for delete to authenticated
  using (author_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'));

-- Файловете: частна кофа; родителят ги получава с временен линк, генериран от сървъра
insert into storage.buckets (id, name, public) values ('online-room', 'online-room', false)
on conflict (id) do nothing;
drop policy if exists "online_room_files_read" on storage.objects;
create policy "online_room_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'online-room' and get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "online_room_files_insert" on storage.objects;
create policy "online_room_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'online-room' and get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "online_room_files_delete" on storage.objects;
create policy "online_room_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'online-room' and (owner = auth.uid() or get_my_role()::text in ('admin', 'zdud', 'director')));
