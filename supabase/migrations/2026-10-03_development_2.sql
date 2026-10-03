-- РАЗВИТИЕ 2: профил на детето (групи и стандартни нива: GMFCS/MACS/CFCS, ниво на подкрепа при аутизъм, МКФ степен),
-- нива на уменията (ранни/основни/напреднали) + нова област „Сензорика и поведение“, „неприложимо“ (-1),
-- цели с очакван резултат и оценка GAS (-2..+2) по етапи. Безопасно за повторно пускане.

-- Нова област и „неприложимо“
alter table public.dev_skills drop constraint if exists dev_skills_area_check;
alter table public.dev_skills add constraint dev_skills_area_check
  check (area in ('gross_motor','fine_motor','receptive','expressive','cognitive','social','self_care','academic','sensory'));
alter table public.dev_skills add column if not exists level smallint not null default 2 check (level between 1 and 3);

alter table public.dev_scores drop constraint if exists dev_scores_score_check;
alter table public.dev_scores add constraint dev_scores_score_check check (score between -1 and 4);

-- Профил на детето
create table if not exists public.dev_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  groups text[] not null default '{}',
  gmfcs smallint check (gmfcs between 1 and 5),
  macs smallint check (macs between 1 and 5),
  cfcs smallint check (cfcs between 1 and 5),
  asd_level smallint check (asd_level between 1 and 3),
  icf smallint check (icf between 0 and 4),
  note text,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.dev_profiles enable row level security;
drop policy if exists "dev_profiles_read" on public.dev_profiles;
create policy "dev_profiles_read" on public.dev_profiles for select to authenticated using (dev_can_see_student(student_id));
drop policy if exists "dev_profiles_write" on public.dev_profiles;
create policy "dev_profiles_write" on public.dev_profiles for all to authenticated
  using (dev_can_see_student(student_id)) with check (dev_can_see_student(student_id));

-- Цели: очакван резултат + GAS по етапи
alter table public.dev_targets add column if not exists expected text;
create table if not exists public.dev_gas (
  target_id uuid not null references public.dev_targets(id) on delete cascade,
  assessment_id uuid not null references public.dev_assessments(id) on delete cascade,
  gas smallint not null check (gas between -2 and 2),
  rated_by uuid references public.staff_profiles(id) on delete set null,
  primary key (target_id, assessment_id)
);
alter table public.dev_gas enable row level security;
drop policy if exists "dev_gas_read" on public.dev_gas;
create policy "dev_gas_read" on public.dev_gas for select to authenticated
  using (exists (select 1 from dev_targets t where t.id = target_id));
drop policy if exists "dev_gas_write" on public.dev_gas;
create policy "dev_gas_write" on public.dev_gas for all to authenticated
  using (exists (select 1 from dev_targets t where t.id = target_id and dev_can_see_student(t.student_id)))
  with check (exists (select 1 from dev_targets t where t.id = target_id and dev_can_see_student(t.student_id)));

-- Нива на първоначалните умения: най-трудните → „напреднали“
update public.dev_skills set level = 3 where level = 2 and label in (
  'Пази равновесие на един крак', 'Хвърля и лови голяма топка', 'Реже с ножица по линия', 'Закопчава копчета / цип',
  'Отговаря на въпроси по кратък разказ', 'Разбира понятия (голям–малък, горе–долу, в–на)',
  'Задава въпроси', 'Разказва случка с няколко изречения', 'Подрежда картинки по последователност',
  'Разпознава и назовава емоции', 'Подрежда личните си вещи', 'Чете срички и думи', 'Пише / преписва букви и думи',
  'Събира и изважда до 10');

-- Ранни (базови) умения — за децата с тежки затруднения; добавят се само веднъж
insert into public.dev_skills (area, label, sort, level)
select v.area, v.label, v.sort, 1 from (values
  ('gross_motor', 'Контролира главата си', -5),
  ('gross_motor', 'Обръща се от гръб по корем и обратно', -4),
  ('gross_motor', 'Седи с опора', -3),
  ('gross_motor', 'Стои прав с опора', -2),
  ('gross_motor', 'Придвижва се целенасочено (пълзи, с проходилка или количка)', -1),
  ('fine_motor', 'Посяга към предмет', -3),
  ('fine_motor', 'Задържа предмет в ръка', -2),
  ('fine_motor', 'Натиска бутон / играчка с причина–следствие', -1),
  ('receptive', 'Реагира на звук и глас', -3),
  ('receptive', 'Обръща поглед към говорещия', -2),
  ('receptive', 'Разбира познати рутинни думи (яж, ела, чао)', -1),
  ('expressive', 'Изразява удоволствие и недоволство (глас, мимика)', -4),
  ('expressive', 'Отговаря с „да/не“ по свой начин (глас, жест, поглед)', -3),
  ('expressive', 'Използва карти / картинки за искане', -2),
  ('expressive', 'Използва устройство за комуникация (таблет, бутон)', -1),
  ('cognitive', 'Проследява предмет с поглед', -3),
  ('cognitive', 'Разглежда и изследва предмети', -2),
  ('cognitive', 'Задържа внимание върху занимание 1–2 минути', -1),
  ('social', 'Приема близостта на възрастен', -3),
  ('social', 'Отговаря на усмивка или поздрав', -2),
  ('social', 'Сътрудничи при рутинна грижа', -1),
  ('self_care', 'Приема храна с различна консистенция', -3),
  ('self_care', 'Сигнализира мокро или нужда от тоалетна', -2),
  ('self_care', 'Съдейства при обличане (подава ръка или крак)', -1),
  ('academic', 'Остава на работното място за кратка задача', -2),
  ('academic', 'Работи по визуална инструкция или схема', -1),
  ('sensory', 'Понася докосване и различни материи', 1),
  ('sensory', 'Понася шум и оживена среда', 2),
  ('sensory', 'Приема нова храна, миризма или вкус', 3)
) as v(area, label, sort)
where not exists (select 1 from public.dev_skills where level = 1);

insert into public.dev_skills (area, label, sort, level)
select v.area, v.label, v.sort, v.level from (values
  ('sensory', 'Преминава от една дейност към друга', 4, 2),
  ('sensory', 'Успокоява се със сензорна стратегия (люлеене, тежко одеяло, слушалки)', 5, 2),
  ('sensory', 'Изразява протест по приемлив начин', 6, 2),
  ('sensory', 'Насочва се към занимание без стереотипни движения', 7, 3),
  ('sensory', 'Разпознава собствената си умора или претоварване', 8, 3)
) as v(area, label, sort, level)
where not exists (select 1 from public.dev_skills where area = 'sensory' and level > 1);
