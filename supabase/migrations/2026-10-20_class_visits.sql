-- Посещения на час (контролна дейност) — управата задава период, изключени дни и лимит на ден;
-- всеки учител (класни ръководители и учители) сам си избира ден, час, предмет и тема — по едно посещение.
-- Виждат: учителят — своето; директор, ЗДУД, админ — всички. Безопасно за повторно пускане.

create table if not exists public.visit_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Посещение на час',
  focus_subject text,                                  -- напр. „Математика“ — основната тема на проверката
  note text,                                           -- пояснение към учителите
  date_from date not null,
  date_to date not null,
  excluded_dates date[] not null default '{}',         -- дни без посещения (отпуск и др.)
  per_day int not null default 2 check (per_day between 1 and 10),
  use_schedule boolean not null default true,          -- предлагай часовете от седмичното разписание
  roles text[] not null default '{class_teacher,teacher}',
  is_open boolean not null default true,               -- учителите могат да избират/сменят
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table if not exists public.visit_bookings (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.visit_campaigns(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  date date not null,
  period int not null check (period between 0 and 13),
  class_name text,
  subject text,
  topic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, staff_id),                      -- по едно посещение на учител
  unique (campaign_id, date, period)                   -- директорът не може на два часа едновременно
);
create index if not exists visit_bookings_campaign_idx on public.visit_bookings (campaign_id, date);

create or replace function public.visit_is_mgmt() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('admin', 'zdud', 'director')
$$;

-- проверка при запис: в периода, не в изключен ден, делничен ден, до лимита за деня
create or replace function public.visit_booking_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record; n int;
begin
  select * into c from visit_campaigns where id = new.campaign_id;
  if c is null then raise exception 'Няма такава проверка'; end if;
  if new.date < c.date_from or new.date > c.date_to then raise exception 'Денят е извън периода'; end if;
  if new.date = any(c.excluded_dates) then raise exception 'В този ден няма посещения'; end if;
  if extract(isodow from new.date) > 5 then raise exception 'Денят не е работен'; end if;
  select count(*) into n from visit_bookings b where b.campaign_id = new.campaign_id and b.date = new.date and b.id <> new.id;
  if n >= c.per_day then raise exception 'Денят вече е зает — изберете друг'; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists visit_booking_check on public.visit_bookings;
create trigger visit_booking_check before insert or update on public.visit_bookings
  for each row execute function public.visit_booking_check();

-- заетост по дни/часове — без имена (за плочките на учителите)
create or replace function public.visit_slots(p_campaign uuid)
returns table (date date, period int, mine boolean)
language sql stable security definer set search_path = public as $$
  select b.date, b.period, b.staff_id = get_my_staff_id() from visit_bookings b where b.campaign_id = p_campaign
$$;
grant execute on function public.visit_slots(uuid) to authenticated;

alter table public.visit_campaigns enable row level security;
alter table public.visit_bookings enable row level security;

drop policy if exists "visit_campaigns_read" on public.visit_campaigns;
create policy "visit_campaigns_read" on public.visit_campaigns for select to authenticated using (true);
drop policy if exists "visit_campaigns_write" on public.visit_campaigns;
create policy "visit_campaigns_write" on public.visit_campaigns for all to authenticated
  using (visit_is_mgmt()) with check (visit_is_mgmt());

drop policy if exists "visit_bookings_read" on public.visit_bookings;
create policy "visit_bookings_read" on public.visit_bookings for select to authenticated
  using (visit_is_mgmt() or staff_id = get_my_staff_id());
-- учителят: своето посещение, докато проверката е отворена и ролята му участва; управата — всичко
drop policy if exists "visit_bookings_write" on public.visit_bookings;
create policy "visit_bookings_write" on public.visit_bookings for all to authenticated
  using (visit_is_mgmt() or (staff_id = get_my_staff_id() and exists (
    select 1 from visit_campaigns c where c.id = campaign_id and c.is_open and get_my_role()::text = any(c.roles))))
  with check (visit_is_mgmt() or (staff_id = get_my_staff_id() and exists (
    select 1 from visit_campaigns c where c.id = campaign_id and c.is_open and get_my_role()::text = any(c.roles))));

notify pgrst, 'reload schema';
