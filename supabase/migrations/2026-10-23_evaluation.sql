-- Оценяване на персонала — етап 1: ДТВ за постигнати резултати от труда (карти, комисия, суми, документи).
-- Основания: Наредба № 4/2017 за нормирането и заплащането на труда; КТД; Вътрешни правила за ДТВ на ЦСОП – Варна
-- (педагогически — ПС, прот. 8/09.09.2026; непедагогически — ОС, прот. 4/09.09.2026); ПВТР чл. 87–93.
-- Ред: една комисия (брой и състав — с решение на ПС) оценява всички, освен заместник-директорите и членовете на
-- комисията — тях оценява директорът. Картата се дава на лицето до 3 дни, възражение до 3 работни дни от запознаването,
-- заповед за размерите до 30 октомври. Сумите — пропорционално на точките, отделно за педагогическия и непедагогическия
-- персонал; фондовете и отработените дни въвежда счетоводителят. Безопасно за повторно пускане.

-- Достъп: „manager“ — организира кампаниите (освен директора, ЗДУД и администраторите);
-- „finance“ — вижда и въвежда фондовете, отработените дни и сумите (освен директора). Определя директорът.
create table if not exists public.eval_access (
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  kind text not null check (kind in ('manager', 'finance')),
  added_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (staff_id, kind)
);

create or replace function public.eval_is_director() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text = 'director'
$$;
create or replace function public.eval_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('director', 'zdud', 'admin')
    or exists (select 1 from eval_access a where a.staff_id = get_my_staff_id() and a.kind = 'manager')
$$;
create or replace function public.eval_is_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text = 'director'
    or exists (select 1 from eval_access a where a.staff_id = get_my_staff_id() and a.kind = 'finance')
$$;

-- Карти (шаблони). criteria: [{ "n": "1", "g": "Показател", "max": 14, "items": [{ "k": "1.1", "t": "Критерий", "max": 4 }] }]
-- base — точките при приемането на картата (корекцията е до 20% на показател, общо 100).
create table if not exists public.eval_templates (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  kind text not null default 'dtv' check (kind in ('dtv', 'attest', 'other')),
  grp text not null default 'ped' check (grp in ('ped', 'nonped')),
  name text not null,
  title text not null default '',               -- „ЗА ОПРЕДЕЛЯНЕ НА ДОПЪЛНИТЕЛНО ТРУДОВО ВЪЗНАГРАЖДЕНИЕ …“
  adopted text,                                 -- „Приета с решение на …, Протокол № … от …“
  col_label text not null default 'Показатели и критерии',
  roles text[] not null default '{}',           -- за кои роли се предлага по подразбиране
  criteria jsonb not null default '[]',
  base jsonb,
  total numeric not null default 100,
  is_active boolean not null default true,
  sort int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eval_campaigns (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'dtv' check (kind in ('dtv', 'attest', 'other')),
  name text not null,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  status text not null default 'setup' check (status in ('setup', 'scoring', 'closed')),
  aggregate text not null default 'avg' check (aggregate in ('avg', 'joint')),   -- средно от членовете или обща оценка
  card_days int not null default 3,             -- картата се дава на лицето до … дни от подписването
  objection_days int not null default 3,        -- възражение до … работни дни от запознаването
  min_days_ped int not null default 124,
  min_days_nonped int not null default 152,
  sick_tolerance int not null default 5,        -- до … работни дни недостиг по здравословни причини (ОС 4/10.09.2024)
  score_by date,                                -- оценяване до (1 октомври)
  order_by date,                                -- заповед до (30 октомври)
  basis text,                                   -- решение на ПС / ОС за комисията
  protocol_no text,
  protocol_date date,
  scan_path text,                               -- подписаният протокол на комисията
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.eval_commission (
  campaign_id uuid not null references public.eval_campaigns(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('chair', 'member')),
  sort int not null default 0,
  primary key (campaign_id, staff_id)
);

create table if not exists public.eval_participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.eval_campaigns(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  template_id uuid references public.eval_templates(id) on delete set null,
  grp text not null default 'ped' check (grp in ('ped', 'nonped')),
  position text,                                -- длъжността към момента
  evaluator text not null default 'commission' check (evaluator in ('commission', 'director')),
  criteria jsonb,                               -- копие на картата към началото на оценяването
  status text not null default 'pending' check (status in ('pending', 'scored', 'sent', 'acked', 'objected', 'resolved')),
  final_scores jsonb,                           -- { "1.1": 4, … }
  final_total numeric,
  finalized_at timestamptz,
  sent_at timestamptz,
  acked_at timestamptz,
  objection text,
  objection_at timestamptz,
  decision text,
  decision_changed boolean,
  decided_at timestamptz,
  scan_path text,                               -- подписаната карта
  note text,
  created_at timestamptz not null default now(),
  unique (campaign_id, staff_id)
);
create index if not exists eval_participants_staff_idx on public.eval_participants (staff_id);

-- Оценката на всеки член на комисията поотделно
create table if not exists public.eval_scores (
  participant_id uuid not null references public.eval_participants(id) on delete cascade,
  member_id uuid not null references public.staff_profiles(id) on delete cascade,
  scores jsonb not null default '{}',
  total numeric not null default 0,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (participant_id, member_id)
);

-- Сумите: фонд по група и отработени дни — само директорът и счетоводителят
create table if not exists public.eval_funds (
  campaign_id uuid not null references public.eval_campaigns(id) on delete cascade,
  grp text not null check (grp in ('ped', 'nonped')),
  amount numeric not null default 0,
  primary key (campaign_id, grp)
);
create table if not exists public.eval_pay (
  participant_id uuid primary key references public.eval_participants(id) on delete cascade,
  worked_days int,
  sick_days int,                                -- от недостига — дни по здравословни причини
  override text check (override in ('yes', 'no')),
  note text,
  updated_at timestamptz not null default now()
);

-- Помощни
create or replace function public.eval_on_commission(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eval_commission c where c.campaign_id = p_campaign and c.staff_id = get_my_staff_id())
$$;
create or replace function public.eval_is_chair(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eval_commission c where c.campaign_id = p_campaign and c.staff_id = get_my_staff_id() and c.role = 'chair')
$$;
create or replace function public.eval_can_see_campaign(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eval_is_manager() or eval_is_finance() or eval_on_commission(p_campaign)
$$;
-- Води ли кампанията (организатор, председател или директор)
create or replace function public.eval_can_lead(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eval_is_manager() or eval_is_chair(p_campaign)
$$;
create or replace function public.eval_campaign_of(p_participant uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select campaign_id from eval_participants where id = p_participant
$$;
-- Може ли текущият служител да въвежда своята оценка за лицето
create or replace function public.eval_can_score(p_participant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from eval_participants p join eval_campaigns c on c.id = p.campaign_id
    join eval_commission m on m.campaign_id = c.id and m.staff_id = get_my_staff_id()
    where p.id = p_participant and c.status = 'scoring' and p.status = 'pending'
      and p.evaluator = 'commission' and p.staff_id <> get_my_staff_id())
$$;

-- Подал ли е текущият член своята оценка за лицето (тогава вижда и чуждите)
create or replace function public.eval_submitted_mine(p_participant uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eval_scores s where s.participant_id = p_participant
                 and s.member_id = get_my_staff_id() and s.submitted_at is not null)
$$;
-- Има ли текущият служител изпратена карта в кампанията
create or replace function public.eval_has_card(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eval_participants p where p.campaign_id = p_campaign
                 and p.staff_id = get_my_staff_id() and p.sent_at is not null)
$$;

-- Членовете на комисията се оценяват от директора
create or replace function public.eval_participants_evaluator() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from eval_commission c where c.campaign_id = new.campaign_id and c.staff_id = new.staff_id) then
    new.evaluator := 'director';
  end if;
  return new;
end $$;
drop trigger if exists eval_participants_evaluator on public.eval_participants;
create trigger eval_participants_evaluator before insert or update of staff_id, evaluator on public.eval_participants
  for each row execute function public.eval_participants_evaluator();

create or replace function public.eval_commission_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update eval_participants set evaluator = 'director'
    where campaign_id = new.campaign_id and staff_id = new.staff_id and evaluator <> 'director' and status = 'pending';
  return new;
end $$;
drop trigger if exists eval_commission_sync on public.eval_commission;
create trigger eval_commission_sync after insert on public.eval_commission
  for each row execute function public.eval_commission_sync();

-- Работни дни след дата (без събота и неделя)
create or replace function public.eval_add_workdays(p_from date, p_n int) returns date
language plpgsql immutable as $$
declare d date := p_from; k int := 0;
begin
  while k < p_n loop
    d := d + 1;
    if extract(isodow from d) < 6 then k := k + 1; end if;
  end loop;
  return d;
end $$;

-- Сумата на точките по картата и проверка на максимумите
create or replace function public.eval_total(p_criteria jsonb, p_scores jsonb) returns numeric
language plpgsql immutable as $$
declare g jsonb; it jsonb; v numeric; s numeric := 0;
begin
  for g in select * from jsonb_array_elements(coalesce(p_criteria, '[]')) loop
    for it in select * from jsonb_array_elements(coalesce(g->'items', '[]')) loop
      v := nullif(p_scores->>(it->>'k'), '')::numeric;
      if v is null then raise exception 'Не е оценен критерий %', it->>'k'; end if;
      if v < 0 or v > (it->>'max')::numeric then raise exception 'Критерий %: точките са между 0 и %', it->>'k', it->>'max'; end if;
      s := s + v;
    end loop;
  end loop;
  return s;
end $$;

-- Старт на оценяването: картите се копират към лицата (по-нататъшни промени в картите не ги засягат)
create or replace function public.eval_start(p_campaign uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from eval_campaigns where id = p_campaign for update;
  if c is null then raise exception 'Няма такава кампания'; end if;
  if not eval_can_lead(p_campaign) then raise exception 'Нямате права'; end if;
  if c.status <> 'setup' then raise exception 'Оценяването вече е започнало'; end if;
  if not exists (select 1 from eval_commission where campaign_id = p_campaign) then raise exception 'Посочете комисията'; end if;
  if not exists (select 1 from eval_commission where campaign_id = p_campaign and role = 'chair') then raise exception 'Посочете председател на комисията'; end if;
  if not exists (select 1 from eval_participants where campaign_id = p_campaign) then raise exception 'Добавете оценяваните'; end if;
  if exists (select 1 from eval_participants where campaign_id = p_campaign and template_id is null) then raise exception 'Има оценявани без избрана карта'; end if;
  update eval_participants p set criteria = t.criteria from eval_templates t where t.id = p.template_id and p.campaign_id = p_campaign;
  update eval_campaigns set status = 'scoring' where id = p_campaign;
end $$;
grant execute on function public.eval_start(uuid) to authenticated;

-- Утвърждаване на крайната оценка: средно от подадените оценки на членовете (p_scores = null)
-- или обща оценка / оценка на директора (p_scores)
create or replace function public.eval_finalize(p_participant uuid, p_scores jsonb default null) returns numeric
language plpgsql security definer set search_path = public as $$
declare p record; c record; it record; avg_scores jsonb := '{}'; n int; tot numeric;
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
  update eval_participants set final_scores = p_scores, final_total = tot, status = 'scored', finalized_at = now()
    where id = p_participant;
  return tot;
end $$;
grant execute on function public.eval_finalize(uuid, jsonb) to authenticated;

-- Връщане за преоценка (само преди картата да е дадена на лицето)
create or replace function public.eval_reopen(p_participant uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from eval_participants where id = p_participant for update;
  if p is null or p.status <> 'scored' then raise exception 'Връща се само утвърдена, още неизпратена оценка'; end if;
  if not (eval_can_lead(p.campaign_id) or (p.evaluator = 'director' and eval_is_director())) then raise exception 'Нямате права'; end if;
  update eval_participants set status = 'pending', final_scores = null, final_total = null, finalized_at = null where id = p_participant;
end $$;
grant execute on function public.eval_reopen(uuid) to authenticated;

-- Картите стават видими за лицата (запознаване и възражение)
create or replace function public.eval_send(p_campaign uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not eval_can_lead(p_campaign) then raise exception 'Нямате права'; end if;
  update eval_participants set status = 'sent', sent_at = now() where campaign_id = p_campaign and status = 'scored';
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.eval_send(uuid) to authenticated;

-- Лицето: „Запознат/а съм“ и по желание възражение (до … работни дни от запознаването)
create or replace function public.eval_ack(p_participant uuid, p_objection text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p record; c record; ack timestamptz;
begin
  select * into p from eval_participants where id = p_participant for update;
  if p is null or p.staff_id <> get_my_staff_id() then raise exception 'Картата не е ваша'; end if;
  if p.status not in ('sent', 'acked') then raise exception 'Картата не е за запознаване'; end if;
  select * into c from eval_campaigns where id = p.campaign_id;
  ack := coalesce(p.acked_at, now());
  if coalesce(trim(p_objection), '') <> '' then
    if (now() at time zone 'Europe/Sofia')::date > eval_add_workdays((ack at time zone 'Europe/Sofia')::date, c.objection_days) then
      raise exception 'Срокът за възражение (% работни дни от запознаването) е изтекъл', c.objection_days;
    end if;
    update eval_participants set acked_at = ack, objection = trim(p_objection), objection_at = now(), status = 'objected' where id = p_participant;
  else
    update eval_participants set acked_at = ack, status = 'acked' where id = p_participant;
  end if;
end $$;
grant execute on function public.eval_ack(uuid, text) to authenticated;

-- Решение по възражението (окончателно): оставя или променя точките
create or replace function public.eval_decide(p_participant uuid, p_decision text, p_scores jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare p record; tot numeric;
begin
  select * into p from eval_participants where id = p_participant for update;
  if p is null or p.status <> 'objected' then raise exception 'Няма възражение за решаване'; end if;
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

create or replace function public.eval_set_access(p_staff uuid, p_kind text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eval_is_director() then raise exception 'Само директорът определя достъпа'; end if;
  if p_on then
    insert into eval_access (staff_id, kind, added_by) values (p_staff, p_kind, get_my_staff_id()) on conflict do nothing;
  else
    delete from eval_access where staff_id = p_staff and kind = p_kind;
  end if;
end $$;
grant execute on function public.eval_set_access(uuid, text, boolean) to authenticated;

-- RLS
alter table public.eval_access enable row level security;
alter table public.eval_templates enable row level security;
alter table public.eval_campaigns enable row level security;
alter table public.eval_commission enable row level security;
alter table public.eval_participants enable row level security;
alter table public.eval_scores enable row level security;
alter table public.eval_funds enable row level security;
alter table public.eval_pay enable row level security;

drop policy if exists "eval_access_read" on public.eval_access;
create policy "eval_access_read" on public.eval_access for select to authenticated using (true);

drop policy if exists "eval_templates_read" on public.eval_templates;
create policy "eval_templates_read" on public.eval_templates for select to authenticated using (true);
drop policy if exists "eval_templates_write" on public.eval_templates;
create policy "eval_templates_write" on public.eval_templates for all to authenticated
  using (eval_is_manager()) with check (eval_is_manager());

-- кампанията: организаторите, счетоводителят, комисията; лицата — само ако имат изпратена карта
drop policy if exists "eval_campaigns_read" on public.eval_campaigns;
create policy "eval_campaigns_read" on public.eval_campaigns for select to authenticated
  using (eval_can_see_campaign(id) or eval_has_card(id));
drop policy if exists "eval_campaigns_insert" on public.eval_campaigns;
create policy "eval_campaigns_insert" on public.eval_campaigns for insert to authenticated with check (eval_is_manager());
drop policy if exists "eval_campaigns_update" on public.eval_campaigns;
create policy "eval_campaigns_update" on public.eval_campaigns for update to authenticated
  using (eval_can_lead(id)) with check (eval_can_lead(id));
drop policy if exists "eval_campaigns_delete" on public.eval_campaigns;
create policy "eval_campaigns_delete" on public.eval_campaigns for delete to authenticated using (eval_is_manager() and status = 'setup');

drop policy if exists "eval_commission_read" on public.eval_commission;
create policy "eval_commission_read" on public.eval_commission for select to authenticated
  using (eval_can_see_campaign(campaign_id) or eval_has_card(campaign_id));
drop policy if exists "eval_commission_write" on public.eval_commission;
create policy "eval_commission_write" on public.eval_commission for all to authenticated
  using (eval_is_manager()) with check (eval_is_manager());

-- лицата: организаторите, счетоводителят и комисията — всички; оценяваният — своята карта след изпращането
drop policy if exists "eval_participants_read" on public.eval_participants;
create policy "eval_participants_read" on public.eval_participants for select to authenticated
  using (eval_can_see_campaign(campaign_id) or (staff_id = get_my_staff_id() and sent_at is not null));
drop policy if exists "eval_participants_write" on public.eval_participants;
create policy "eval_participants_write" on public.eval_participants for all to authenticated
  using (eval_can_lead(campaign_id)) with check (eval_can_lead(campaign_id));

-- оценките на членовете: своята; чуждите — след като е подадена своята (или за организатора/председателя)
drop policy if exists "eval_scores_read" on public.eval_scores;
create policy "eval_scores_read" on public.eval_scores for select to authenticated
  using (member_id = get_my_staff_id()
    or eval_can_lead(eval_campaign_of(participant_id))
    or eval_submitted_mine(participant_id));
drop policy if exists "eval_scores_insert" on public.eval_scores;
create policy "eval_scores_insert" on public.eval_scores for insert to authenticated
  with check (member_id = get_my_staff_id() and eval_can_score(participant_id));
drop policy if exists "eval_scores_update" on public.eval_scores;
create policy "eval_scores_update" on public.eval_scores for update to authenticated
  using (member_id = get_my_staff_id() and eval_can_score(participant_id))
  with check (member_id = get_my_staff_id() and eval_can_score(participant_id));
drop policy if exists "eval_scores_delete" on public.eval_scores;
create policy "eval_scores_delete" on public.eval_scores for delete to authenticated
  using (member_id = get_my_staff_id() and eval_can_score(participant_id));

drop policy if exists "eval_funds_all" on public.eval_funds;
create policy "eval_funds_all" on public.eval_funds for all to authenticated using (eval_is_finance()) with check (eval_is_finance());
drop policy if exists "eval_pay_all" on public.eval_pay;
create policy "eval_pay_all" on public.eval_pay for all to authenticated using (eval_is_finance()) with check (eval_is_finance());

-- Сканираните подписани карти и протоколи: път „<campaign_id>/<файл>“
insert into storage.buckets (id, name, public) values ('evaluation', 'evaluation', false)
on conflict (id) do nothing;
drop policy if exists "evaluation_files_read" on storage.objects;
create policy "evaluation_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'evaluation' and (
    exists (select 1 from eval_campaigns c where c.id::text = (storage.foldername(name))[1] and eval_can_see_campaign(c.id))
    or exists (select 1 from eval_participants p where p.campaign_id::text = (storage.foldername(name))[1]
               and p.staff_id = get_my_staff_id() and p.scan_path = name)));
drop policy if exists "evaluation_files_insert" on storage.objects;
create policy "evaluation_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'evaluation' and exists (select 1 from eval_campaigns c
    where c.id::text = (storage.foldername(name))[1] and eval_can_lead(c.id)));
drop policy if exists "evaluation_files_delete" on storage.objects;
create policy "evaluation_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'evaluation' and exists (select 1 from eval_campaigns c
    where c.id::text = (storage.foldername(name))[1] and eval_can_lead(c.id)));

-- Начални карти за 2026/2027 (Общо събрание). Картата на педагогическите специалисти (Приложение № 4 с корекциите на ПС)
-- се въвежда от „Оценяване → Карти“.
insert into public.eval_templates (code, kind, grp, name, title, adopted, col_label, roles, criteria, base, sort) values
('dtv_therapists', 'dtv', 'nonped', 'ДТВ — непедагогически специалист – терапевт',
 'ЗА ОПРЕДЕЛЯНЕ НА ДОПЪЛНИТЕЛНО ТРУДОВО ВЪЗНАГРАЖДЕНИЕ ЗА ПОСТИГНАТИ РЕЗУЛТАТИ ОТ ТРУДА НА НЕПЕДАГОГИЧЕСКИ СПЕЦИАЛИСТ – ТЕРАПЕВТ',
 'Приета с решение на Общото събрание, Протокол № ……… от ……………… г.', 'Показатели и критерии', '{rehabilitator}',
 '[{"n": "1", "g": "Планиране, организация и провеждане на диагностично-терапевтичния процес", "max": 14, "items": [{"k": "1.1", "t": "Планиране на диагностично-терапевтичната дейност въз основа на оценените индивидуални потребности и функционални възможности на детето/ученика.", "max": 4}, {"k": "1.2", "t": "Провеждане на терапевтична работа за развитие на сензорни, двигателни, когнитивни и практически умения, необходими за участие в ежедневни и образователни дейности.", "max": 4}, {"k": "1.3", "t": "Адаптиране на дейностите, терапевтичните средства и средата според функционалните възможности и затруднения на детето/ученика.", "max": 3}, {"k": "1.4", "t": "Проследяване на резултатите от терапевтичната работа и актуализиране на целите и подходите при установена необходимост.", "max": 3}]}, {"n": "2", "g": "Използване на иновативни методи в терапевтичната дейност", "max": 8, "items": [{"k": "2.1", "t": "Прилагане на разнообразни и адаптирани терапевтични методи и техники, съобразени с конкретните функционални затруднения.", "max": 4}, {"k": "2.2", "t": "Адаптиране и използване на терапевтични материали, средства, визуални опори и дигитални ресурси за работа с деца и ученици.", "max": 4}]}, {"n": "3", "g": "Работа в екип за създаване на подкрепяща и достъпна среда", "max": 8, "items": [{"k": "3.1", "t": "Участие в екипното обсъждане, планиране и проследяване на подкрепата за детето/ученика.", "max": 3}, {"k": "3.2", "t": "Предоставяне на професионални препоръки към педагогическите специалисти за адаптиране на средата и дейностите според функционалните потребности на ученика.", "max": 3}, {"k": "3.3", "t": "Участие в съвместна работа с други специалисти при комплексни случаи.", "max": 2}]}, {"n": "4", "g": "Работа с деца и ученици, нуждаещи се от допълнителна подкрепа", "max": 8, "items": [{"k": "4.1", "t": "Индивидуална терапевтична работа за преодоляване или компенсиране на затрудненията в ежедневното функциониране и подобряването на двигателните умения.", "max": 3}, {"k": "4.2", "t": "Работа за развитие на самостоятелността при самообслужване, организация и изпълнение на ежедневни дейности.", "max": 3}, {"k": "4.3", "t": "Прилагане на допълнителни индивидуални стратегии при ученици с комплексни потребности или значителни затруднения в ежедневието.", "max": 2}]}, {"n": "5", "g": "Резултати от терапевтичната работа и професионалната дейност", "max": 7, "items": [{"k": "5.1", "t": "Установен и документиран напредък по заложените терапевтични цели.", "max": 4}, {"k": "5.2", "t": "Разработени и приложени практически решения, подпомагащи участието и самостоятелността на детето/ученика в образователната и ежедневната среда.", "max": 3}]}, {"n": "6", "g": "Работа с родители/настойници и лица, полагащи грижи", "max": 6, "items": [{"k": "6.1", "t": "Консултиране на родители/настойници относно функционалните потребности и възможностите за подкрепа на детето/ученика.", "max": 2}, {"k": "6.2", "t": "Обучение и демонстриране на конкретни техники и дейности за развиване на самостоятелност и практически умения в домашна среда.", "max": 2}, {"k": "6.3", "t": "Предоставяне на препоръки за адаптиране на средата, помощни средства и организацията на ежедневните дейности.", "max": 2}]}, {"n": "7", "g": "Работа с деца и ученици в дейности извън обичайната терапевтична среда", "max": 7, "items": [{"k": "7.1", "t": "Планиране и провеждане на дейности за развитие и пренасяне на функционални, сензомоторни и практически умения в реална среда.", "max": 4}, {"k": "7.2", "t": "Участие в организирани от ЦСОП извънкласни, извънучилищни и общоучилищни дейности с конкретен принос към участието на учениците.", "max": 3}]}, {"n": "8", "g": "Методическа работа, споделяне на професионален опит и подкрепа на колеги", "max": 7, "items": [{"k": "8.1", "t": "Участие в обсъждане и решаване на професионални казуси и представяне на приложими терапевтични решения.", "max": 3}, {"k": "8.2", "t": "Методическо подпомагане на педагогически специалисти и новопостъпили колеги по въпроси, свързани с функционалните затруднения и терапевтичната подкрепа.", "max": 2}, {"k": "8.3", "t": "Споделяне на материали, техники, добри практики или знания от проведени обучения и квалификационни форми.", "max": 2}]}, {"n": "9", "g": "Разработване и реализиране на проекти", "max": 5, "items": [{"k": "9.1", "t": "Участие в разработване на проектно предложение или проектна дейност, свързана с подкрепата на деца и ученици със специални образователни потребности.", "max": 2}, {"k": "9.2", "t": "Участие в реализиране на проектни дейности.", "max": 2}, {"k": "9.3", "t": "Принос при разработване на материали, дейности, отчетност или представяне на резултатите по проект.", "max": 1}]}, {"n": "10", "g": "Професионално развитие, принос към дейността на институцията и други показатели", "max": 30, "items": [{"k": "10.1", "t": "Участие във форми на квалификация с приложимост към терапевтичната практика и дейността на ЦСОП.", "max": 4}, {"k": "10.2", "t": "Участие в срещи с ЕПЛР и други специалисти за проследяване на развитието и координиране на терапевтичната подкрепа.", "max": 4}, {"k": "10.3", "t": "Своевременно и коректно изготвяне и предаване на изискуемата професионална документация, справки, оценки и отчети.", "max": 4}, {"k": "10.4", "t": "Коректно водене на документацията за проведената терапевтична дейност.", "max": 3}, {"k": "10.5", "t": "Разработване и реализиране на предложения за подобряване на терапевтичната работа, достъпността на средата или организацията на подкрепата.", "max": 4}, {"k": "10.6", "t": "Участие и изпълнение на конкретни задачи в комисии, работни групи и инициативи на ЦСОП.", "max": 3}, {"k": "10.7", "t": "Разработване, адаптиране или въвеждане в практиката на нови терапевтични материали, средства, методики или практически решения.", "max": 4}, {"k": "10.8", "t": "Получени професионални отличия, награди или представяне на професионален опит и практика извън институцията през оценявания период.", "max": 4}]}]', '[{"n": "1", "g": "Планиране, организация и провеждане на диагностично-терапевтичния процес", "max": 14, "items": [{"k": "1.1", "t": "Планиране на диагностично-терапевтичната дейност въз основа на оценените индивидуални потребности и функционални възможности на детето/ученика.", "max": 4}, {"k": "1.2", "t": "Провеждане на терапевтична работа за развитие на сензорни, двигателни, когнитивни и практически умения, необходими за участие в ежедневни и образователни дейности.", "max": 4}, {"k": "1.3", "t": "Адаптиране на дейностите, терапевтичните средства и средата според функционалните възможности и затруднения на детето/ученика.", "max": 3}, {"k": "1.4", "t": "Проследяване на резултатите от терапевтичната работа и актуализиране на целите и подходите при установена необходимост.", "max": 3}]}, {"n": "2", "g": "Използване на иновативни методи в терапевтичната дейност", "max": 8, "items": [{"k": "2.1", "t": "Прилагане на разнообразни и адаптирани терапевтични методи и техники, съобразени с конкретните функционални затруднения.", "max": 4}, {"k": "2.2", "t": "Адаптиране и използване на терапевтични материали, средства, визуални опори и дигитални ресурси за работа с деца и ученици.", "max": 4}]}, {"n": "3", "g": "Работа в екип за създаване на подкрепяща и достъпна среда", "max": 8, "items": [{"k": "3.1", "t": "Участие в екипното обсъждане, планиране и проследяване на подкрепата за детето/ученика.", "max": 3}, {"k": "3.2", "t": "Предоставяне на професионални препоръки към педагогическите специалисти за адаптиране на средата и дейностите според функционалните потребности на ученика.", "max": 3}, {"k": "3.3", "t": "Участие в съвместна работа с други специалисти при комплексни случаи.", "max": 2}]}, {"n": "4", "g": "Работа с деца и ученици, нуждаещи се от допълнителна подкрепа", "max": 8, "items": [{"k": "4.1", "t": "Индивидуална терапевтична работа за преодоляване или компенсиране на затрудненията в ежедневното функциониране и подобряването на двигателните умения.", "max": 3}, {"k": "4.2", "t": "Работа за развитие на самостоятелността при самообслужване, организация и изпълнение на ежедневни дейности.", "max": 3}, {"k": "4.3", "t": "Прилагане на допълнителни индивидуални стратегии при ученици с комплексни потребности или значителни затруднения в ежедневието.", "max": 2}]}, {"n": "5", "g": "Резултати от терапевтичната работа и професионалната дейност", "max": 7, "items": [{"k": "5.1", "t": "Установен и документиран напредък по заложените терапевтични цели.", "max": 4}, {"k": "5.2", "t": "Разработени и приложени практически решения, подпомагащи участието и самостоятелността на детето/ученика в образователната и ежедневната среда.", "max": 3}]}, {"n": "6", "g": "Работа с родители/настойници и лица, полагащи грижи", "max": 6, "items": [{"k": "6.1", "t": "Консултиране на родители/настойници относно функционалните потребности и възможностите за подкрепа на детето/ученика.", "max": 2}, {"k": "6.2", "t": "Обучение и демонстриране на конкретни техники и дейности за развиване на самостоятелност и практически умения в домашна среда.", "max": 2}, {"k": "6.3", "t": "Предоставяне на препоръки за адаптиране на средата, помощни средства и организацията на ежедневните дейности.", "max": 2}]}, {"n": "7", "g": "Работа с деца и ученици в дейности извън обичайната терапевтична среда", "max": 7, "items": [{"k": "7.1", "t": "Планиране и провеждане на дейности за развитие и пренасяне на функционални, сензомоторни и практически умения в реална среда.", "max": 4}, {"k": "7.2", "t": "Участие в организирани от ЦСОП извънкласни, извънучилищни и общоучилищни дейности с конкретен принос към участието на учениците.", "max": 3}]}, {"n": "8", "g": "Методическа работа, споделяне на професионален опит и подкрепа на колеги", "max": 7, "items": [{"k": "8.1", "t": "Участие в обсъждане и решаване на професионални казуси и представяне на приложими терапевтични решения.", "max": 3}, {"k": "8.2", "t": "Методическо подпомагане на педагогически специалисти и новопостъпили колеги по въпроси, свързани с функционалните затруднения и терапевтичната подкрепа.", "max": 2}, {"k": "8.3", "t": "Споделяне на материали, техники, добри практики или знания от проведени обучения и квалификационни форми.", "max": 2}]}, {"n": "9", "g": "Разработване и реализиране на проекти", "max": 5, "items": [{"k": "9.1", "t": "Участие в разработване на проектно предложение или проектна дейност, свързана с подкрепата на деца и ученици със специални образователни потребности.", "max": 2}, {"k": "9.2", "t": "Участие в реализиране на проектни дейности.", "max": 2}, {"k": "9.3", "t": "Принос при разработване на материали, дейности, отчетност или представяне на резултатите по проект.", "max": 1}]}, {"n": "10", "g": "Професионално развитие, принос към дейността на институцията и други показатели", "max": 30, "items": [{"k": "10.1", "t": "Участие във форми на квалификация с приложимост към терапевтичната практика и дейността на ЦСОП.", "max": 4}, {"k": "10.2", "t": "Участие в срещи с ЕПЛР и други специалисти за проследяване на развитието и координиране на терапевтичната подкрепа.", "max": 4}, {"k": "10.3", "t": "Своевременно и коректно изготвяне и предаване на изискуемата професионална документация, справки, оценки и отчети.", "max": 4}, {"k": "10.4", "t": "Коректно водене на документацията за проведената терапевтична дейност.", "max": 3}, {"k": "10.5", "t": "Разработване и реализиране на предложения за подобряване на терапевтичната работа, достъпността на средата или организацията на подкрепата.", "max": 4}, {"k": "10.6", "t": "Участие и изпълнение на конкретни задачи в комисии, работни групи и инициативи на ЦСОП.", "max": 3}, {"k": "10.7", "t": "Разработване, адаптиране или въвеждане в практиката на нови терапевтични материали, средства, методики или практически решения.", "max": 4}, {"k": "10.8", "t": "Получени професионални отличия, награди или представяне на професионален опит и практика извън институцията през оценявания период.", "max": 4}]}]', 20),
('dtv_nonped', 'dtv', 'nonped', 'ДТВ — непедагогически персонал',
 'ЗА ОПРЕДЕЛЯНЕ НА ДОПЪЛНИТЕЛНО ТРУДОВО ВЪЗНАГРАЖДЕНИЕ ЗА ПОСТИГНАТИ РЕЗУЛТАТИ ОТ ТРУДА НА НЕПЕДАГОГИЧЕСКИЯ ПЕРСОНАЛ',
 'Приета с решение на Общото събрание, Протокол № ……… от ……………… г.', 'Критерии', '{support,secretary}',
 '[{"n": "1", "g": "Планиране и изпълнение на възложените трудови задачи и задължения, характеризиращи описанието на длъжността", "max": 40, "items": [{"k": "1.1", "t": "Почиства и поддържа постоянна чистота в определените помещения и прилежащите площи", "max": 4}, {"k": "1.2", "t": "Съответствие между планиране и изпълнение на задачите", "max": 6}, {"k": "1.3", "t": "Водене на училищна допълнителна документация, възложена от директора", "max": 6}, {"k": "1.4", "t": "Изпълнение на препоръки, отправени при предходни проверки", "max": 4}, {"k": "1.5", "t": "Точно и ефективно използване на работното време", "max": 4}, {"k": "1.6", "t": "Точно и стриктно спазване на сроковете за изпълнение на възложените задачи и на трудовата дисциплина", "max": 6}, {"k": "1.7", "t": "Умения да обяснява и обобщава на ръководството", "max": 4}, {"k": "1.8", "t": "Изпълнява възложените задачи без необходимост от надзор", "max": 6}]}, {"n": "2", "g": "Работа в екип за създаване на подходяща работна среда", "max": 20, "items": [{"k": "2.1", "t": "Осигурява позитивна среда в колектива – толерантни и коректни отношения с деца, непедагогическия и педагогическия персонал", "max": 4}, {"k": "2.2", "t": "Справяне при разрешаване на възникнали казуси, проблемни ситуации и конфликти", "max": 4}, {"k": "2.3", "t": "Обща комуникативност", "max": 4}, {"k": "2.4", "t": "Ниво на справяне с възникнали проблеми", "max": 4}, {"k": "2.5", "t": "Приема изпълнението на задачи, непряко свързани с длъжността", "max": 4}]}, {"n": "3", "g": "Работа с родители и педагогически персонал", "max": 12, "items": [{"k": "3.1", "t": "Подпомагане при честване на празници и събития", "max": 2}, {"k": "3.2", "t": "Ангажираност в извънкласните дейности", "max": 2}, {"k": "3.3", "t": "Проявява инициативност, коректност, толерантност и учтивост към родителите", "max": 4}, {"k": "3.4", "t": "Оказва помощ на новопостъпили колеги", "max": 4}]}, {"n": "4", "g": "Планиране по делегирани отговорности", "max": 16, "items": [{"k": "4.1", "t": "Допринася за взаимоотношенията с фирми за подпомагане на центъра", "max": 4}, {"k": "4.2", "t": "Допринася за дарителски инициативи", "max": 4}, {"k": "4.3", "t": "Проявява отговорност, дисциплинираност и ефективност при изпълняване на служебните си задължения", "max": 4}, {"k": "4.4", "t": "Опазване на повереното му имущество", "max": 4}]}, {"n": "5", "g": "Резултати от трудовата дейност", "max": 12, "items": [{"k": "5.1", "t": "Качество на извършената работа", "max": 4}, {"k": "5.2", "t": "Правилна експлоатация и добро състояние на поверените уреди", "max": 4}, {"k": "5.3", "t": "Правилна и безопасна употреба на почистващите препарати", "max": 4}]}]', '[{"n": "1", "g": "Планиране и изпълнение на възложените трудови задачи и задължения, характеризиращи описанието на длъжността", "max": 40, "items": [{"k": "1.1", "t": "Почиства и поддържа постоянна чистота в определените помещения и прилежащите площи", "max": 4}, {"k": "1.2", "t": "Съответствие между планиране и изпълнение на задачите", "max": 6}, {"k": "1.3", "t": "Водене на училищна допълнителна документация, възложена от директора", "max": 6}, {"k": "1.4", "t": "Изпълнение на препоръки, отправени при предходни проверки", "max": 4}, {"k": "1.5", "t": "Точно и ефективно използване на работното време", "max": 4}, {"k": "1.6", "t": "Точно и стриктно спазване на сроковете за изпълнение на възложените задачи и на трудовата дисциплина", "max": 6}, {"k": "1.7", "t": "Умения да обяснява и обобщава на ръководството", "max": 4}, {"k": "1.8", "t": "Изпълнява възложените задачи без необходимост от надзор", "max": 6}]}, {"n": "2", "g": "Работа в екип за създаване на подходяща работна среда", "max": 20, "items": [{"k": "2.1", "t": "Осигурява позитивна среда в колектива – толерантни и коректни отношения с деца, непедагогическия и педагогическия персонал", "max": 4}, {"k": "2.2", "t": "Справяне при разрешаване на възникнали казуси, проблемни ситуации и конфликти", "max": 4}, {"k": "2.3", "t": "Обща комуникативност", "max": 4}, {"k": "2.4", "t": "Ниво на справяне с възникнали проблеми", "max": 4}, {"k": "2.5", "t": "Приема изпълнението на задачи, непряко свързани с длъжността", "max": 4}]}, {"n": "3", "g": "Работа с родители и педагогически персонал", "max": 12, "items": [{"k": "3.1", "t": "Подпомагане при честване на празници и събития", "max": 2}, {"k": "3.2", "t": "Ангажираност в извънкласните дейности", "max": 2}, {"k": "3.3", "t": "Проявява инициативност, коректност, толерантност и учтивост към родителите", "max": 4}, {"k": "3.4", "t": "Оказва помощ на новопостъпили колеги", "max": 4}]}, {"n": "4", "g": "Планиране по делегирани отговорности", "max": 16, "items": [{"k": "4.1", "t": "Допринася за взаимоотношенията с фирми за подпомагане на центъра", "max": 4}, {"k": "4.2", "t": "Допринася за дарителски инициативи", "max": 4}, {"k": "4.3", "t": "Проявява отговорност, дисциплинираност и ефективност при изпълняване на служебните си задължения", "max": 4}, {"k": "4.4", "t": "Опазване на повереното му имущество", "max": 4}]}, {"n": "5", "g": "Резултати от трудовата дейност", "max": 12, "items": [{"k": "5.1", "t": "Качество на извършената работа", "max": 4}, {"k": "5.2", "t": "Правилна експлоатация и добро състояние на поверените уреди", "max": 4}, {"k": "5.3", "t": "Правилна и безопасна употреба на почистващите препарати", "max": 4}]}]', 30)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
