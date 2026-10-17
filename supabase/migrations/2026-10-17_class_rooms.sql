-- СТАЯ НА ПАРАЛЕЛКАТА: при грипна ваканция (или друг повод) управата отваря онлайн стая за една или много паралелки
-- за период от–до. Стаята е ЕДНА за паралелката — учителите пускат материал веднъж, — но всяко дете има ЛИЧЕН линк
-- за родителя. Така знаем кой родител е отворил стаята и кой пита, а въпросите и отговорите вижда само този родител.
-- Публикация може да е „за цялата паралелка“ или „само за <дете>“. Нищо не се трие (хронологията е доказателство),
-- публикации само се скриват. Отделни таблици — личната ОРЕС стая (online_room_*) не се пипа.
-- Безопасно за повторно пускане.

-- 1. Стаята: паралелка + период
create table if not exists public.class_rooms (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  from_date date not null,
  to_date date not null,
  reason text,                                   -- „Грипна ваканция“ и др.
  closed_at timestamptz,                         -- „Затвори стаята“ преди крайната дата
  closed_by uuid references public.staff_profiles(id) on delete set null,
  to_date_before_close date,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);
create index if not exists class_rooms_class_idx on public.class_rooms (class_id, from_date desc);

-- 2. Децата в стаята — личният линк на родителя (по един за дете и стая)
create table if not exists public.class_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.class_rooms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  revoked_at timestamptz,                        -- „Спри линка“ — само за това дете
  first_visit_at timestamptz,                    -- кратко резюме на отварянията (за отчетите на много стаи наведнъж);
  last_visit_at timestamptz,                     -- пълният списък е в class_room_visits
  visit_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, student_id)
);
create unique index if not exists class_room_members_token_idx on public.class_room_members (token);

-- 3. Публикациите: за цялата паралелка (student_id null) или само за едно дете
create table if not exists public.class_room_posts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.class_rooms(id) on delete restrict,   -- стая с публикации не се трие
  student_id uuid references public.students(id) on delete set null,
  author_id uuid references public.staff_profiles(id) on delete set null,
  subject text,                                  -- предмет/дейност — като темите в Classroom
  body text,
  link_url text,
  file_path text,                                -- в кофата online-room, папка class/<room_id>/
  file_name text,
  material_id uuid references public.materials(id) on delete set null,
  hidden_at timestamptz,
  hidden_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists class_room_posts_room_idx on public.class_room_posts (room_id, created_at desc);

-- 4. Отваряния на линка (записва ги сървърът, най-много веднъж на 10 минути за дете)
create table if not exists public.class_room_visits (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.class_rooms(id) on delete cascade,
  member_id uuid not null references public.class_room_members(id) on delete cascade,
  visited_at timestamptz not null default now()
);
create index if not exists class_room_visits_idx on public.class_room_visits (room_id, member_id, visited_at);

-- 5. Въпросите на родителя и отговорите — нишка под публикацията, ОТДЕЛНА за всяко дете
create table if not exists public.class_room_messages (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.class_room_posts(id) on delete cascade,
  room_id uuid not null references public.class_rooms(id) on delete cascade,
  member_id uuid not null references public.class_room_members(id) on delete cascade,   -- чий родител
  from_parent boolean not null default false,
  author_id uuid references public.staff_profiles(id) on delete set null,
  kind text not null default 'text' check (kind in ('ok', 'unclear', 'resend', 'text')),
  body text check (body is null or length(body) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists class_room_messages_room_idx on public.class_room_messages (room_id, created_at);

-- Кой управлява стаята: управата или класният на паралелката (линкове, нови деца)
create or replace function public.class_room_can_manage(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('admin', 'zdud', 'director')
    or exists (
      select 1 from class_rooms r
      join class_teacher_assignments a on a.class_id = r.class_id
      where r.id = p_room and a.staff_id = get_my_staff_id()
        and (r.academic_year_id is null or a.academic_year_id = r.academic_year_id)
    )
$$;

alter table public.class_rooms enable row level security;
alter table public.class_room_members enable row level security;
alter table public.class_room_posts enable row level security;
alter table public.class_room_visits enable row level security;
alter table public.class_room_messages enable row level security;

-- Стаите: виждат педагогическите роли; отварят/затварят управата; празна стая (отворена по грешка) може да се изтрие
drop policy if exists "class_rooms_read" on public.class_rooms;
create policy "class_rooms_read" on public.class_rooms for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "class_rooms_insert" on public.class_rooms;
create policy "class_rooms_insert" on public.class_rooms for insert to authenticated
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));
drop policy if exists "class_rooms_update" on public.class_rooms;
create policy "class_rooms_update" on public.class_rooms for update to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director')) with check (get_my_role()::text in ('admin', 'zdud', 'director'));
drop policy if exists "class_rooms_delete" on public.class_rooms;
create policy "class_rooms_delete" on public.class_rooms for delete to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'));

-- Децата/линковете: виждат педагогическите роли; добавят и сменят линк управата и класният
drop policy if exists "class_room_members_read" on public.class_room_members;
create policy "class_room_members_read" on public.class_room_members for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "class_room_members_insert" on public.class_room_members;
create policy "class_room_members_insert" on public.class_room_members for insert to authenticated
  with check (class_room_can_manage(room_id));
drop policy if exists "class_room_members_update" on public.class_room_members;
create policy "class_room_members_update" on public.class_room_members for update to authenticated
  using (class_room_can_manage(room_id)) with check (class_room_can_manage(room_id));

-- Публикациите: пише всеки педагогически специалист от свое име; скрива авторът или управата; не се трият
drop policy if exists "class_room_posts_read" on public.class_room_posts;
create policy "class_room_posts_read" on public.class_room_posts for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "class_room_posts_insert" on public.class_room_posts;
create policy "class_room_posts_insert" on public.class_room_posts for insert to authenticated
  with check (author_id = get_my_staff_id() and get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "class_room_posts_hide" on public.class_room_posts;
create policy "class_room_posts_hide" on public.class_room_posts for update to authenticated
  using (author_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (author_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'));

drop policy if exists "class_room_visits_read" on public.class_room_visits;
create policy "class_room_visits_read" on public.class_room_visits for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));

-- Въпроси/отговори: учителите пишат само отговори от свое име (родителят пише през сървъра)
drop policy if exists "class_room_msg_read" on public.class_room_messages;
create policy "class_room_msg_read" on public.class_room_messages for select to authenticated
  using (get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "class_room_msg_reply" on public.class_room_messages;
create policy "class_room_msg_reply" on public.class_room_messages for insert to authenticated
  with check (from_parent = false and author_id = get_my_staff_id() and get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "class_room_msg_mark" on public.class_room_messages;
create policy "class_room_msg_mark" on public.class_room_messages for update to authenticated
  using (get_my_role()::text not in ('secretary', 'support')) with check (get_my_role()::text not in ('secretary', 'support'));

-- Файловете са в съществуващата частна кофа online-room (папка class/<room_id>/) — правилата ѝ вече важат.
