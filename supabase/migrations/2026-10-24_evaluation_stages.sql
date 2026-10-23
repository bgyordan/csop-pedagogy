-- Оценяване на персонала — етапи 2–4: атестиране (Наредба № 15/2019), доказателства от ЕИС и анализ,
-- други оценъчни карти, регистър и архив. Пуска се след 2026-10-23_evaluation.sql. Безопасно за повторно пускане.
--
-- Атестиране: атестираният прави самооценка (СО) в картата и подава портфолио; всеки член на атестационната
-- комисия оценява самостоятелно; ОАК = средно от членовете (или обща оценка); ОР = 0,25·СО + 0,75·ОАК.
-- Скала: 45–50 / 40–44,99 / 35–39,99 / 30–34,99 / 25–29,99. Възражение до 5 работни дни; работодателят
-- потвърждава или променя крайната оценка с една степен. При двете най-ниски оценки — план за подкрепа и
-- наставник; при най-ниската — повторно атестиране след една година. Атестира се на всеки 4 години.

-- ── Кампании ──────────────────────────────────────────────────────────────
alter table public.eval_campaigns add column if not exists period_from date;            -- период на атестиране / оценяване
alter table public.eval_campaigns add column if not exists period_to date;
alter table public.eval_campaigns add column if not exists self_assess boolean not null default false;  -- самооценка от лицето
alter table public.eval_campaigns add column if not exists self_by date;                -- самооценката и портфолиото до
alter table public.eval_campaigns add column if not exists decide_days int not null default 5;  -- решение по възражението до … работни дни
alter table public.eval_campaigns add column if not exists secretary_id uuid references public.staff_profiles(id) on delete set null;  -- технически секретар
alter table public.eval_campaigns add column if not exists scale jsonb;                 -- скала за крайната оценка (атестиране)
alter table public.eval_campaigns add column if not exists note text;
alter table public.eval_campaigns add column if not exists source_id uuid references public.eval_campaigns(id) on delete set null; -- копирана от

alter table public.eval_commission add column if not exists org text;                   -- „представител на ПС“, „синдикат“…

-- Външни членове на комисията (напр. представител на РУО): не влизат в системата, точките им въвежда
-- председателят или техническият секретар.
create table if not exists public.eval_external (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.eval_campaigns(id) on delete cascade,
  name text not null,
  org text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists eval_external_campaign_idx on public.eval_external (campaign_id);

-- ── Оценките: и на външните членове ───────────────────────────────────────
alter table public.eval_scores add column if not exists id uuid not null default gen_random_uuid();
alter table public.eval_scores add column if not exists ext_id uuid references public.eval_external(id) on delete cascade;
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'eval_scores_pkey' and conrelid = 'public.eval_scores'::regclass
             and pg_get_constraintdef(oid) ilike '%member_id%') then
    alter table public.eval_scores drop constraint eval_scores_pkey;
    alter table public.eval_scores add constraint eval_scores_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eval_scores_member_uq') then
    alter table public.eval_scores add constraint eval_scores_member_uq unique (participant_id, member_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eval_scores_ext_uq') then
    alter table public.eval_scores add constraint eval_scores_ext_uq unique (participant_id, ext_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eval_scores_who_chk') then
    alter table public.eval_scores add constraint eval_scores_who_chk check (num_nonnulls(member_id, ext_id) = 1);
  end if;
end $$;
alter table public.eval_scores alter column member_id drop not null;

-- ── Лицата: самооценка, раздел А, ОР, крайна оценка, коментари ────────────
alter table public.eval_participants add column if not exists self_scores jsonb;
alter table public.eval_participants add column if not exists self_total numeric;
alter table public.eval_participants add column if not exists self_at timestamptz;      -- подадена самооценка
alter table public.eval_participants add column if not exists section_a jsonb;          -- раздел А „Съответствие с изискванията“
alter table public.eval_participants add column if not exists result numeric;           -- ОР
alter table public.eval_participants add column if not exists grade text;               -- крайна оценка на комисията
alter table public.eval_participants add column if not exists commission_comment text;
alter table public.eval_participants add column if not exists employer_grade text;      -- крайна оценка на работодателя
alter table public.eval_participants add column if not exists employer_note text;
alter table public.eval_participants add column if not exists employer_at timestamptz;

-- Карти: скала с описанията на степените (отпечатва се в картата и се вижда при оценяването)
alter table public.eval_templates add column if not exists guide text;

-- Портфолио и доказателства, прикачени към лицето. Път „<campaign_id>/p/<participant_id>/<файл>“
create table if not exists public.eval_files (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.eval_participants(id) on delete cascade,
  name text not null,
  path text not null,
  note text,
  uploaded_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists eval_files_participant_idx on public.eval_files (participant_id);

-- План за методическа и организационна подкрепа (при двете най-ниски оценки) и наставник
create table if not exists public.eval_support (
  participant_id uuid primary key references public.eval_participants(id) on delete cascade,
  mentor_id uuid references public.staff_profiles(id) on delete set null,
  causes text,                                  -- анализ на причините
  measures text,                                -- мерки за подкрепа
  training text,                                -- теми за квалификация (предложение към ПС)
  start_date date,
  reattest_by date,                             -- повторно атестиране (при най-ниската оценка — 1 година след началото)
  status text not null default 'open' check (status in ('open', 'done')),
  result text,
  updated_at timestamptz not null default now()
);

-- Атестации преди системата (за регистъра и 4-годишния цикъл)
create table if not exists public.eval_attest_history (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  attested_on date not null,
  result numeric,
  grade text,
  note text,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists eval_attest_history_staff_idx on public.eval_attest_history (staff_id);

-- ── Помощни ───────────────────────────────────────────────────────────────
create or replace function public.eval_is_secretary(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eval_campaigns c where c.id = p_campaign and c.secretary_id = get_my_staff_id())
$$;

create or replace function public.eval_can_see_campaign(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eval_is_manager() or eval_is_finance() or eval_on_commission(p_campaign) or eval_is_secretary(p_campaign)
$$;

-- Самооценката е отворена (кампания със самооценка, която е започнала)
create or replace function public.eval_self_stage(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eval_campaigns c where c.id = p_campaign and c.self_assess and c.status <> 'setup')
$$;

-- Вижда ли лицето своята карта в кампанията (изпратена или със самооценка)
create or replace function public.eval_has_card(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eval_participants p where p.campaign_id = p_campaign
                 and p.staff_id = get_my_staff_id() and (p.sent_at is not null or eval_self_stage(p_campaign)))
$$;

create or replace function public.eval_is_mine(p_participant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eval_participants p where p.id = p_participant and p.staff_id = get_my_staff_id()
                 and (p.sent_at is not null or eval_self_stage(p.campaign_id)))
$$;

-- Може ли текущият служител да въвежда точките на външен член (председател/организатор или техн. секретар)
create or replace function public.eval_can_enter_ext(p_participant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from eval_participants p join eval_campaigns c on c.id = p.campaign_id
    where p.id = p_participant and c.status = 'scoring' and p.status = 'pending' and p.evaluator = 'commission'
      and (eval_can_lead(c.id) or eval_is_secretary(c.id)))
$$;

-- Членовете на комисията се оценяват от директора — само при ДТВ
create or replace function public.eval_participants_evaluator() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from eval_campaigns k where k.id = new.campaign_id and k.kind = 'dtv')
     and exists (select 1 from eval_commission c where c.campaign_id = new.campaign_id and c.staff_id = new.staff_id) then
    new.evaluator := 'director';
  end if;
  return new;
end $$;

create or replace function public.eval_commission_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from eval_campaigns k where k.id = new.campaign_id and k.kind = 'dtv') then
    update eval_participants set evaluator = 'director'
      where campaign_id = new.campaign_id and staff_id = new.staff_id and evaluator <> 'director' and status = 'pending';
  end if;
  return new;
end $$;

-- Скалата по подразбиране за атестирането
create or replace function public.eval_default_scale() returns jsonb
language sql immutable as $$
  select '[{"min": 45, "l": "Изключително изпълнение"},
           {"min": 40, "l": "Надвишава изискванията"},
           {"min": 35, "l": "Отговаря на изискванията"},
           {"min": 30, "l": "Отговаря частично на изискванията", "support": true},
           {"min": 25, "l": "Съответства в минимална степен на изискванията", "support": true, "reattest": true}]'::jsonb
$$;

-- Степента по скалата (подредена от най-високата към най-ниската)
create or replace function public.eval_grade(p_scale jsonb, p_value numeric) returns text
language sql immutable as $$
  select coalesce(
    (select s->>'l' from jsonb_array_elements(coalesce(p_scale, eval_default_scale())) with ordinality as x(s, i)
      where p_value >= (s->>'min')::numeric order by i limit 1),
    (select s->>'l' from jsonb_array_elements(coalesce(p_scale, eval_default_scale())) with ordinality as x(s, i)
      order by i desc limit 1))
$$;
create or replace function public.eval_grade_index(p_scale jsonb, p_grade text) returns int
language sql immutable as $$
  select (i - 1)::int from jsonb_array_elements(coalesce(p_scale, eval_default_scale())) with ordinality as x(s, i)
   where s->>'l' = p_grade limit 1
$$;

-- ── Самооценка (лицето; или председателят/секретарят от хартиения вариант) ─
create or replace function public.eval_self(p_participant uuid, p_scores jsonb, p_section_a jsonb, p_submit boolean default false) returns numeric
language plpgsql security definer set search_path = public as $$
declare p record; c record; tot numeric; it record;
begin
  select * into p from eval_participants where id = p_participant for update;
  if p is null then raise exception 'Няма такова лице'; end if;
  select * into c from eval_campaigns where id = p.campaign_id;
  if not c.self_assess then raise exception 'В тази кампания няма самооценка'; end if;
  if c.status <> 'scoring' then raise exception 'Оценяването не е започнало или е приключило'; end if;
  if p.status <> 'pending' then raise exception 'Оценката вече е утвърдена — самооценката не може да се променя'; end if;
  if not (p.staff_id = get_my_staff_id() or eval_can_lead(c.id) or eval_is_secretary(c.id)) then raise exception 'Нямате права'; end if;
  if p_submit then
    tot := eval_total(p.criteria, coalesce(p_scores, '{}'));
  else
    tot := null;
  end if;
  update eval_participants set self_scores = coalesce(p_scores, self_scores), section_a = coalesce(p_section_a, section_a),
    self_total = case when p_submit then tot else self_total end,
    self_at = case when p_submit then now() else self_at end
    where id = p_participant;
  return tot;
end $$;
grant execute on function public.eval_self(uuid, jsonb, jsonb, boolean) to authenticated;

-- ── Утвърждаване: при атестиране и ОР и степента ──────────────────────────
create or replace function public.eval_finalize(p_participant uuid, p_scores jsonb default null) returns numeric
language plpgsql security definer set search_path = public as $$
declare p record; c record; it record; avg_scores jsonb := '{}'; n int; tot numeric; res numeric;
begin
  select * into p from eval_participants where id = p_participant for update;
  if p is null then raise exception 'Няма такова лице'; end if;
  select * into c from eval_campaigns where id = p.campaign_id;
  if c.status <> 'scoring' then raise exception 'Оценяването не е започнало или е приключило'; end if;
  if p.status <> 'pending' then raise exception 'Оценката вече е утвърдена'; end if;
  if p.evaluator = 'director' then
    if not eval_is_director() then raise exception 'Това лице се оценява от директора'; end if;
    if p_scores is null then raise exception 'Въведете точките'; end if;
  else
    if not eval_can_lead(p.campaign_id) then raise exception 'Утвърждава председателят на комисията'; end if;
    if p.staff_id = get_my_staff_id() then raise exception 'Не можете да утвърдите собствената си оценка'; end if;
  end if;
  if c.kind = 'attest' and p.self_total is null then raise exception 'Няма подадена самооценка (СО) — тя влиза в окончателния резултат'; end if;
  if p_scores is null then
    select count(*) into n from eval_scores where participant_id = p_participant and submitted_at is not null;
    if n = 0 then raise exception 'Няма подадени оценки от членовете'; end if;
    for it in
      select k.key, round(avg((s.scores->>k.key)::numeric), 2) as v
      from eval_scores s, jsonb_object_keys(s.scores) k(key)
      where s.participant_id = p_participant and s.submitted_at is not null
      group by k.key
    loop
      avg_scores := avg_scores || jsonb_build_object(it.key, it.v);
    end loop;
    p_scores := avg_scores;
  end if;
  tot := eval_total(p.criteria, p_scores);
  if c.kind = 'attest' then
    res := round(0.25 * p.self_total + 0.75 * tot, 2);
  else
    res := null;
  end if;
  update eval_participants set final_scores = p_scores, final_total = tot, status = 'scored', finalized_at = now(),
    result = res, grade = case when c.kind = 'attest' then eval_grade(c.scale, res) else null end
    where id = p_participant;
  return tot;
end $$;
grant execute on function public.eval_finalize(uuid, jsonb) to authenticated;

create or replace function public.eval_reopen(p_participant uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from eval_participants where id = p_participant for update;
  if p is null or p.status <> 'scored' then raise exception 'Връща се само утвърдена, още неизпратена оценка'; end if;
  if not (eval_can_lead(p.campaign_id) or (p.evaluator = 'director' and eval_is_director())) then raise exception 'Нямате права'; end if;
  update eval_participants set status = 'pending', final_scores = null, final_total = null, finalized_at = null,
    result = null, grade = null where id = p_participant;
end $$;
grant execute on function public.eval_reopen(uuid) to authenticated;

-- Решение по възражение — ДТВ и други карти (при атестирането решава работодателят: eval_employer)
create or replace function public.eval_decide(p_participant uuid, p_decision text, p_scores jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare p record; tot numeric;
begin
  select * into p from eval_participants where id = p_participant for update;
  if p is null or p.status <> 'objected' then raise exception 'Няма възражение за решаване'; end if;
  if exists (select 1 from eval_campaigns c where c.id = p.campaign_id and c.kind = 'attest') then
    raise exception 'При атестирането по възражението решава работодателят';
  end if;
  if not (eval_can_lead(p.campaign_id) or (p.evaluator = 'director' and eval_is_director())) then raise exception 'Нямате права'; end if;
  if coalesce(trim(p_decision), '') = '' then raise exception 'Напишете решението'; end if;
  if p_scores is not null then
    tot := eval_total(p.criteria, p_scores);
    update eval_participants set final_scores = p_scores, final_total = tot, decision_changed = true where id = p_participant;
  end if;
  update eval_participants set decision = trim(p_decision), decided_at = now(), status = 'resolved',
    decision_changed = coalesce(decision_changed, false) where id = p_participant;
end $$;
grant execute on function public.eval_decide(uuid, text, jsonb) to authenticated;

-- Коментар на работодателя (атестиране): потвърждава оценката; при възражение — потвърждава или променя с една степен
create or replace function public.eval_employer(p_participant uuid, p_grade text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare p record; c record; a int; b int;
begin
  if not eval_is_director() then raise exception 'Коментарът на работодателя се вписва от директора'; end if;
  select * into p from eval_participants where id = p_participant for update;
  if p is null then raise exception 'Няма такова лице'; end if;
  select * into c from eval_campaigns where id = p.campaign_id;
  if c.kind <> 'attest' then raise exception 'Само при атестиране'; end if;
  if p.status not in ('acked', 'objected') then raise exception 'Атестираният още не се е запознал с оценката на комисията'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Напишете мотивите'; end if;
  a := eval_grade_index(c.scale, p.grade);
  b := eval_grade_index(c.scale, p_grade);
  if b is null then raise exception 'Непозната степен: %', p_grade; end if;
  if p.status = 'acked' and a <> b then raise exception 'Без възражение работодателят потвърждава оценката на комисията'; end if;
  if abs(a - b) > 1 then raise exception 'Крайната оценка може да се промени само с една степен'; end if;
  update eval_participants set employer_grade = p_grade, employer_note = trim(p_note), employer_at = now(),
    decision = case when p.status = 'objected' then trim(p_note) else decision end,
    decided_at = case when p.status = 'objected' then now() else decided_at end,
    decision_changed = case when p.status = 'objected' then a <> b else decision_changed end,
    status = case when p.status = 'objected' then 'resolved' else status end
    where id = p_participant;
end $$;
grant execute on function public.eval_employer(uuid, text, text) to authenticated;

-- ── Доказателства от ЕИС за периода ───────────────────────────────────────
-- Брой записи в таблица за служителя и периода (ако таблицата я няма — null)
create or replace function public.eval_count(p_table text, p_staff_col text, p_date_col text, p_staff uuid, p_from date, p_to date, p_extra text default null)
returns int language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  if to_regclass('public.' || p_table) is null then return null; end if;
  execute format('select count(*) from public.%I where %I = $1 and (%s)::date between $2 and $3%s',
                 p_table, p_staff_col, p_date_col, coalesce(' and ' || p_extra, ''))
    into n using p_staff, p_from, p_to;
  return n;
exception when others then
  return null;
end $$;
revoke execute on function public.eval_count(text, text, text, uuid, date, date, text) from public, anon, authenticated;

create or replace function public.eval_evidence(p_participant uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p record; c record; y record; d1 date; d2 date; checks jsonb; recs jsonb; counts jsonb;
begin
  select * into p from eval_participants where id = p_participant;
  if p is null then raise exception 'Няма такова лице'; end if;
  if not (eval_can_see_campaign(p.campaign_id) or p.staff_id = get_my_staff_id()) then raise exception 'Нямате права'; end if;
  select * into c from eval_campaigns where id = p.campaign_id;
  select * into y from academic_years where id = c.academic_year_id;
  d1 := coalesce(c.period_from, y.start_date, (now() - interval '1 year')::date);
  d2 := coalesce(c.period_to, y.end_date, now()::date);

  checks := '[]';
  recs := '[]';
  if to_regclass('public.control_checks') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', k.id, 'date', k.check_date, 'book_no', k.book_no, 'subject', k.subject, 'form', k.form, 'kind', k.kind,
        'inspector', (select s.first_name || ' ' || s.last_name from staff_profiles s where s.id = k.inspector_id),
        'strengths', k.strengths, 'conclusions', k.conclusions, 'objection', cs.objection) order by k.check_date), '[]')
      into checks
      from control_check_staff cs join control_checks k on k.id = cs.check_id
     where cs.staff_id = p.staff_id and k.status = 'signed' and k.check_date between d1 and d2;
    select coalesce(jsonb_agg(jsonb_build_object('text', r.text, 'due', r.due_date, 'status', r.status, 'report', r.report) order by r.due_date), '[]')
      into recs
      from control_recommendations r join control_checks k on k.id = r.check_id
     where r.responsible_id = p.staff_id and k.status = 'signed' and k.check_date between d1 and d2;
  end if;

  counts := jsonb_build_array(
    jsonb_build_object('k', 'portfolio', 'l', 'Публикации в „Портфолио“', 'n', eval_count('portfolio_posts', 'author_id', 'coalesce(event_date, created_at::date)', p.staff_id, d1, d2)),
    jsonb_build_object('k', 'site', 'l', '…от тях публикувани на сайта', 'n', eval_count('portfolio_posts', 'author_id', 'coalesce(event_date, created_at::date)', p.staff_id, d1, d2, 'site_published_at is not null')),
    jsonb_build_object('k', 'materials', 'l', 'Споделени материали', 'n', eval_count('materials', 'uploaded_by', 'created_at', p.staff_id, d1, d2)),
    jsonb_build_object('k', 'room', 'l', 'Публикации в класната стая', 'n', eval_count('class_room_posts', 'author_id', 'created_at', p.staff_id, d1, d2)),
    jsonb_build_object('k', 'dtt', 'l', 'Сесии ABA (DTT)', 'n', eval_count('dtt_sessions', 'staff_id', 'held_on', p.staff_id, d1, d2)),
    jsonb_build_object('k', 'pecs', 'l', 'Сесии PECS', 'n', eval_count('pecs_sessions', 'staff_id', 'held_on', p.staff_id, d1, d2)),
    jsonb_build_object('k', 'remelka', 'l', 'Сесии „Ремелка“', 'n', eval_count('remelka_sessions', 'staff_id', 'held_on', p.staff_id, d1, d2)),
    jsonb_build_object('k', 'abc', 'l', 'ABC записи за поведение', 'n', eval_count('abc_records', 'staff_id', 'occurred_on', p.staff_id, d1, d2)),
    jsonb_build_object('k', 'dev', 'l', 'Оценки на развитието', 'n', eval_count('dev_assessments', 'assessor_id', 'assessed_on', p.staff_id, d1, d2)),
    jsonb_build_object('k', 'motor', 'l', 'Двигателни оценки', 'n', eval_count('motor_sessions', 'assessor_id', 'assessed_on', p.staff_id, d1, d2)),
    jsonb_build_object('k', 'incidents', 'l', 'Подадени сигнали за инциденти', 'n', eval_count('incident_cases', 'reported_by', 'occurred_on', p.staff_id, d1, d2))
  );
  return jsonb_build_object('from', d1, 'to', d2, 'checks', checks, 'recs', recs, 'counts', counts);
end $$;
grant execute on function public.eval_evidence(uuid) to authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.eval_external enable row level security;
alter table public.eval_files enable row level security;
alter table public.eval_support enable row level security;
alter table public.eval_attest_history enable row level security;

drop policy if exists "eval_participants_read" on public.eval_participants;
create policy "eval_participants_read" on public.eval_participants for select to authenticated
  using (eval_can_see_campaign(campaign_id)
    or (staff_id = get_my_staff_id() and (sent_at is not null or eval_self_stage(campaign_id))));

drop policy if exists "eval_external_read" on public.eval_external;
create policy "eval_external_read" on public.eval_external for select to authenticated
  using (eval_can_see_campaign(campaign_id) or eval_has_card(campaign_id));
drop policy if exists "eval_external_write" on public.eval_external;
create policy "eval_external_write" on public.eval_external for all to authenticated
  using (eval_is_manager()) with check (eval_is_manager());

-- оценките: своите (членовете) и на външните членове (председател/организатор/секретар)
drop policy if exists "eval_scores_read" on public.eval_scores;
create policy "eval_scores_read" on public.eval_scores for select to authenticated
  using ((member_id is not null and member_id = get_my_staff_id())
    or eval_can_lead(eval_campaign_of(participant_id))
    or eval_is_secretary(eval_campaign_of(participant_id))
    or eval_submitted_mine(participant_id));
drop policy if exists "eval_scores_insert" on public.eval_scores;
create policy "eval_scores_insert" on public.eval_scores for insert to authenticated
  with check ((ext_id is null and member_id = get_my_staff_id() and eval_can_score(participant_id))
    or (member_id is null and ext_id is not null and eval_can_enter_ext(participant_id)));
drop policy if exists "eval_scores_update" on public.eval_scores;
create policy "eval_scores_update" on public.eval_scores for update to authenticated
  using ((ext_id is null and member_id = get_my_staff_id() and eval_can_score(participant_id))
    or (member_id is null and ext_id is not null and eval_can_enter_ext(participant_id)))
  with check ((ext_id is null and member_id = get_my_staff_id() and eval_can_score(participant_id))
    or (member_id is null and ext_id is not null and eval_can_enter_ext(participant_id)));
drop policy if exists "eval_scores_delete" on public.eval_scores;
create policy "eval_scores_delete" on public.eval_scores for delete to authenticated
  using ((ext_id is null and member_id = get_my_staff_id() and eval_can_score(participant_id))
    or (member_id is null and ext_id is not null and eval_can_enter_ext(participant_id)));

-- файловете: вижда ги, който вижда кампанията, и самото лице; качва и трие лицето (докато оценката не е
-- утвърдена) или председателят/организаторът/секретарят
create or replace function public.eval_can_upload(p_participant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from eval_participants p where p.id = p_participant and (
      eval_can_lead(p.campaign_id) or eval_is_secretary(p.campaign_id)
      or (p.staff_id = get_my_staff_id() and p.status = 'pending' and eval_self_stage(p.campaign_id))))
$$;
drop policy if exists "eval_files_read" on public.eval_files;
create policy "eval_files_read" on public.eval_files for select to authenticated
  using (eval_can_see_campaign(eval_campaign_of(participant_id)) or eval_is_mine(participant_id));
drop policy if exists "eval_files_insert" on public.eval_files;
create policy "eval_files_insert" on public.eval_files for insert to authenticated
  with check (eval_can_upload(participant_id) and uploaded_by = get_my_staff_id());
drop policy if exists "eval_files_delete" on public.eval_files;
create policy "eval_files_delete" on public.eval_files for delete to authenticated
  using (eval_can_upload(participant_id));

-- планът за подкрепа: вижда го, който вижда кампанията, лицето и наставникът; пише председателят/организаторът
drop policy if exists "eval_support_read" on public.eval_support;
create policy "eval_support_read" on public.eval_support for select to authenticated
  using (eval_can_see_campaign(eval_campaign_of(participant_id)) or eval_is_mine(participant_id) or mentor_id = get_my_staff_id());
drop policy if exists "eval_support_write" on public.eval_support;
create policy "eval_support_write" on public.eval_support for all to authenticated
  using (eval_can_lead(eval_campaign_of(participant_id))) with check (eval_can_lead(eval_campaign_of(participant_id)));

drop policy if exists "eval_attest_history_read" on public.eval_attest_history;
create policy "eval_attest_history_read" on public.eval_attest_history for select to authenticated
  using (eval_is_manager() or staff_id = get_my_staff_id());
drop policy if exists "eval_attest_history_write" on public.eval_attest_history;
create policy "eval_attest_history_write" on public.eval_attest_history for all to authenticated
  using (eval_is_manager()) with check (eval_is_manager());

-- Хранилище: портфолио на лицето „<campaign_id>/p/<participant_id>/<файл>“
drop policy if exists "evaluation_portfolio_read" on storage.objects;
create policy "evaluation_portfolio_read" on storage.objects for select to authenticated
  using (bucket_id = 'evaluation' and (storage.foldername(name))[2] = 'p'
    and exists (select 1 from eval_participants p where p.id::text = (storage.foldername(name))[3] and eval_is_mine(p.id)));
drop policy if exists "evaluation_portfolio_insert" on storage.objects;
create policy "evaluation_portfolio_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'evaluation' and (storage.foldername(name))[2] = 'p'
    and exists (select 1 from eval_participants p where p.id::text = (storage.foldername(name))[3]
                and p.campaign_id::text = (storage.foldername(name))[1] and eval_can_upload(p.id)));
drop policy if exists "evaluation_portfolio_delete" on storage.objects;
create policy "evaluation_portfolio_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'evaluation' and (storage.foldername(name))[2] = 'p'
    and exists (select 1 from eval_participants p where p.id::text = (storage.foldername(name))[3] and eval_can_upload(p.id)));
-- секретарят вижда файловете на кампанията
drop policy if exists "evaluation_secretary_read" on storage.objects;
create policy "evaluation_secretary_read" on storage.objects for select to authenticated
  using (bucket_id = 'evaluation' and exists (select 1 from eval_campaigns c
    where c.id::text = (storage.foldername(name))[1] and eval_is_secretary(c.id)));

-- ── Карта за атестиране на учител (Приложение № 20 към чл. 82, ал. 1, т. 1 от Наредба № 15/2019) ──
-- Критериите в раздел IV са определени от директора (по образеца на ЦСОП – Варна) — променят се от „Карти“.
insert into public.eval_templates (code, kind, grp, name, title, adopted, col_label, roles, criteria, base, total, guide, sort) values
('attest_teacher', 'attest', 'ped', 'Атестиране — учител (Прил. № 20)', 'АТЕСТАЦИОННА КАРТА НА УЧИТЕЛ',
 'Приложение № 20 към чл. 82, ал. 1, т. 1', 'Б. Области на компетентност и критерии по тях', '{class_teacher,teacher,educator}',
 '[{"n": "I.1", "h": "I. Педагогически компетентности: планиране, преподаване, оценяване и управление на класа/групата", "g": "Планиране", "max": 6, "items": [{"k": "I.1.1", "t": "Разпределя ритмично учебното съдържание, като предвижда възможности за преструктуриране и го съобразява с интересите на децата/учениците и образователната среда.", "max": 2}, {"k": "I.1.2", "t": "Планира дейности за обща и/или допълнителна подкрепа за личностното развитие на децата/учениците.", "max": 2}, {"k": "I.1.3", "t": "Планира иновативни методи за преподаване/диагностика и за оценяване на резултатите на децата/учениците. Прилага компетентностния подход в работата си при придобиване на ключови компетентности от децата/учениците съгласно чл. 77, ал. 1 от ЗПУО.", "max": 2}]}, {"n": "I.2", "h": "I. Педагогически компетентности: планиране, преподаване, оценяване и управление на класа/групата", "g": "Организиране и управление на образователния процес: стратегии и методи на преподаване", "max": 8, "items": [{"k": "I.2.1", "t": "Наблюдава и контролира дейностите в класа или групата, поддържа позитивна работна атмосфера, с цел постигане на планираните резултати. Създава позитивна работна атмосфера с цел постигане на планираните резултати.", "max": 2}, {"k": "I.2.2", "t": "Управлява динамиката на урока или педагогическата ситуация, като използва възможностите на индивидуалната и екипната работа, на междупредметните и вътрешнопредметните връзки и интерактивните методи на обучение. Управлява динамиката на урока, като използва възможностите на индивидуалната и на екипната работа.", "max": 2}, {"k": "I.2.3", "t": "Избира подходящи дидактически материали, включително създадени от него.", "max": 2}, {"k": "I.2.4", "t": "Спазва и контролира спазването на книжовноезиковите норми на българския език.", "max": 2}]}, {"n": "I.3", "h": "I. Педагогически компетентности: планиране, преподаване, оценяване и управление на класа/групата", "g": "Оценяване напредъка на деца/ученици, ориентираност към резултати", "max": 6, "items": [{"k": "I.3.1", "t": "Използва подходящи средства за диагностика или проверка и оценка на постигнатите от децата/учениците резултати и запознава родителите с тях.", "max": 2}, {"k": "I.3.2", "t": "Анализира нивото на усвоените компетентности от страна на децата/учениците при вътрешно и външно оценяване и осигурява необходимата подкрепа за личностно развитие.", "max": 2}, {"k": "I.3.3", "t": "Осигурява информация за индивидуалното развитие и за постигнатите резултати, предлага мерки за подобряването им и информира родителите.", "max": 2}]}, {"n": "I.4", "h": "I. Педагогически компетентности: планиране, преподаване, оценяване и управление на класа/групата", "g": "Управление на групата/класа", "max": 4, "items": [{"k": "I.4.1", "t": "Ръководи децата/учениците и споделя отговорността за тях в съответствие с етичния кодекс на общността.", "max": 2}, {"k": "I.4.2", "t": "Възпитава и формира гражданска позиция: окуражава позитивните прояви, взаимната подкрепа и стремежа към общ краен резултат.", "max": 2}]}, {"n": "II", "g": "II. Социална и гражданска компетентност: работа с участниците в образователния процес и със заинтересовани страни, участие във формирането на образователни политики и изпълнението на дейностите за реализирането им", "max": 10, "items": [{"k": "II.1", "t": "Участва в разработването и/или изпълнението на стратегията за развитие на институцията.", "max": 2}, {"k": "II.2.1", "t": "Има ефективна педагогическа комуникация с оглед положително въздействие върху децата/учениците, като: Активно участва в работата на педагогическия съвет.", "max": 2}, {"k": "II.2.2", "t": "Активно участва в организирането и провеждането на олимпиади, състезания, конкурси, концерти, занимания по интереси или на допълнителните форми на педагогическо взаимодействие в предучилищното образование.", "max": 2}, {"k": "II.2.3", "t": "Активно взаимодейства с родителите. Участва в дейности на национални, областни, общински комисии, свързани с разработване и изпълнение на основни образователни политики или проекти.", "max": 2}, {"k": "II.3", "t": "Подпомага методически и организационно млади, новоназначени и други учители/възпитатели и/или изпълнява наставнически функции по отношение на стажант-учители.", "max": 2}]}, {"n": "III", "g": "III. Други професионални изисквания за изпълнение на длъжността", "max": 6, "items": [{"k": "III.1", "t": "Оценява професионалното си развитие, както и необходимостта от повишаване на квалификацията си по теми, свързани с приоритетите и развитието на институцията, и има задължителните квалификационни кредити.", "max": 2}, {"k": "III.2", "t": "Професионално изпълнява задълженията си съгласно длъжностната характеристика, участва във форми на вътрешноинституционалната квалификация, прилага и представя иновативни педагогически практики.", "max": 2}, {"k": "III.3", "t": "Познава и прилага нормативната уредба за системата на предучилищното и училищното образование, включително и документацията на институцията.", "max": 2}]}, {"n": "IV", "g": "IV. Критерии, определени от директора на институцията", "max": 10, "items": [{"k": "IV.1", "t": "Прилага информационните и комуникационните технологии в работата си, мотивира децата за използването им. Подготвя електронни материали и/или уроци.", "max": 2}, {"k": "IV.2", "t": "Създава и поддържа конструктивни професионални взаимоотношения с други педагогически специалисти за изграждане на позитивен организационен климат, утвърждаване на позитивна дисциплина и развитие на общността.", "max": 2}, {"k": "IV.3", "t": "Изпълнява точно, прецизно, коректно и в срок задачи, поставени от директора. Спазва утвърдените от директора правилници, планове, работни графици и други вътрешни за институцията документи.", "max": 2}, {"k": "IV.4", "t": "Осигурява подкрепяща, безопасна, естетическа и позитивна образователна среда, насочена към задоволяване на индивидуалните потребности на децата за повишаване на резултатите от учебно-възпитателната работа. Познава и използва различни техники и стратегии за управление на поведението на децата/учениците. Насърчава самоконтрола, самостоятелността и съвместната им работа чрез развиването на техните социални, емоционални и поведенчески умения.", "max": 2}, {"k": "IV.5", "t": "Идентифицира собствените си потребности от продължаваща квалификация; определя и постига цели, ориентирани към непрекъснато професионално развитие. Познава и спазва законно установените норми, които имат отношение към професионалните прояви, задължения и трудовото му правоотношение.", "max": 2}]}]', null, 50,
 'Скала за определяне на достигнатата степен на изпълнение на критериите по областите на професионална компетентност
Педагогически компетентности: планиране, преподаване, оценяване и управление на групата/класа
1,0 точка: Професионалните знания и умения имат необходимост от подобрение, съответстващо на длъжността. Не планира и не провежда ефективно работата си в учебния час и/или педагогическата ситуация. Непоследователност при планиране на задачите и структуриране на информацията. Несъобразяване на поставените цели със знанията и уменията на децата/учениците и затруднения в постигането на резултатите от учебната програма. Трудности при диференцирането на задачите за индивидуална и групова работа. Затруднения при използването на интерактивни методи на обучение и информационните и комуникационните технологии. Формално и немотивирано оценяване. Необходимост от допълнителни инструкции относно задълженията. Необходимост от допълнителна квалификация и наставничество.
1,5 точки: Професионалните знания и умения дават възможност за самостоятелно планиране и провеждане на учебните часове/педагогическите ситуации, часовете за самоподготовка и заниманията по интереси. Планира работа си и ориентира дейността си към постигане на очакваните резултати. Осигурява подкрепа и при възможност надгражда знанията, уменията и отношенията на децата/учениците. Планира и използва оценяването/диагностицирането за проследяване на напредъка и установяване на областите с нужда от подкрепа. Търси подкрепа по отношение на използването на средства, методи и подходи при затруднения. Работи индивидуално и групово с децата/учениците и формулира изисквания към всеки. Използва рационално образователната среда за реализирането на целите на отделните етапи на педагогическата ситуация/урока. Прилага иновации и интерактивни методи на обучение. Търси възможности за допълнителна квалификация.
2,0 точки: Задълбочено познава естеството на извършваната работа. Следи новостите в своята професионална област. Успешно планира и организира работата си в рамките на основните и допълнителните форми на педагогическо взаимодействие, на учебния час, на самоподготовка, в занимания по интереси и на работния ден. Постига очакваните резултати. Разпределя правилно времето си за изпълнение на задачите. Оценява/диагностицира, за да установи и измери постигнат резултат, дава обратна връзка и препоръки за подобрение. Има индивидуален подход. Справя се с проблемни ситуации в работата с деца със СОП, с обучителни трудности, от уязвими общности и др., както и за насърчаване на деца и ученици с изявени дарби. Ефективно прилага иновативни и интерактивни методи на обучение, ориентирани към напредъка на всяко дете/ученик съобразно и индивидуалните потребности. Мотивира децата/учениците за работа в екип. Оказва методическа и организационна подкрепа.
Социална и гражданска компетентност: работа в екип, работа със заинтересовани страни (родители, социални партньори, бизнес и др.), участие във формирането на образователни политики и изпълнението на дейностите по реализирането им на ниво институция
1,0 точка: Трудно работи с колегите; не взаимодейства и не сътрудничи, ако обстоятелствата не го налагат. Има проблеми при работа в екип и при приемане на чуждото мнение. Има трудности при справянето с конфликтни ситуации и вземането на решения. Пасивен, работи само върху изрично поставени задачи. Рядко се включва в разрешаването на проблеми, свързани със собствената работа. Няма компетентност и нагласа да помага на колегите си. Среща затруднения при работа с родителите. Не дава обратна връзка, но търси сътрудничество и подкрепа. Дейността му не съответства на стратегията на институцията. Не се включва в работа по проекти. Необходима е допълнителна квалификация и наставничество за методическа или организационна подкрепа.
1,5 точки: Поддържа коректни взаимоотношения и взаимодейства с колегите си. Приема предложения от страна на колегите си. С родителите общува при възникнал проблем, слаб резултат и на родителските срещи. Изпълнява отговорностите си при работа по проект. Не проявява самоинициатива. Не предлага решения. Включва се в подкрепа на по-млади колеги. Необходима е допълнителна квалификация.
2,0 точки: Ефективно сътрудничи с колеги, с родители и със заинтересовани страни с цел пълноценно развитие и подкрепа на всяко дете или ученик. Предлага решения и търси подкрепа за подобряване на резултатите на децата/учениците. Организира и провежда събития. Насърчава колегите си и родителите да дискутират, обменят идеи и да работят съвместно за разрешаването на проблеми, свързани с децата и учениците. Активен е, дава предложения и влага усилия за подобряване процеса на работа, ангажира се с изпълнението на допълнителни задачи. Оказва методическа и организационна подкрепа и наставничество на по-млади, неопитни или новоназначени колеги.
Други професионални изисквания
1,0 точка: Познава длъжностната си характеристика. Спазва седмичното разписание. Има затруднения в изпълнението, координирането и контролирането на всички планирани задачи и дейности. Има затруднения в организирането и управлението на основните и допълнителните форми на педагогическо взаимодействие, на учебния час, на самоподготовката или заниманията по интереси. В екипната работа допуска закъснение, неточност, разсеяност. Не обвързва квалификацията с възможностите за развитие и няма желание за професионално усъвършенстване и развитие. За атестационния период има придобит един квалификационен кредит и по-малко от половината от задължителния брой часове участие във вътрешноинституционалната квалификация за всяка от годините в периода на атестиране. Не използва ресурсите на средата, с които институцията разполага. Необходима е допълнителна квалификация и наставничество. Необходима е методическа или организационна подкрепа.
Не познава основните нормативни документи, които регулират системата на предучилищното и училищното образование. Слабо познава държавните образователни стандарти, които имат отношение към пряката му работа. Има затруднение в работата с документите на институцията. Не участва в работата по разработването и актуализирането на учебната документация. Необходимо е наставничество и методическа или организационна подкрепа.
1,5 точки: Изпълнява своите задължения. Спазва седмичното разписание, продължителността на учебния час, на самоподготовка или на друга форма на извънкласна и/или извънучилищна дейност. Среща трудности при справянето с възникнали проблеми и задачи. Отнася се отговорно към работата, но понякога е необходима подкрепа и контрол по отношение на сроковете. Проявява умерена мотивация и старание относно участията в допълнителни обучения. За атестационния период не е достигнал задължителния брой квалификационни кредити. Няма задължителния брой академични часове годишно участие във вътрешноинституционалната квалификация. Има положително отношение към предложения за промяна и обогатяване на опита. Рационално използва ресурсите на институцията, търси и предлага допълнителни. Разбира и следва образователните цели на институцията. Препоръчва се допълнителна квалификация. Познава основните нормативни документи, които регулират системата на предучилищното и училищното образование.
Познава държавните образователни стандарти. Няма трудности в работата с документите на институцията. Участва в работни групи за разработването и актуализирането на учебната документация. Няма самостоятелна инициатива. В срок оформя документите, с които работи.
2,0 точки: Ефективно изпълнява отговорностите си. В срок и качествено изпълнява възложените задачи. Спазва вътрешните правила и инструкциите за работа. При необходимост довършва или изпълнява спешни задачи. Показва високо качество на работа, прецизност и точност при изпълнение на задачите. Постига целите в определеното време. Преодолява възникнали трудности и информира за крайния резултат. Постоянно разширява знанията си както чрез самоподготовка, така и чрез включване в организирани обучения. Има задължителните за атестационния период брой квалификационни кредити и задължителния брой академични часове за участие във вътрешноинституционалната квалификация за всяка от годините в периода на атестиране. Споделя усвоените нови знания и ги прилага на практика. Ефективно използва ресурсите на институцията, обогатява ги, търси и предлага допълнителни възможности за подобряване. При необходимост се отзовава за довършване на спешни задачи. Разбира и изпълнява образователната политика на институцията, като изяснява на колегите си и ги подпомага за реализиране на поставените цели. Оказва методическа и организационна подкрепа и наставничество. Познава и ефективно прилага нормативни документи, които регулират системата на предучилищното и училищното образование. Познава и прилага държавните образователни стандарти. Отговорно и в срок изпълнява задълженията си по водене, съхраняване и отчитане на документите на институцията, с които работи. Участва в работни групи за разработването и актуализирането на правилници, правила, планове и други и предлага решения за подобряване на работата. Оказва методическа и организационна подкрепа и наставничество.', 40)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
