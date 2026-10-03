-- РАЗВИТИЕ: функционална оценка на детето по области, повтаряна във времето (входна → междинна → изходна),
-- с цели (умения, отбелязани като цел) и обща банка от умения, която ЦСОП може да допълва.
-- Вижда се от всеки, който вижда детето (без деловодител и помощен персонал). Безопасно за повторно пускане.

create table if not exists public.dev_skills (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('gross_motor','fine_motor','receptive','expressive','cognitive','social','self_care','academic')),
  label text not null,
  sort int not null default 0,
  active boolean not null default true,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.dev_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  assessed_on date not null default current_date,
  kind text not null default 'current' check (kind in ('entry','mid','exit','current')),
  assessor_id uuid references public.staff_profiles(id) on delete set null,
  notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists dev_assessments_student_idx on public.dev_assessments (student_id, assessed_on);

create table if not exists public.dev_scores (
  assessment_id uuid not null references public.dev_assessments(id) on delete cascade,
  skill_id uuid not null references public.dev_skills(id) on delete cascade,
  score smallint not null check (score between 0 and 4),
  note text,
  primary key (assessment_id, skill_id)
);

create table if not exists public.dev_targets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.dev_skills(id) on delete cascade,
  set_by uuid references public.staff_profiles(id) on delete set null,
  set_at timestamptz not null default now(),
  achieved_at timestamptz,
  unique (student_id, skill_id)
);

-- Права: педагогическите роли, и то само за деца, които и без това виждат
create or replace function public.dev_can_see_student(p_student uuid) returns boolean
language sql stable as $$
  select get_my_role()::text not in ('secretary', 'support')
     and exists (select 1 from students s where s.id = p_student)
$$;

alter table public.dev_skills enable row level security;
alter table public.dev_assessments enable row level security;
alter table public.dev_scores enable row level security;
alter table public.dev_targets enable row level security;

drop policy if exists "dev_skills_read" on public.dev_skills;
create policy "dev_skills_read" on public.dev_skills for select to authenticated using (true);
drop policy if exists "dev_skills_add" on public.dev_skills;
create policy "dev_skills_add" on public.dev_skills for insert to authenticated
  with check (get_my_role()::text not in ('secretary', 'support'));
drop policy if exists "dev_skills_manage" on public.dev_skills;
create policy "dev_skills_manage" on public.dev_skills for update to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director') or created_by = get_my_staff_id());

drop policy if exists "dev_assessments_read" on public.dev_assessments;
create policy "dev_assessments_read" on public.dev_assessments for select to authenticated
  using (dev_can_see_student(student_id));
drop policy if exists "dev_assessments_insert" on public.dev_assessments;
create policy "dev_assessments_insert" on public.dev_assessments for insert to authenticated
  with check (assessor_id = get_my_staff_id() and dev_can_see_student(student_id));
drop policy if exists "dev_assessments_change" on public.dev_assessments;
create policy "dev_assessments_change" on public.dev_assessments for update to authenticated
  using (assessor_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'));
drop policy if exists "dev_assessments_delete" on public.dev_assessments;
create policy "dev_assessments_delete" on public.dev_assessments for delete to authenticated
  using (assessor_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'));

drop policy if exists "dev_scores_read" on public.dev_scores;
create policy "dev_scores_read" on public.dev_scores for select to authenticated
  using (exists (select 1 from dev_assessments a where a.id = assessment_id));
drop policy if exists "dev_scores_write" on public.dev_scores;
create policy "dev_scores_write" on public.dev_scores for all to authenticated
  using (exists (select 1 from dev_assessments a where a.id = assessment_id
                 and (a.assessor_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'))))
  with check (exists (select 1 from dev_assessments a where a.id = assessment_id
                 and (a.assessor_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director'))));

drop policy if exists "dev_targets_read" on public.dev_targets;
create policy "dev_targets_read" on public.dev_targets for select to authenticated
  using (dev_can_see_student(student_id));
drop policy if exists "dev_targets_write" on public.dev_targets;
create policy "dev_targets_write" on public.dev_targets for all to authenticated
  using (dev_can_see_student(student_id)) with check (dev_can_see_student(student_id));

-- Начална банка от умения (само ако е празна). Формулировките са наши — допълвайте свободно от екрана.
insert into public.dev_skills (area, label, sort)
select v.area, v.label, v.sort from (values
  ('gross_motor', 'Седи стабилно без опора', 1),
  ('gross_motor', 'Ходи самостоятелно', 2),
  ('gross_motor', 'Качва и слиза по стълби', 3),
  ('gross_motor', 'Тича и спира по желание', 4),
  ('gross_motor', 'Скача с два крака', 5),
  ('gross_motor', 'Пази равновесие на един крак', 6),
  ('gross_motor', 'Хвърля и лови голяма топка', 7),
  ('fine_motor', 'Хваща и пуска предмети целенасочено', 1),
  ('fine_motor', 'Използва щипков захват (палец–показалец)', 2),
  ('fine_motor', 'Прехвърля предмет от ръка в ръка', 3),
  ('fine_motor', 'Нанизва едри мъниста', 4),
  ('fine_motor', 'Държи молив с подходящ захват', 5),
  ('fine_motor', 'Реже с ножица по линия', 6),
  ('fine_motor', 'Закопчава копчета / цип', 7),
  ('receptive', 'Реагира, когато чуе името си', 1),
  ('receptive', 'Разбира „не“ и спира действието', 2),
  ('receptive', 'Изпълнява едностъпкова инструкция', 3),
  ('receptive', 'Изпълнява двустъпкова инструкция', 4),
  ('receptive', 'Посочва познати предмети и картинки по назоваване', 5),
  ('receptive', 'Разбира понятия (голям–малък, горе–долу, в–на)', 6),
  ('receptive', 'Отговаря на въпроси по кратък разказ', 7),
  ('expressive', 'Изразява желание с жест, посочване или картинка', 1),
  ('expressive', 'Използва отделни думи с цел', 2),
  ('expressive', 'Свързва 2–3 думи', 3),
  ('expressive', 'Назовава познати предмети и действия', 4),
  ('expressive', 'Задава въпроси', 5),
  ('expressive', 'Редува се в разговор (поддържа диалог)', 6),
  ('expressive', 'Разказва случка с няколко изречения', 7),
  ('cognitive', 'Задържа вниманието си върху задача', 1),
  ('cognitive', 'Търси скрит предмет', 2),
  ('cognitive', 'Свързва еднакви предмети или картинки', 3),
  ('cognitive', 'Сортира по цвят, форма или големина', 4),
  ('cognitive', 'Подрежда пъзел от 4+ части', 5),
  ('cognitive', 'Разбира причина и следствие', 6),
  ('cognitive', 'Подрежда картинки по последователност', 7),
  ('social', 'Поддържа зрителен контакт', 1),
  ('social', 'Проявява интерес към други деца', 2),
  ('social', 'Участва в съвместна игра', 3),
  ('social', 'Изчаква реда си', 4),
  ('social', 'Разпознава и назовава емоции', 5),
  ('social', 'Приема промяна в рутината', 6),
  ('social', 'Успокоява се с подкрепа / самостоятелно', 7),
  ('self_care', 'Храни се самостоятелно', 1),
  ('self_care', 'Пие от чаша', 2),
  ('self_care', 'Използва тоалетна', 3),
  ('self_care', 'Мие и подсушава ръцете си', 4),
  ('self_care', 'Съблича и облича дреха', 5),
  ('self_care', 'Обува и събува обувки', 6),
  ('self_care', 'Подрежда личните си вещи', 7),
  ('academic', 'Следва визуален дневен график', 1),
  ('academic', 'Разпознава буквите', 2),
  ('academic', 'Чете срички и думи', 3),
  ('academic', 'Пише / преписва букви и думи', 4),
  ('academic', 'Разпознава цифрите', 5),
  ('academic', 'Брои предмети до 10', 6),
  ('academic', 'Събира и изважда до 10', 7)
) as v(area, label, sort)
where not exists (select 1 from public.dev_skills);
