-- Контролна дейност — етап 1: проверки, констативни протоколи и Книга за контролната дейност.
-- Основания: чл. 258 ЗПУО; чл. 31, ал. 1, т. 3, 4, 30 от Наредба № 15/2019;
-- чл. 41, ал. 3 и 7 и Приложение № 2 от Наредба № 8/2016 (протокол до 15 дни, номерация от № 1 всяка година,
-- подписан от проверяващия и проверения, съхранение 5 години).
-- Вижда: директорът — всичко; проверяващият (ЗДУД, ЗДАСД…) — своите; провереният — само подписаните протоколи за себе си.
-- Подписаният протокол не се редактира — анулира се с мотив и се съставя нов. Безопасно за повторно пускане.

-- Допълнителни проверяващи (напр. ЗДАСД, който е с роля „Администратор“). Директорът и ЗДУД са проверяващи по роля.
create table if not exists public.control_inspectors (
  staff_id uuid primary key references public.staff_profiles(id) on delete cascade,
  added_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.control_is_director() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text = 'director'
$$;

create or replace function public.control_is_inspector() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('director', 'zdud')
    or exists (select 1 from control_inspectors i where i.staff_id = get_my_staff_id())
$$;

-- Шаблони на протоколите: критериите са групи с точки за оценка 1–3 (и „неприложимо“)
create table if not exists public.control_templates (
  id uuid primary key default gen_random_uuid(),
  code text unique,                                    -- за началните шаблони
  name text not null,
  kind text not null default 'current' check (kind in ('preliminary', 'current', 'follow_up')),
  focus text not null default 'pedagogical' check (focus in ('pedagogical', 'administrative')),
  form text not null default 'observation' check (form in ('thematic', 'current', 'observation', 'study')),
  subject text,                                        -- предмет по подразбиране („наблюдение на учебен час“)
  purpose text,                                        -- цел по подразбиране
  method text,                                         -- как се осъществява по подразбиране
  details text[] not null default '{}',                -- кои полета за детайли да се питат: class, subject, topic, attendance
  criteria jsonb not null default '[]',                -- [{ "g": "Група", "items": [{ "k": "p1", "t": "Критерий" }] }]
  is_active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.control_checks (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid references public.academic_years(id) on delete set null,
  inspector_id uuid not null references public.staff_profiles(id) on delete restrict,
  inspector_title text,                                -- „Директор“, „Заместник-директор по учебната дейност“… (към момента)
  template_id uuid references public.control_templates(id) on delete set null,
  visit_booking_id uuid references public.visit_bookings(id) on delete set null,
  kind text not null default 'current' check (kind in ('preliminary', 'current', 'follow_up')),
  focus text not null default 'pedagogical' check (focus in ('pedagogical', 'administrative')),
  form text not null default 'observation' check (form in ('thematic', 'current', 'observation', 'study')),
  planned boolean not null default true,               -- по плана за контролната дейност / извън плана (по сигнал)
  announced boolean not null default true,             -- предварително оповестена
  check_date date not null default current_date,       -- дата на проверката (срокът от 15 дни тече от нея)
  subject text not null default '',                    -- какво е проверено
  purpose text,
  basis text,                                          -- нормативното основание (попълва се автоматично, може да се промени)
  method text,                                         -- как е осъществена (разговор, проверени документи…)
  details jsonb not null default '{}',                 -- клас, предмет, тема, присъстващи/отсъстващи
  criteria jsonb not null default '[]',                -- копие на критериите от шаблона към момента
  findings jsonb not null default '{}',                -- { "p1": { "s": 1|2|3|0, "n": "бележка" } }
  findings_text text,                                  -- свободни констатации
  strengths text,                                      -- силни страни (задължително — не само недостатъци)
  conclusions text,
  status text not null default 'draft' check (status in ('draft', 'signed', 'voided')),
  book_no int,                                         -- № в Книгата за контролната дейност (от № 1 всяка учебна година)
  signed_at timestamptz,
  scan_path text,                                      -- сканираният подписан протокол (bucket control)
  voided_reason text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, book_no)
);
create index if not exists control_checks_year_idx on public.control_checks (academic_year_id, check_date);
create index if not exists control_checks_inspector_idx on public.control_checks (inspector_id);
create index if not exists control_checks_visit_idx on public.control_checks (visit_booking_id);

-- Проверените служители по протокола: запознаване и възражение
create table if not exists public.control_check_staff (
  check_id uuid not null references public.control_checks(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  acked_at timestamptz,
  objection text,
  objection_at timestamptz,
  primary key (check_id, staff_id)
);
create index if not exists control_check_staff_staff_idx on public.control_check_staff (staff_id);

-- Препоръки със срок (проследяването и последващият контрол — в следващия етап)
create table if not exists public.control_recommendations (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.control_checks(id) on delete cascade,
  sort int not null default 0,
  text text not null,
  due_date date,
  responsible_id uuid references public.staff_profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'reported', 'done', 'not_done')),
  report text,
  created_at timestamptz not null default now()
);
create index if not exists control_recommendations_check_idx on public.control_recommendations (check_id);

-- Вижда ли текущият служител проверката
create or replace function public.control_can_see(p_check uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select control_is_director()
    or exists (select 1 from control_checks c where c.id = p_check and c.inspector_id = get_my_staff_id())
    or exists (select 1 from control_checks c join control_check_staff s on s.check_id = c.id
               where c.id = p_check and c.status <> 'draft' and s.staff_id = get_my_staff_id())
$$;

-- Може ли да редактира (само черновата: проверяващият или директорът)
create or replace function public.control_can_edit(p_check uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from control_checks c where c.id = p_check and c.status = 'draft'
                 and (c.inspector_id = get_my_staff_id() or control_is_director()))
$$;

-- Подписаният / анулираният протокол е заключен: позволени са само сканът и анулирането
create or replace function public.control_checks_lock() returns trigger
language plpgsql set search_path = public as $$
declare keep text[] := array['scan_path', 'status', 'voided_reason', 'voided_at', 'updated_at'];
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if (to_jsonb(new) - keep) <> (to_jsonb(old) - keep) then
      raise exception 'Подписаният протокол не се редактира — анулирайте го и съставете нов';
    end if;
    if new.status = 'draft' or (old.status = 'voided' and new.status <> 'voided') then
      raise exception 'Протоколът не може да се върне в чернова';
    end if;
    if new.status = 'voided' and coalesce(trim(new.voided_reason), '') = '' then
      raise exception 'Посочете мотив за анулирането';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status <> 'draft' and current_setting('control.signing', true) is distinct from '1' then
    raise exception 'Подписването става само с бутона „Подпиши и впиши в Книгата“';
  end if;
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'Новият протокол е чернова';
  end if;
  return new;
end $$;
drop trigger if exists control_checks_lock on public.control_checks;
create trigger control_checks_lock before insert or update on public.control_checks
  for each row execute function public.control_checks_lock();

-- Подписване: пореден № в Книгата за учебната година (заключване, за да няма два еднакви)
create or replace function public.control_sign(p_check uuid) returns int
language plpgsql security definer set search_path = public as $$
declare c record; n int;
begin
  select * into c from control_checks where id = p_check for update;
  if c is null then raise exception 'Няма такъв протокол'; end if;
  if c.status <> 'draft' then raise exception 'Протоколът вече е подписан'; end if;
  if c.inspector_id <> get_my_staff_id() then raise exception 'Подписва само проверяващият'; end if;
  if coalesce(trim(c.subject), '') = '' then raise exception 'Попълнете какво е проверено'; end if;
  if not exists (select 1 from control_check_staff s where s.check_id = p_check) then
    raise exception 'Посочете проверения служител';
  end if;
  perform pg_advisory_xact_lock(hashtext('control_book_' || coalesce(c.academic_year_id::text, '')));
  select coalesce(max(book_no), 0) + 1 into n from control_checks
    where academic_year_id is not distinct from c.academic_year_id and book_no is not null;
  perform set_config('control.signing', '1', true);
  update control_checks set status = 'signed', book_no = n, signed_at = now() where id = p_check;
  perform set_config('control.signing', '0', true);
  return n;
end $$;
grant execute on function public.control_sign(uuid) to authenticated;

-- Анулиране с мотив (номерът остава зает в Книгата, редът се отбелязва като анулиран)
create or replace function public.control_void(p_check uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from control_checks where id = p_check for update;
  if c is null then raise exception 'Няма такъв протокол'; end if;
  if c.status <> 'signed' then raise exception 'Анулира се само подписан протокол'; end if;
  if not (c.inspector_id = get_my_staff_id() or control_is_director()) then raise exception 'Нямате права'; end if;
  update control_checks set status = 'voided', voided_reason = p_reason, voided_at = now() where id = p_check;
end $$;
grant execute on function public.control_void(uuid, text) to authenticated;

-- Провереният: „Запознат съм“ и по желание възражение (до 7 дни след подписването)
create or replace function public.control_ack(p_check uuid, p_objection text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c record; s record;
begin
  select * into c from control_checks where id = p_check;
  if c is null or c.status <> 'signed' then raise exception 'Протоколът не е подписан'; end if;
  select * into s from control_check_staff where check_id = p_check and staff_id = get_my_staff_id();
  if s is null then raise exception 'Протоколът не е за вас'; end if;
  if coalesce(trim(p_objection), '') <> '' then
    if s.objection is not null then raise exception 'Възражението вече е подадено'; end if;
    if now() > c.signed_at + interval '7 days' then raise exception 'Срокът за възражение (7 дни) е изтекъл'; end if;
    update control_check_staff set objection = trim(p_objection), objection_at = now(), acked_at = coalesce(acked_at, now())
      where check_id = p_check and staff_id = s.staff_id;
  else
    update control_check_staff set acked_at = coalesce(acked_at, now()) where check_id = p_check and staff_id = s.staff_id;
  end if;
end $$;
grant execute on function public.control_ack(uuid, text) to authenticated;

-- Директорът определя допълнителните проверяващи
create or replace function public.control_set_inspector(p_staff uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not control_is_director() then raise exception 'Само директорът определя проверяващите'; end if;
  if p_on then
    insert into control_inspectors (staff_id, added_by) values (p_staff, get_my_staff_id()) on conflict do nothing;
  else
    delete from control_inspectors where staff_id = p_staff;
  end if;
end $$;
grant execute on function public.control_set_inspector(uuid, boolean) to authenticated;

-- RLS
alter table public.control_inspectors enable row level security;
alter table public.control_templates enable row level security;
alter table public.control_checks enable row level security;
alter table public.control_check_staff enable row level security;
alter table public.control_recommendations enable row level security;

drop policy if exists "control_inspectors_read" on public.control_inspectors;
create policy "control_inspectors_read" on public.control_inspectors for select to authenticated using (true);

drop policy if exists "control_templates_read" on public.control_templates;
create policy "control_templates_read" on public.control_templates for select to authenticated using (true);
drop policy if exists "control_templates_write" on public.control_templates;
create policy "control_templates_write" on public.control_templates for all to authenticated
  using (get_my_role()::text in ('director', 'zdud')) with check (get_my_role()::text in ('director', 'zdud'));

drop policy if exists "control_checks_read" on public.control_checks;
create policy "control_checks_read" on public.control_checks for select to authenticated using (control_can_see(id));
drop policy if exists "control_checks_insert" on public.control_checks;
create policy "control_checks_insert" on public.control_checks for insert to authenticated
  with check (control_is_inspector() and inspector_id = get_my_staff_id());
-- редакция: черновата — проверяващият или директорът; подписания — само скан/анулиране (тригерът пази останалото)
drop policy if exists "control_checks_update" on public.control_checks;
create policy "control_checks_update" on public.control_checks for update to authenticated
  using (inspector_id = get_my_staff_id() or control_is_director())
  with check (inspector_id = get_my_staff_id() or control_is_director());
drop policy if exists "control_checks_delete" on public.control_checks;
create policy "control_checks_delete" on public.control_checks for delete to authenticated
  using (status = 'draft' and (inspector_id = get_my_staff_id() or control_is_director()));

drop policy if exists "control_check_staff_read" on public.control_check_staff;
create policy "control_check_staff_read" on public.control_check_staff for select to authenticated using (control_can_see(check_id));
drop policy if exists "control_check_staff_write" on public.control_check_staff;
create policy "control_check_staff_write" on public.control_check_staff for all to authenticated
  using (control_can_edit(check_id)) with check (control_can_edit(check_id));

drop policy if exists "control_recommendations_read" on public.control_recommendations;
create policy "control_recommendations_read" on public.control_recommendations for select to authenticated using (control_can_see(check_id));
drop policy if exists "control_recommendations_write" on public.control_recommendations;
create policy "control_recommendations_write" on public.control_recommendations for all to authenticated
  using (control_can_edit(check_id)) with check (control_can_edit(check_id));

-- Сканираните подписани протоколи: път „<check_id>/<файл>“
insert into storage.buckets (id, name, public) values ('control', 'control', false)
on conflict (id) do nothing;
drop policy if exists "control_files_read" on storage.objects;
create policy "control_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'control' and exists (select 1 from control_checks c
    where c.id::text = (storage.foldername(name))[1] and control_can_see(c.id)));
drop policy if exists "control_files_insert" on storage.objects;
create policy "control_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'control' and exists (select 1 from control_checks c
    where c.id::text = (storage.foldername(name))[1] and (c.inspector_id = get_my_staff_id() or control_is_director())));
drop policy if exists "control_files_delete" on storage.objects;
create policy "control_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'control' and exists (select 1 from control_checks c
    where c.id::text = (storage.foldername(name))[1] and (c.inspector_id = get_my_staff_id() or control_is_director())));

-- Начални шаблони (директорът ги допълва/поправя от „Контролна дейност → Шаблони“)
insert into public.control_templates (code, name, kind, focus, form, subject, purpose, method, details, criteria, sort) values
('lesson', 'Наблюдение на учебен час', 'current', 'pedagogical', 'observation',
 'наблюдение на учебен час', 'Установяване на качеството на образователния процес и на подкрепата за учениците',
 'Наблюдение на учебния час; разговор с учителя; проверка на дневника (тема, отсъствия, реализация на ИУП).',
 '{class,subject,topic,attendance}',
 '[{"g":"Планиране и цели","items":[{"k":"l1","t":"Целите на часа са ясни и съобразени с индивидуалните учебни програми"},{"k":"l2","t":"Дейностите отговарят на възможностите и потребностите на учениците"},{"k":"l3","t":"Предварително подготвени материали, нагледност и визуална подкрепа"}]},
   {"g":"Организация и методи","items":[{"k":"l4","t":"Подходящи методи и диференцирани задачи"},{"k":"l5","t":"Ефективно използване на времето и плавни преходи между дейностите"},{"k":"l6","t":"Алтернативна комуникация и визуален график при нужда"},{"k":"l7","t":"Ефективно използване на дигитални ресурси"}]},
   {"g":"Подкрепа и взаимодействие","items":[{"k":"l8","t":"Позитивна, предвидима и безопасна среда"},{"k":"l9","t":"Подкрепа на поведението и превенция на кризи"},{"k":"l10","t":"Участие и мотивация на всеки ученик"},{"k":"l11","t":"Сътрудничество с помощник на учителя и специалистите"}]},
   {"g":"Оценяване и обратна връзка","items":[{"k":"l12","t":"Проследяване на напредъка по целите на ИУП"},{"k":"l13","t":"Насърчаваща и конкретна обратна връзка"}]},
   {"g":"Документация","items":[{"k":"l14","t":"Своевременно вписване на темата, отсъствията и реализацията на ИУП"}]}]', 10),
('coud', 'Наблюдение на занимание в ЦОУД', 'current', 'pedagogical', 'observation',
 'наблюдение на занимание в целодневната организация', 'Установяване на качеството на заниманията в ЦОУД',
 'Наблюдение на заниманието; разговор с учителя ЦОУД; проверка на документацията на групата.',
 '{class,topic,attendance}',
 '[{"g":"Организация","items":[{"k":"c1","t":"Заниманието следва дневния режим и седмичното разписание на групата"},{"k":"c2","t":"Дейностите са съобразени с възрастта и възможностите на учениците"},{"k":"c3","t":"Осигурени са почивка, хранене и хигиена според режима"}]},
   {"g":"Подкрепа","items":[{"k":"c4","t":"Индивидуален подход и подкрепа на самостоятелността"},{"k":"c5","t":"Подкрепа на поведението и безопасност"},{"k":"c6","t":"Занимания по интереси и социални умения"}]},
   {"g":"Документация","items":[{"k":"c7","t":"Своевременно вписване на заниманията и отсъствията"}]}]', 20),
('therapy', 'Наблюдение на корекционно-терапевтична сесия', 'current', 'pedagogical', 'observation',
 'наблюдение на корекционно-терапевтична сесия', 'Установяване на качеството на корекционно-терапевтичната и рехабилитационната дейност',
 'Наблюдение на сесията; разговор със специалиста; проверка на плана за подкрепа и документацията.',
 '{topic}',
 '[{"g":"Цели и планиране","items":[{"k":"t1","t":"Целите на сесията следват плана за подкрепа и индивидуалната програма"},{"k":"t2","t":"Подбрани са подходящи методики и материали"}]},
   {"g":"Провеждане","items":[{"k":"t3","t":"Ясна структура и предвидимост на сесията"},{"k":"t4","t":"Адаптиране на задачите според реакциите на ученика"},{"k":"t5","t":"Мотивиране и позитивно подкрепление"}]},
   {"g":"Проследяване и партньорство","items":[{"k":"t6","t":"Проследяване и отчитане на напредъка"},{"k":"t7","t":"Консултиране на родителите и учителите"},{"k":"t8","t":"Своевременно водене на документацията за терапията"}]}]', 30),
('eplr_docs', 'Проверка на документацията на ЕПЛР', 'current', 'administrative', 'thematic',
 'проверка на документацията на екипа за подкрепа за личностно развитие', 'Установяване на съответствието на документацията на ЕПЛР с Наредбата за приобщаващото образование',
 'Проверка на документите на учениците; разговор с класния ръководител и координатора.',
 '{class}',
 '[{"g":"Документи на ученика","items":[{"k":"e1","t":"Индивидуален учебен план — изготвен и утвърден в срок"},{"k":"e2","t":"Индивидуални учебни програми — изготвени за всички предмети по плана"},{"k":"e3","t":"План за подкрепа — изготвен и актуален"},{"k":"e4","t":"Оценка на индивидуалните потребности — налична и в срок"}]},
   {"g":"Работа на екипа","items":[{"k":"e5","t":"Протоколи от заседанията на ЕПЛР — налични и подписани"},{"k":"e6","t":"Спазени срокове за преглед и отчет на напредъка"},{"k":"e7","t":"Родителите са запознати с документите"}]}]', 40),
('iup', 'Реализация на ИУП и водене на дневника', 'current', 'administrative', 'current',
 'проверка на реализацията на ИУП и воденето на дневника', 'Установяване на редовното отразяване на учебните часове, отсъствията и реализацията на ИУП',
 'Проверка на дневника и на справката „Реализация на ИУП“ в системата.',
 '{class}',
 '[{"g":"Дневник","items":[{"k":"i1","t":"Темите на учебните часове са вписани своевременно"},{"k":"i2","t":"Отсъствията на учениците са отразени своевременно"},{"k":"i3","t":"Реализацията на ИУП е отразена за проверявания период"}]},
   {"g":"Последващи мерки","items":[{"k":"i4","t":"При отсъствия са предприети мерки и родителите са уведомени"}]}]', 50),
('discipline', 'Дежурства, трудова дисциплина и ПВТР', 'current', 'administrative', 'current',
 'проверка на дежурствата и спазването на трудовата дисциплина', 'Установяване на спазването на графика за дежурства, седмичното разписание и Правилника за вътрешния трудов ред',
 'Проверка на място; сверяване с графика за дежурства и седмичното разписание.',
 '{}',
 '[{"g":"Дежурства","items":[{"k":"d1","t":"Дежурството се изпълнява според графика"},{"k":"d2","t":"Осигурена е безопасност на учениците при прием, междучасия и изпращане"}]},
   {"g":"Трудова дисциплина","items":[{"k":"d3","t":"Спазване на работното време и седмичното разписание"},{"k":"d4","t":"Спазване на Правилника за вътрешния трудов ред"}]}]', 60),
('preventive', 'Превантивна проверка', 'preliminary', 'administrative', 'study',
 'превантивен контрол', 'Предотвратяване на възможни пропуски и нарушения',
 'Проучване и обсъждане с отговорните служители.', '{}', '[]', 70),
('free', 'Свободен протокол', 'current', 'pedagogical', 'current',
 '', null, null, '{}', '[]', 90)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
