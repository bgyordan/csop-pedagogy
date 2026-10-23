-- Професионален календар (/calendar): собствени и общи събития на персонала с покани и отговори,
-- повтаряне (дневно / седмично / месечно / годишно) и видимост. Останалите модули (учебен календар,
-- график срокове, контролна дейност, оценяване, портфолио, посещения, заседания, дежурства) се показват
-- в календара само за четене — от техните таблици, без копиране. Безопасно за повторно пускане.

-- Кой може да публикува събития за всички / за група: ръководството и деловодството
create or replace function public.cal_is_publisher() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('director', 'zdud', 'admin', 'secretary')
$$;
grant execute on function public.cal_is_publisher() to authenticated;

create or replace function public.cal_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('director', 'zdud', 'admin')
$$;
grant execute on function public.cal_is_manager() to authenticated;

create table if not exists public.cal_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default get_my_staff_id() references public.staff_profiles(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  location text,
  online_url text,                         -- линк за онлайн среща (Meet / Teams / Zoom)
  category text not null default 'event' check (category in
    ('meeting', 'council', 'deadline', 'event', 'training', 'inspection', 'parents', 'holiday', 'personal', 'other')),
  color text,                              -- по избор; иначе — цветът на категорията
  all_day boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- повтаряне: none | daily | weekly | monthly | yearly; на всеки N; в дни от седмицата (1=Пн … 7=Нд); до дата
  recur_freq text not null default 'none' check (recur_freq in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  recur_interval int not null default 1 check (recur_interval between 1 and 52),
  recur_weekdays int[],
  recur_until date,
  exdates date[] not null default '{}',    -- пропуснати поводи от поредицата
  -- видимост: private = само аз и поканените; managers = ръководството; staff = целият персонал; roles = избрани длъжности
  visibility text not null default 'private' check (visibility in ('private', 'managers', 'staff', 'roles')),
  roles text[] not null default '{}',
  remind_days int,                         -- напомняне на таблото N дни преди
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index if not exists cal_events_range_idx on public.cal_events (starts_at, ends_at);
create index if not exists cal_events_owner_idx on public.cal_events (owner_id);

create table if not exists public.cal_event_attendees (
  event_id uuid not null references public.cal_events(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  response text not null default 'pending' check (response in ('pending', 'yes', 'no', 'maybe')),
  note text,
  responded_at timestamptz,
  primary key (event_id, staff_id)
);
create index if not exists cal_event_attendees_staff_idx on public.cal_event_attendees (staff_id);

-- Помощни функции (security definer — за да не се извикват политиките една друга в кръг)
create or replace function public.cal_event_owner(p_event uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select owner_id from cal_events where id = p_event
$$;
grant execute on function public.cal_event_owner(uuid) to authenticated;

create or replace function public.cal_is_attendee(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cal_event_attendees where event_id = p_event and staff_id = get_my_staff_id())
$$;
grant execute on function public.cal_is_attendee(uuid) to authenticated;

create or replace function public.cal_can_see(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cal_events e where e.id = p_event and (
      e.owner_id = get_my_staff_id()
      or e.visibility = 'staff'
      or (e.visibility = 'managers' and cal_is_manager())
      or (e.visibility = 'roles' and get_my_role()::text = any (e.roles))
      or exists (select 1 from cal_event_attendees a where a.event_id = e.id and a.staff_id = get_my_staff_id())
    ))
$$;
grant execute on function public.cal_can_see(uuid) to authenticated;

alter table public.cal_events enable row level security;
alter table public.cal_event_attendees enable row level security;

-- Четене: колоните се проверяват директно (owner_id, visibility), за да работи insert … returning
drop policy if exists "cal_events_read" on public.cal_events;
create policy "cal_events_read" on public.cal_events for select to authenticated
  using (
    owner_id = get_my_staff_id()
    or visibility = 'staff'
    or (visibility = 'managers' and cal_is_manager())
    or (visibility = 'roles' and get_my_role()::text = any (roles))
    or cal_is_attendee(id)
  );

-- Всеки създава свои събития; за всички / за група — само ръководството и деловодството
drop policy if exists "cal_events_insert" on public.cal_events;
create policy "cal_events_insert" on public.cal_events for insert to authenticated
  with check (owner_id = get_my_staff_id() and (visibility = 'private' or cal_is_publisher()));

-- Редакция: собственикът; общите събития — и ръководството / деловодството
drop policy if exists "cal_events_update" on public.cal_events;
create policy "cal_events_update" on public.cal_events for update to authenticated
  using (owner_id = get_my_staff_id() or (visibility <> 'private' and cal_is_publisher()))
  with check (visibility = 'private' or cal_is_publisher());

drop policy if exists "cal_events_delete" on public.cal_events;
create policy "cal_events_delete" on public.cal_events for delete to authenticated
  using (owner_id = get_my_staff_id() or (visibility <> 'private' and cal_is_publisher()));

-- Поканени: виждат се от всеки, който вижда събитието
drop policy if exists "cal_att_read" on public.cal_event_attendees;
create policy "cal_att_read" on public.cal_event_attendees for select to authenticated
  using (staff_id = get_my_staff_id() or cal_can_see(event_id));

-- Канят и махат поканени: собственикът на събитието (и публикуващите — за общи събития)
drop policy if exists "cal_att_insert" on public.cal_event_attendees;
create policy "cal_att_insert" on public.cal_event_attendees for insert to authenticated
  with check (cal_event_owner(event_id) = get_my_staff_id() or (cal_is_publisher() and cal_can_see(event_id)));

drop policy if exists "cal_att_delete" on public.cal_event_attendees;
create policy "cal_att_delete" on public.cal_event_attendees for delete to authenticated
  using (staff_id = get_my_staff_id() or cal_event_owner(event_id) = get_my_staff_id() or (cal_is_publisher() and cal_can_see(event_id)));

-- Отговор (ще дойда / не / може би): само поканеният за себе си
drop policy if exists "cal_att_update" on public.cal_event_attendees;
create policy "cal_att_update" on public.cal_event_attendees for update to authenticated
  using (staff_id = get_my_staff_id()) with check (staff_id = get_my_staff_id());

grant select, insert, update, delete on public.cal_events to authenticated;
grant select, insert, update, delete on public.cal_event_attendees to authenticated;
