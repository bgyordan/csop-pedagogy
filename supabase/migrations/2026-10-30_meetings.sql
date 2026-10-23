-- Заседания на Педагогическия съвет (ПС) и на Общото събрание (ОС): дневен ред, присъствие и кворум,
-- разисквания, решения с гласуване, проследяване на изпълнението, Книга с протоколи.
--
-- Основания:
--  • ЗПУО, чл. 262–263 — съставът и функциите на ПС; председател е директорът; лица със съвещателен глас.
--  • Наредба № 8/2016, Приложение № 2 — „Книга за решенията на педагогическия съвет и протоколи от заседанията“:
--    пореден № на заседанието, дневен ред, отсъстващи членове и причините, разисквания, взети решения;
--    в началото на всяка учебна година — поименен списък на членовете; съхранение 20 г.
--  • Наредба № 8/2016, чл. 41 — номерацията на протоколите започва от № 1 всяка учебна година;
--    протоколът на ПС се изготвя до 10 дни от заседанието, подписва се от изготвилия го и се заверява
--    с подписа на директора и печата.
--  • Кодекс на труда, чл. 6–7 — общото събрание на работниците и служителите (кворум > 1/2; решения
--    с мнозинство > 1/2 от присъстващите; изборът на представители по чл. 7, ал. 2 — > 1/2 от всички).
--
-- Права: ръководството (директор, ЗДУД, администратор) създава и води заседанията; председателят и
-- протоколчикът на конкретното заседание също редактират черновата. Насроченото заседание и дневният
-- ред се виждат от всички; черновата на протокола — само от водещите; окончателният протокол — от всички.
-- Окончателният протокол е заключен; поправка — само с мотив от ръководството (номерът се запазва).
-- Безопасно за повторно пускане.

create or replace function public.mtg_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('director', 'zdud', 'admin')
$$;
grant execute on function public.mtg_is_manager() to authenticated;

create table if not exists public.mtg_meetings (
  id uuid primary key default gen_random_uuid(),
  body text not null default 'ps' check (body in ('ps', 'os')),          -- ПС или Общо събрание
  academic_year_id uuid references public.academic_years(id) on delete set null,
  meeting_no int,                                                         -- № на протокола (от № 1 всяка учебна година, отделно за ПС и ОС)
  kind text not null default 'regular' check (kind in ('regular', 'extraordinary')),
  title text,                                                             -- тема по желание („Откриване на учебната година“)
  meeting_date date not null,
  start_time time,
  end_time time,
  place text,
  chair_id uuid references public.staff_profiles(id) on delete set null,      -- председател (по подразбиране директорът)
  secretary_id uuid references public.staff_profiles(id) on delete set null,  -- протоколчик (изготвя протокола)
  quorum_rule text not null default 'two_thirds' check (quorum_rule in ('two_thirds', 'half')),
  council_set_id uuid references public.council_sets(id) on delete set null,  -- „Материали за съгласуване“
  intro text,                                                             -- откриване / бележки преди дневния ред
  status text not null default 'planned' check (status in ('planned', 'held', 'final')),
  finalized_at timestamptz,
  finalized_by uuid references public.staff_profiles(id) on delete set null,
  amended_at timestamptz,
  amend_note text,
  scan_path text,                                                         -- сканираният подписан протокол (bucket meetings)
  created_by uuid default get_my_staff_id() references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (body, academic_year_id, meeting_no)
);
create index if not exists mtg_meetings_date_idx on public.mtg_meetings (meeting_date);
create index if not exists mtg_meetings_year_idx on public.mtg_meetings (academic_year_id, body);

-- Присъствие: членове (с право на глас), със съвещателен глас, гости
create table if not exists public.mtg_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.mtg_meetings(id) on delete cascade,
  staff_id uuid references public.staff_profiles(id) on delete cascade,
  guest_name text,                                                         -- външен участник (без профил)
  guest_role text,                                                         -- „медицинско лице“, „представител на обществения съвет“…
  role text not null default 'member' check (role in ('member', 'advisory', 'guest')),
  status text not null default 'present' check (status in ('present', 'absent', 'late', 'left')),
  reason text,                                                             -- причина за отсъствието
  sort int not null default 0,
  unique (meeting_id, staff_id),
  check (staff_id is not null or coalesce(trim(guest_name), '') <> '')
);
create index if not exists mtg_attendance_meeting_idx on public.mtg_attendance (meeting_id);

-- Точки от дневния ред и разискванията по тях
create table if not exists public.mtg_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.mtg_meetings(id) on delete cascade,
  sort int not null default 0,
  title text not null default '',
  rapporteur_id uuid references public.staff_profiles(id) on delete set null,   -- докладва
  rapporteur_text text,                                                          -- докладва (свободен текст)
  discussion text,                                                               -- разисквания
  created_at timestamptz not null default now()
);
create index if not exists mtg_items_meeting_idx on public.mtg_items (meeting_id, sort);

-- Решения: гласуване и проследяване на изпълнението
create table if not exists public.mtg_decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.mtg_meetings(id) on delete cascade,
  item_id uuid references public.mtg_items(id) on delete set null,
  sort int not null default 0,
  text text not null default '',
  kind text not null default 'vote' check (kind in ('vote', 'noted')),                  -- гласуване / „приема за сведение“
  majority text not null default 'simple' check (majority in ('simple', 'absolute', 'two_thirds')),
  votes_for int check (votes_for >= 0),
  votes_against int check (votes_against >= 0),
  votes_abstain int check (votes_abstain >= 0),
  outcome text not null default 'adopted' check (outcome in ('adopted', 'rejected', 'noted')),
  responsible_id uuid references public.staff_profiles(id) on delete set null,          -- отговорник за изпълнението
  due_date date,
  task_status text not null default 'open' check (task_status in ('open', 'reported', 'done', 'not_done')),
  report text,
  reported_at timestamptz,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mtg_decisions_meeting_idx on public.mtg_decisions (meeting_id, sort);
create index if not exists mtg_decisions_resp_idx on public.mtg_decisions (responsible_id);
create index if not exists mtg_decisions_due_idx on public.mtg_decisions (due_date);

-- ── помощни функции (security definer — без кръгово извикване на политиките) ──
create or replace function public.mtg_can_edit(p_meeting uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from mtg_meetings m where m.id = p_meeting and m.status <> 'final'
    and (mtg_is_manager() or m.chair_id = get_my_staff_id() or m.secretary_id = get_my_staff_id()))
$$;
grant execute on function public.mtg_can_edit(uuid) to authenticated;

-- Вижда ли съдържанието (присъствие, решения): окончателният — всички; черновата — водещите
create or replace function public.mtg_can_read(p_meeting uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from mtg_meetings m where m.id = p_meeting and (
    m.status = 'final' or mtg_is_manager() or m.chair_id = get_my_staff_id()
    or m.secretary_id = get_my_staff_id() or m.created_by = get_my_staff_id()))
$$;
grant execute on function public.mtg_can_read(uuid) to authenticated;

-- Дневният ред на насроченото заседание е публичен (това е поканата)
create or replace function public.mtg_can_read_agenda(p_meeting uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select mtg_can_read(p_meeting) or exists (select 1 from mtg_meetings m where m.id = p_meeting and m.status = 'planned')
$$;
grant execute on function public.mtg_can_read_agenda(uuid) to authenticated;

-- Учебната година по датата, ако не е подадена
create or replace function public.mtg_meetings_defaults() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.academic_year_id is null then
    select id into new.academic_year_id from academic_years
      where new.meeting_date between start_date and end_date order by start_date desc limit 1;
    if new.academic_year_id is null then
      select id into new.academic_year_id from academic_years where is_current limit 1;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists mtg_meetings_defaults on public.mtg_meetings;
create trigger mtg_meetings_defaults before insert on public.mtg_meetings
  for each row execute function public.mtg_meetings_defaults();

-- Окончателният протокол е заключен: позволени са само сканът; финализиране и поправка — само с функциите
create or replace function public.mtg_meetings_lock() returns trigger
language plpgsql set search_path = public as $$
declare keep text[] := array['scan_path', 'updated_at'];
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.status = 'final' then raise exception 'Новото заседание не може да е с окончателен протокол'; end if;
    new.meeting_no := null;
    return new;
  end if;
  if current_setting('mtg.system', true) = '1' then return new; end if;
  if old.status = 'final' then
    if (to_jsonb(new) - keep) <> (to_jsonb(old) - keep) then
      raise exception 'Окончателният протокол не се редактира — използвайте „Поправка“';
    end if;
  elsif new.status = 'final' then
    raise exception 'Протоколът става окончателен само с бутона „Впиши в Книгата“';
  elsif new.meeting_no is distinct from old.meeting_no then
    raise exception 'Номерът се определя при вписването в Книгата';
  end if;
  return new;
end $$;
drop trigger if exists mtg_meetings_lock on public.mtg_meetings;
create trigger mtg_meetings_lock before insert or update on public.mtg_meetings
  for each row execute function public.mtg_meetings_lock();

-- Вписване в Книгата: пореден № за учебната година (отделно за ПС и ОС). При поправка номерът се запазва.
create or replace function public.mtg_finalize(p_meeting uuid) returns int
language plpgsql security definer set search_path = public as $$
declare m record; n int;
begin
  select * into m from mtg_meetings where id = p_meeting for update;
  if m is null then raise exception 'Няма такова заседание'; end if;
  if m.status = 'final' then raise exception 'Протоколът вече е вписан в Книгата'; end if;
  if not (mtg_is_manager() or m.chair_id = get_my_staff_id() or m.secretary_id = get_my_staff_id()) then
    raise exception 'Нямате права';
  end if;
  if not exists (select 1 from mtg_items where meeting_id = p_meeting and trim(title) <> '') then
    raise exception 'Добавете дневен ред';
  end if;
  if not exists (select 1 from mtg_attendance where meeting_id = p_meeting and role = 'member') then
    raise exception 'Попълнете присъствието';
  end if;
  if m.meeting_date > (now() at time zone 'Europe/Sofia')::date then
    raise exception 'Заседанието още не е проведено';
  end if;
  n := m.meeting_no;
  if n is null then
    perform pg_advisory_xact_lock(hashtext('mtg_book_' || m.body || '_' || coalesce(m.academic_year_id::text, '')));
    select coalesce(max(meeting_no), 0) + 1 into n from mtg_meetings
      where body = m.body and academic_year_id is not distinct from m.academic_year_id and meeting_no is not null;
  end if;
  perform set_config('mtg.system', '1', true);
  update mtg_meetings set status = 'final', meeting_no = n, finalized_at = now(), finalized_by = get_my_staff_id()
    where id = p_meeting;
  perform set_config('mtg.system', '0', true);
  return n;
end $$;
grant execute on function public.mtg_finalize(uuid) to authenticated;

-- Поправка на окончателен протокол (с мотив; номерът остава) — ръководството
create or replace function public.mtg_reopen(p_meeting uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not mtg_is_manager() then raise exception 'Поправка прави само ръководството'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Посочете мотив за поправката'; end if;
  select * into m from mtg_meetings where id = p_meeting for update;
  if m is null or m.status <> 'final' then raise exception 'Протоколът не е окончателен'; end if;
  perform set_config('mtg.system', '1', true);
  update mtg_meetings set status = 'held', amended_at = now(),
    amend_note = trim(both E'\n' from coalesce(amend_note || E'\n', '') || to_char(now() at time zone 'Europe/Sofia', 'DD.MM.YYYY') || ': ' || trim(p_note))
    where id = p_meeting;
  perform set_config('mtg.system', '0', true);
end $$;
grant execute on function public.mtg_reopen(uuid, text) to authenticated;

-- Отговорникът отчита изпълнението на решение
create or replace function public.mtg_dec_report(p_dec uuid, p_report text) returns void
language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select x.*, m.status as mstatus into d from mtg_decisions x join mtg_meetings m on m.id = x.meeting_id where x.id = p_dec for update of x;
  if not found then raise exception 'Няма такова решение'; end if;
  if d.mstatus <> 'final' then raise exception 'Протоколът още не е окончателен'; end if;
  if d.responsible_id is distinct from get_my_staff_id() and not mtg_is_manager() then raise exception 'Отчита отговорникът'; end if;
  if coalesce(trim(p_report), '') = '' then raise exception 'Опишете какво е направено'; end if;
  update mtg_decisions set task_status = 'reported', report = trim(p_report), reported_at = now() where id = p_dec;
end $$;
grant execute on function public.mtg_dec_report(uuid, text) to authenticated;

-- Ръководството: „изпълнено“ / „неизпълнено“ / обратно „отворено“
create or replace function public.mtg_dec_review(p_dec uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not mtg_is_manager() then raise exception 'Нямате права'; end if;
  if p_status not in ('open', 'done', 'not_done') then raise exception 'Невалиден статус'; end if;
  update mtg_decisions set task_status = p_status, review_note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_at = case when p_status = 'open' then null else now() end where id = p_dec;
  if not found then raise exception 'Няма такова решение'; end if;
end $$;
grant execute on function public.mtg_dec_review(uuid, text, text) to authenticated;

-- ── RLS ──
alter table public.mtg_meetings enable row level security;
alter table public.mtg_attendance enable row level security;
alter table public.mtg_items enable row level security;
alter table public.mtg_decisions enable row level security;

-- Четене: колоните се проверяват директно (за да работи insert … returning)
drop policy if exists "mtg_meetings_read" on public.mtg_meetings;
create policy "mtg_meetings_read" on public.mtg_meetings for select to authenticated
  using (status <> 'held' or mtg_is_manager() or created_by = get_my_staff_id()
    or chair_id = get_my_staff_id() or secretary_id = get_my_staff_id());
drop policy if exists "mtg_meetings_insert" on public.mtg_meetings;
create policy "mtg_meetings_insert" on public.mtg_meetings for insert to authenticated
  with check (mtg_is_manager());
drop policy if exists "mtg_meetings_update" on public.mtg_meetings;
create policy "mtg_meetings_update" on public.mtg_meetings for update to authenticated
  using (mtg_is_manager() or chair_id = get_my_staff_id() or secretary_id = get_my_staff_id())
  with check (mtg_is_manager() or chair_id = get_my_staff_id() or secretary_id = get_my_staff_id());
drop policy if exists "mtg_meetings_delete" on public.mtg_meetings;
create policy "mtg_meetings_delete" on public.mtg_meetings for delete to authenticated
  using (mtg_is_manager() and status <> 'final');

drop policy if exists "mtg_attendance_read" on public.mtg_attendance;
create policy "mtg_attendance_read" on public.mtg_attendance for select to authenticated using (mtg_can_read(meeting_id));
drop policy if exists "mtg_attendance_write" on public.mtg_attendance;
create policy "mtg_attendance_write" on public.mtg_attendance for all to authenticated
  using (mtg_can_edit(meeting_id)) with check (mtg_can_edit(meeting_id));

drop policy if exists "mtg_items_read" on public.mtg_items;
create policy "mtg_items_read" on public.mtg_items for select to authenticated using (mtg_can_read_agenda(meeting_id));
drop policy if exists "mtg_items_write" on public.mtg_items;
create policy "mtg_items_write" on public.mtg_items for all to authenticated
  using (mtg_can_edit(meeting_id)) with check (mtg_can_edit(meeting_id));

-- Решенията: отговорникът вижда своите и в черновата не — само след вписването (тогава са за всички)
drop policy if exists "mtg_decisions_read" on public.mtg_decisions;
create policy "mtg_decisions_read" on public.mtg_decisions for select to authenticated using (mtg_can_read(meeting_id));
drop policy if exists "mtg_decisions_write" on public.mtg_decisions;
create policy "mtg_decisions_write" on public.mtg_decisions for all to authenticated
  using (mtg_can_edit(meeting_id)) with check (mtg_can_edit(meeting_id));

-- Сканираните подписани протоколи: път „<meeting_id>/<файл>“
insert into storage.buckets (id, name, public) values ('meetings', 'meetings', false)
on conflict (id) do nothing;
drop policy if exists "mtg_files_read" on storage.objects;
create policy "mtg_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'meetings' and exists (select 1 from mtg_meetings m
    where m.id::text = (storage.foldername(name))[1] and mtg_can_read(m.id)));
drop policy if exists "mtg_files_insert" on storage.objects;
create policy "mtg_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'meetings' and exists (select 1 from mtg_meetings m
    where m.id::text = (storage.foldername(name))[1]
      and (mtg_is_manager() or m.chair_id = get_my_staff_id() or m.secretary_id = get_my_staff_id())));
drop policy if exists "mtg_files_delete" on storage.objects;
create policy "mtg_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'meetings' and exists (select 1 from mtg_meetings m
    where m.id::text = (storage.foldername(name))[1]
      and (mtg_is_manager() or m.chair_id = get_my_staff_id() or m.secretary_id = get_my_staff_id())));

notify pgrst, 'reload schema';
