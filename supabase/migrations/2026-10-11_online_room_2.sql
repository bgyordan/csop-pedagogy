-- ОНЛАЙН СТАЯ 2: хронология (нищо не се трие — само се скрива от родителя), „видяно от родителя“,
-- въпроси от родителя и отговори от учителя. Безопасно за повторно пускане. Изисква 2026-10-11_online_room.sql.

-- 1. Скриване вместо триене
alter table public.online_room_posts add column if not exists hidden_at timestamptz;
alter table public.online_room_posts add column if not exists hidden_by uuid references public.staff_profiles(id) on delete set null;

drop policy if exists "online_room_delete" on public.online_room_posts;   -- публикациите вече не се трият (доказателство за ОРЕС)
drop policy if exists "online_room_hide" on public.online_room_posts;
create policy "online_room_hide" on public.online_room_posts for update to authenticated
  using (author_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (author_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'));
-- файловете също остават
drop policy if exists "online_room_files_delete" on storage.objects;

-- 2. Посещения на родителя (записва ги сървърът при отваряне на линка)
create table if not exists public.online_room_visits (
  id bigint generated always as identity primary key,
  ores_id uuid not null references public.student_ores(id) on delete cascade,
  visited_at timestamptz not null default now()
);
create index if not exists online_room_visits_idx on public.online_room_visits (ores_id, visited_at);
alter table public.online_room_visits enable row level security;
drop policy if exists "online_room_visits_read" on public.online_room_visits;
create policy "online_room_visits_read" on public.online_room_visits for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));

-- 3. Въпроси от родителя и отговори от учителя — нишка под всяка публикация
create table if not exists public.online_room_messages (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.online_room_posts(id) on delete cascade,
  ores_id uuid not null references public.student_ores(id) on delete cascade,
  from_parent boolean not null default false,
  author_id uuid references public.staff_profiles(id) on delete set null,   -- учителят (при отговор)
  kind text not null default 'text' check (kind in ('ok', 'unclear', 'resend', 'text')),
  body text check (body is null or length(body) <= 500),
  read_at timestamptz,                                                      -- учител е прочел въпроса на родителя
  created_at timestamptz not null default now()
);
create index if not exists online_room_messages_ores_idx on public.online_room_messages (ores_id, created_at);
alter table public.online_room_messages enable row level security;
drop policy if exists "online_room_msg_read" on public.online_room_messages;
create policy "online_room_msg_read" on public.online_room_messages for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));
-- учителите пишат само отговори от свое име (родителят пише през сървъра)
drop policy if exists "online_room_msg_reply" on public.online_room_messages;
create policy "online_room_msg_reply" on public.online_room_messages for insert to authenticated
  with check (from_parent = false and author_id = get_my_staff_id() and get_my_role()::text not in ('secretary', 'support'));
-- отбелязване „прочетено“
drop policy if exists "online_room_msg_mark" on public.online_room_messages;
create policy "online_room_msg_mark" on public.online_room_messages for update to authenticated
  using (get_my_role()::text not in ('secretary', 'support')) with check (get_my_role()::text not in ('secretary', 'support'));
