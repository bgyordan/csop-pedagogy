-- МАТЕРИАЛНА БАЗА: сигнали от колегите за проблеми в помещенията (брава, чин, стол, контакт…).
-- Колегата подава сигнал → деловодството / управата го движат: Нов → Приет → Поправено (или „Не може“)
-- с отговор към колегата; колегата вижда отговора и може да отвори сигнала наново.
-- Нови таблици — нищо съществуващо не се променя. Безопасно за повторно пускане.

create table if not exists public.facility_issues (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.staff_profiles(id) on delete set null,
  room text not null,                         -- помещение — свободен текст („Кабинет 12“, „Физкултурен салон“)
  category text not null default 'other',     -- door / furniture / electric / water / heating / tech / other
  description text not null,
  urgent boolean not null default false,
  photo_path text,                            -- снимка в хранилище 'facilities'
  status text not null default 'new' check (status in ('new', 'accepted', 'done', 'cannot')),
  reply text,                                 -- последният отговор към колегата
  handled_by uuid references public.staff_profiles(id) on delete set null,
  resolved_at timestamptz,
  reporter_seen_at timestamptz,               -- кога колегата е видял последната промяна
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists facility_issues_status_idx on public.facility_issues (status, urgent desc, created_at desc);
create index if not exists facility_issues_reporter_idx on public.facility_issues (reporter_id);

-- История: смени на статуса, отговори, „не е оправено“
create table if not exists public.facility_issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.facility_issues(id) on delete cascade,
  author_id uuid references public.staff_profiles(id) on delete set null,
  kind text not null check (kind in ('status', 'comment', 'reopen')),
  status text,
  body text,
  created_at timestamptz not null default now()
);
create index if not exists facility_issue_events_issue_idx on public.facility_issue_events (issue_id, created_at);

-- Кой движи сигналите: админ, ЗДУД, директор, деловодство
create or replace function public.facility_is_handler() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('admin', 'zdud', 'director', 'secretary')
$$;
grant execute on function public.facility_is_handler() to authenticated;

alter table public.facility_issues enable row level security;
alter table public.facility_issue_events enable row level security;

-- Всички служители виждат сигналите (за да не се подава два пъти едно и също)
drop policy if exists facility_issues_read on public.facility_issues;
create policy facility_issues_read on public.facility_issues for select to authenticated using (true);
drop policy if exists facility_issues_insert on public.facility_issues;
create policy facility_issues_insert on public.facility_issues for insert to authenticated
  with check (reporter_id = get_my_staff_id());
-- Колегата поправя своя сигнал, докато е „Нов“; управата — винаги
drop policy if exists facility_issues_update on public.facility_issues;
create policy facility_issues_update on public.facility_issues for update to authenticated
  using ((reporter_id = get_my_staff_id() and status = 'new') or facility_is_handler())
  with check ((reporter_id = get_my_staff_id() and status = 'new') or facility_is_handler());
drop policy if exists facility_issues_delete on public.facility_issues;
create policy facility_issues_delete on public.facility_issues for delete to authenticated
  using ((reporter_id = get_my_staff_id() and status = 'new') or get_my_role()::text in ('admin', 'zdud'));

drop policy if exists facility_events_read on public.facility_issue_events;
create policy facility_events_read on public.facility_issue_events for select to authenticated using (true);

-- Смяна на статус + отговор (само управата / деловодството)
create or replace function public.facility_set_status(p_issue uuid, p_status text, p_reply text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not facility_is_handler() then raise exception 'Нямате права'; end if;
  if p_status not in ('new', 'accepted', 'done', 'cannot') then raise exception 'Невалиден статус'; end if;
  update facility_issues set
    status = p_status,
    reply = coalesce(nullif(trim(p_reply), ''), reply),
    handled_by = get_my_staff_id(),
    resolved_at = case when p_status in ('done', 'cannot') then now() else null end,
    updated_at = now()
  where id = p_issue;
  insert into facility_issue_events (issue_id, author_id, kind, status, body)
  values (p_issue, get_my_staff_id(), 'status', p_status, nullif(trim(p_reply), ''));
end $$;
grant execute on function public.facility_set_status(uuid, text, text) to authenticated;

-- Колегата: „Не е оправено“ → сигналът се отваря наново с коментар
create or replace function public.facility_reopen(p_issue uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from facility_issues where id = p_issue and (reporter_id = get_my_staff_id() or facility_is_handler())) then
    raise exception 'Нямате права';
  end if;
  update facility_issues set status = 'new', resolved_at = null, updated_at = now() where id = p_issue;
  insert into facility_issue_events (issue_id, author_id, kind, status, body)
  values (p_issue, get_my_staff_id(), 'reopen', 'new', nullif(trim(p_body), ''));
end $$;
grant execute on function public.facility_reopen(uuid, text) to authenticated;

-- Колегата е видял промените по своите сигнали (за картата на таблото)
create or replace function public.facility_mark_seen()
returns void language sql security definer set search_path = public as $$
  update facility_issues set reporter_seen_at = now()
  where reporter_id = get_my_staff_id() and (reporter_seen_at is null or reporter_seen_at < updated_at)
$$;
grant execute on function public.facility_mark_seen() to authenticated;

-- Хранилище за снимките (частно — само за влезли служители)
insert into storage.buckets (id, name, public) values ('facilities', 'facilities', false)
on conflict (id) do nothing;
drop policy if exists "facilities_files_read" on storage.objects;
create policy "facilities_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'facilities');
drop policy if exists "facilities_files_insert" on storage.objects;
create policy "facilities_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'facilities');
drop policy if exists "facilities_files_delete" on storage.objects;
create policy "facilities_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'facilities' and (owner = auth.uid() or get_my_role()::text in ('admin', 'zdud', 'director', 'secretary')));
