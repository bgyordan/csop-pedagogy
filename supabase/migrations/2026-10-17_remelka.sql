-- РЕМЕЛКА — смятане и социални умения за деца с обучителни затруднения.
-- Логиката на методиката: диагностика (къде и как греши детето) → индивидуална програма точно по грешките →
-- кратки чести занимания (от действие с предмети към наум) → нова диагностика и напредък.
-- Каталогът с области и умения е НАШ, по принципите на методиката (не копира авторските тестове и материали);
-- координаторите и ръководството го приспособяват към наръчниците. Достъп до детето — works_with_student (от PECS).
-- Безопасно за повторно пускане.

-- Каталог: части (смятане / социални), области и умения в реда на изграждане
create table if not exists public.remelka_skills (
  id uuid primary key default gen_random_uuid(),
  part text not null check (part in ('math', 'social')),
  area text not null,
  code text not null unique,            -- „С3.2“ — подредба и кратко име
  title text not null,
  hint text,                            -- какво точно се проверява / как изглежда „овладяно“
  sort int not null default 0,
  archived boolean not null default false,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Детето в програмата
create table if not exists public.remelka_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  parts text[] not null default array['math', 'social'],
  started_at date not null default current_date,
  started_by uuid references public.staff_profiles(id) on delete set null,
  note text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Диагностика: входяща, междинна, изходяща
create table if not exists public.remelka_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  kind text not null check (kind in ('entry', 'mid', 'exit')),
  held_on date not null default current_date,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists remelka_assessments_idx on public.remelka_assessments (student_id, held_on);

-- Резултат по умение: ниво 0–4 и видът на грешките
create table if not exists public.remelka_results (
  assessment_id uuid not null references public.remelka_assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.remelka_skills(id) on delete cascade,
  level smallint not null check (level between 0 and 4),
  errors text[] not null default '{}',
  note text,
  primary key (assessment_id, skill_id)
);
create index if not exists remelka_results_idx on public.remelka_results (student_id, skill_id);

-- Индивидуалната програма — уменията, по които се работи сега
create table if not exists public.remelka_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.remelka_skills(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'mastered', 'paused')),
  target_level smallint not null default 3 check (target_level between 1 and 4),
  added_on date not null default current_date,
  mastered_on date,
  added_by uuid references public.staff_profiles(id) on delete set null,
  note text,
  unique (student_id, skill_id)
);

-- Занимания и какво е работено в тях
create table if not exists public.remelka_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  held_on date not null default current_date,
  minutes smallint,
  place text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists remelka_sessions_idx on public.remelka_sessions (student_id, held_on);

create table if not exists public.remelka_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.remelka_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  skill_id uuid not null references public.remelka_skills(id) on delete cascade,
  level smallint not null check (level between 1 and 4),        -- на какво ниво на действие се работи
  support text not null check (support in ('independent', 'partial', 'full')),
  activity text
);
create index if not exists remelka_session_items_idx on public.remelka_session_items (student_id, skill_id);

-- Каталогът: четат всички; пишат координаторите и ръководството
alter table public.remelka_skills enable row level security;
drop policy if exists "remelka_skills_read" on public.remelka_skills;
create policy "remelka_skills_read" on public.remelka_skills for select to authenticated using (true);
drop policy if exists "remelka_skills_write" on public.remelka_skills;
create policy "remelka_skills_write" on public.remelka_skills for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director') or exists (select 1 from staff_profiles where id = get_my_staff_id() and is_coordinator))
  with check (get_my_role()::text in ('admin', 'zdud', 'director') or exists (select 1 from staff_profiles where id = get_my_staff_id() and is_coordinator));

-- Данните на детето: само който работи с него (+ координатори и ръководство)
do $$
declare t text;
begin
  foreach t in array array['remelka_profiles', 'remelka_assessments', 'remelka_results', 'remelka_goals', 'remelka_sessions', 'remelka_session_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format('create policy "%s_read" on public.%I for select to authenticated using (works_with_student(student_id))', t, t);
    execute format('drop policy if exists "%s_insert" on public.%I', t, t);
    execute format('create policy "%s_insert" on public.%I for insert to authenticated with check (works_with_student(student_id))', t, t);
    execute format('drop policy if exists "%s_update" on public.%I', t, t);
    execute format('create policy "%s_update" on public.%I for update to authenticated using (works_with_student(student_id)) with check (works_with_student(student_id))', t, t);
    execute format('drop policy if exists "%s_delete" on public.%I', t, t);
  end loop;
end $$;
-- триене: програмата и резултатите — екипът; занимания и диагностики — авторът или ръководството; профил — ръководството
create policy "remelka_goals_delete" on public.remelka_goals for delete to authenticated using (works_with_student(student_id));
create policy "remelka_results_delete" on public.remelka_results for delete to authenticated using (works_with_student(student_id));
create policy "remelka_session_items_delete" on public.remelka_session_items for delete to authenticated using (works_with_student(student_id));
create policy "remelka_sessions_delete" on public.remelka_sessions for delete to authenticated
  using (works_with_student(student_id) and (staff_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director')));
create policy "remelka_assessments_delete" on public.remelka_assessments for delete to authenticated
  using (works_with_student(student_id) and (staff_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director')));
create policy "remelka_profiles_delete" on public.remelka_profiles for delete to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'));

-- Начален каталог (наш, по принципите на методиката) — после се приспособява към наръчниците
insert into public.remelka_skills (part, area, code, title, hint, sort) values
  -- СМЯТАНЕ
  ('math', 'Броене и количество', 'С1.1', 'Брои наизуст до 10', 'Казва числата подред, без пропуски.', 101),
  ('math', 'Броене и количество', 'С1.2', 'Брои предмети едно към едно', 'Докосва/мести всеки предмет по веднъж; последното число е „колко са“.', 102),
  ('math', 'Броене и количество', 'С1.3', 'Сравнява количества', 'Повече, по-малко, колкото — първо с предмети, после на картинка.', 103),
  ('math', 'Броене и количество', 'С1.4', 'Разпознава и записва числата до 10', 'Свързва число, количество и цифра; пише цифрите правилно.', 104),
  ('math', 'Броене и количество', 'С1.5', 'Числовата редица до 20', 'Кое е преди/след; брои напред и назад от дадено число.', 105),
  ('math', 'Числа и място', 'С2.1', 'Числата до 100 — четене и записване', 'Изговаря и пише двуцифрени числа без размяна на цифрите.', 201),
  ('math', 'Числа и място', 'С2.2', 'Десетици и единици', 'Разлага числото (37 = 3 десетици и 7 единици) с пръчици/пари и на схема.', 202),
  ('math', 'Числа и място', 'С2.3', 'Сравнява и подрежда числа', 'Знаците <, >, =; подрежда по големина.', 203),
  ('math', 'Числа и място', 'С2.4', 'Числата до 1000 и над 1000', 'Стотици, десетици, единици; четене и записване на големи числа.', 204),
  ('math', 'Събиране и изваждане', 'С3.1', 'Събиране и изваждане до 10', 'Първо с предмети, после на картинка, накрая наум.', 301),
  ('math', 'Събиране и изваждане', 'С3.2', 'До 20 без преминаване', '13 + 4, 18 − 5 — работи с десетицата като цяло.', 302),
  ('math', 'Събиране и изваждане', 'С3.3', 'До 20 с преминаване през десетицата', '8 + 5 = 8 + 2 + 3; ключова стъпка — допълване до 10.', 303),
  ('math', 'Събиране и изваждане', 'С3.4', 'До 100', 'С десетици и единици; писмено и наум.', 304),
  ('math', 'Събиране и изваждане', 'С3.5', 'Текстови задачи от ежедневието', 'Разбира условието, избира действие, отговаря с изречение.', 305),
  ('math', 'Умножение и деление', 'С4.1', 'Умножение като повтарящо се събиране', 'Групи по равен брой предмети; 3 × 4 = 4 + 4 + 4.', 401),
  ('math', 'Умножение и деление', 'С4.2', 'Таблицата с 2, 5 и 10', 'Броене през 2, 5, 10; бързо припомняне.', 402),
  ('math', 'Умножение и деление', 'С4.3', 'Цялата таблица за умножение', 'Свързва с известни факти (6 × 7 = 5 × 7 + 7).', 403),
  ('math', 'Умножение и деление', 'С4.4', 'Деление на равни части', 'Разпределя предмети поравно; връзка с умножението.', 404),
  ('math', 'Измерване', 'С5.1', 'Дължина', 'Сравнява, мери с крачка/линийка; см и м.', 501),
  ('math', 'Измерване', 'С5.2', 'Маса и обем', 'По-тежко/по-леко; кг и л в кухнята и магазина.', 502),
  ('math', 'Време', 'С6.1', 'Части на деня и дни от седмицата', 'Сутрин/обед/вечер; вчера-днес-утре; седмицата подред.', 601),
  ('math', 'Време', 'С6.2', 'Часовник — цели и половин часове', 'Аналогов и цифров; свързва с дневния режим.', 602),
  ('math', 'Време', 'С6.3', 'Часовник — четвърт часа и минути', '„15 минути след 3“, „без 10 минути 8“.', 603),
  ('math', 'Време', 'С6.4', 'Календар и продължителност', 'Месеци, дати; колко време остава до …', 604),
  ('math', 'Пари', 'С7.1', 'Разпознава монетите и банкнотите (евро)', 'Назовава и подрежда по стойност.', 701),
  ('math', 'Пари', 'С7.2', 'Събира сума и плаща', 'Съставя сума с различни монети; плаща точно.', 702),
  ('math', 'Пари', 'С7.3', 'Ресто и пазаруване с бюджет', 'Колко ще ми върнат; стига ли ми за …', 703),
  -- СОЦИАЛНИ УМЕНИЯ
  ('social', 'Грижа за себе си', 'Г1.1', 'Хигиена', 'Мие ръцете, зъбите; ползва тоалетна самостоятелно.', 1101),
  ('social', 'Грижа за себе си', 'Г1.2', 'Обличане и подреждане на вещите', 'Облича се според времето; знае къде са нещата му.', 1102),
  ('social', 'Грижа за себе си', 'Г1.3', 'Хранене и поведение на масата', 'Ползва прибори, изчаква, почиства след себе си.', 1103),
  ('social', 'Общуване', 'Г2.1', 'Поздрав и представяне', 'Поздравява, казва името си, отговаря на „Как си?“.', 1201),
  ('social', 'Общуване', 'Г2.2', 'Молба за помощ', 'Разпознава кога има нужда и пита подходящия човек.', 1202),
  ('social', 'Общуване', 'Г2.3', 'Изчакване и ред', 'Изчаква реда си в игра, на опашка, в разговор.', 1203),
  ('social', 'Общуване', 'Г2.4', 'Разговор — слуша и отговаря', 'Гледа към говорещия, отговаря по темата, задава въпрос.', 1204),
  ('social', 'Общуване', 'Г2.5', 'Чувства — разпознава и казва', 'Назовава как се чувства и как се чувства другият.', 1205),
  ('social', 'Правила и поведение', 'Г3.1', 'Правила в класа', 'Знае и следва договорените правила.', 1301),
  ('social', 'Правила и поведение', 'Г3.2', 'Работа в двойка и група', 'Споделя материали, разпределя роли, довършва общата задача.', 1302),
  ('social', 'Правила и поведение', 'Г3.3', 'Несъгласие и „не“', 'Приема отказ; казва „не“ учтиво; търси решение.', 1303),
  ('social', 'Самостоятелност навън', 'Г4.1', 'Пазаруване', 'Списък, избор, плащане, учтиво общуване с продавача.', 1401),
  ('social', 'Самостоятелност навън', 'Г4.2', 'Безопасност на улицата', 'Пресича правилно, разпознава опасни ситуации.', 1402),
  ('social', 'Самостоятелност навън', 'Г4.3', 'Градски транспорт и ориентиране', 'Спирка, билет, слизане на точното място.', 1403),
  ('social', 'Самостоятелност навън', 'Г4.4', 'Телефон и спешни номера', 'Знае адреса си, телефон на родител, 112.', 1404),
  ('social', 'Ежедневие', 'Г5.1', 'План на деня', 'Следва визуален/писмен график; знае какво следва.', 1501),
  ('social', 'Ежедневие', 'Г5.2', 'Прости задачи вкъщи и в класа', 'Подрежда, сервира, полива — до край.', 1502)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
