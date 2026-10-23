-- Професионално портфолио на педагогическите специалисти (Наредба № 15/2019 — цели, функции и съдържание
-- на професионалното портфолио): общи данни, педагогическа философия, материали по раздели (добри практики,
-- постижения, квалификация, конференции, лично творчество, взаимодействие, принос за МТБ …), цели за развитие
-- и връзка с атестирането — служителят избира записи от портфолиото като доказателства (по желание — към критерий),
-- а атестационната комисия ги вижда при оценяването. Безопасно за повторно пускане.
-- Изисква: 2026-10-23_evaluation.sql и 2026-10-24_evaluation_stages.sql (за връзката с атестирането).

-- Управата (директор, ЗДУД, администратори) вижда портфолиата, освен записите „само за мен“
create or replace function public.pp_is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('director', 'zdud', 'admin')
$$;
grant execute on function public.pp_is_manager() to authenticated;

-- Общи данни и представяне
create table if not exists public.pp_profile (
  staff_id uuid primary key references public.staff_profiles(id) on delete cascade,
  philosophy text,                        -- педагогическа философия / представяне
  about text,                             -- кратко професионално CV
  education jsonb not null default '[]',  -- [{ "level": "Магистър", "school": "…", "specialty": "…", "year": 2010 }]
  specialty text,                         -- специалност по базовото висше образование
  teacher_q boolean,                      -- професионална квалификация „учител“
  other_q text,                           -- друга (нова / допълнителна) квалификация
  pks text,                               -- последна придобита ПКС
  pks_year int,
  work_since date,                        -- начало на общия трудов стаж (за изчисляване)
  teacher_since date,                     -- начало на учителския стаж
  years_extra jsonb,                      -- { "total": 3.5, "teacher": 1 } — стаж, който не е непрекъснат
  strengths text,                         -- силни страни (самоанализ)
  growth text,                            -- области за развитие (самоанализ)
  visibility text not null default 'managers' check (visibility in ('private', 'managers', 'colleagues')),
  updated_at timestamptz not null default now()
);

-- Материали по раздели
create table if not exists public.pp_items (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  section text not null check (section in ('practice', 'results', 'achievements', 'qualification', 'aids', 'events',
    'creative', 'interaction', 'mtb', 'policy', 'feedback', 'other')),
  title text not null,
  body text,                              -- описание
  reflection text,                        -- какво научих / какъв е резултатът (рефлексия)
  date_from date,
  date_to date,
  kind text,                              -- квалификация: internal / external / pks / degree / self; иначе — свободно
  level text,                             -- institution / municipal / regional / national / international
  part_role text,                         -- участник / автор / организатор / ръководител / лектор …
  provider text,                          -- обучаваща организация, издател, организатор
  doc_no text,                            -- № на удостоверение / сертификат
  hours numeric,                          -- академични часове
  credits numeric,                        -- квалификационни кредити
  url text,
  post_id uuid references public.portfolio_posts(id) on delete set null,   -- публикация от стената „Портфолио“
  visibility text not null default 'managers' check (visibility in ('private', 'managers', 'colleagues')),
  featured boolean not null default false,
  created_by uuid default get_my_staff_id() references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pp_items_staff_idx on public.pp_items (staff_id, section, date_from desc);

create table if not exists public.pp_files (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.pp_items(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  name text not null,
  path text not null,                     -- „<staff_id>/<item_id>/<файл>“ в хранилището pro-portfolio
  mime text,
  size bigint,
  created_at timestamptz not null default now()
);
create index if not exists pp_files_item_idx on public.pp_files (item_id);

-- Цели за професионално развитие (развиваща функция)
create table if not exists public.pp_goals (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  area text,
  goal text not null,
  actions text,
  indicator text,                         -- как ще разбера, че съм я постигнал/а
  due date,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'dropped')),
  reflection text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pp_goals_staff_idx on public.pp_goals (staff_id);

-- Доказателства за атестирането: кой запис от портфолиото към коя карта (и по желание — към кой критерий)
create table if not exists public.pp_eval_links (
  participant_id uuid not null references public.eval_participants(id) on delete cascade,
  item_id uuid not null references public.pp_items(id) on delete cascade,
  criterion text not null default '',     -- ключ на критерия („1.2“) или '' — общо
  note text,
  created_at timestamptz not null default now(),
  primary key (participant_id, item_id, criterion)
);
create index if not exists pp_eval_links_item_idx on public.pp_eval_links (item_id);

-- ── Права ─────────────────────────────────────────────────────────────────
create or replace function public.pp_owns_item(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pp_items i where i.id = p_item and (i.staff_id = get_my_staff_id() or pp_is_manager()))
$$;
grant execute on function public.pp_owns_item(uuid) to authenticated;

-- Атестационната комисия, секретарят и организаторите (без счетоводството) виждат портфолиото на атестирания
create or replace function public.pp_eval_viewer(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eval_is_manager() or eval_on_commission(p_campaign) or eval_is_secretary(p_campaign)
$$;
grant execute on function public.pp_eval_viewer(uuid) to authenticated;

create or replace function public.pp_commission_sees(p_staff uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from eval_participants p join eval_campaigns c on c.id = p.campaign_id
                 where p.staff_id = p_staff and c.kind = 'attest' and c.status <> 'closed' and pp_eval_viewer(c.id))
$$;
grant execute on function public.pp_commission_sees(uuid) to authenticated;

-- Записът е посочен като доказателство в карта, която виждащият може да вижда
create or replace function public.pp_linked_visible(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pp_eval_links l where l.item_id = p_item and pp_eval_viewer(eval_campaign_of(l.participant_id)))
$$;
grant execute on function public.pp_linked_visible(uuid) to authenticated;

create or replace function public.pp_can_see_item(p_item uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pp_items i where i.id = p_item and (
    i.staff_id = get_my_staff_id() or i.created_by = get_my_staff_id()
    or i.visibility = 'colleagues'
    or (i.visibility = 'managers' and (pp_is_manager() or pp_commission_sees(i.staff_id)))
    or pp_linked_visible(i.id)))
$$;
grant execute on function public.pp_can_see_item(uuid) to authenticated;

alter table public.pp_profile enable row level security;
alter table public.pp_items enable row level security;
alter table public.pp_files enable row level security;
alter table public.pp_goals enable row level security;
alter table public.pp_eval_links enable row level security;

drop policy if exists "pp_profile_read" on public.pp_profile;
create policy "pp_profile_read" on public.pp_profile for select to authenticated
  using (staff_id = get_my_staff_id() or visibility = 'colleagues'
    or (visibility = 'managers' and pp_is_manager()) or pp_commission_sees(staff_id));
drop policy if exists "pp_profile_write" on public.pp_profile;
create policy "pp_profile_write" on public.pp_profile for all to authenticated
  using (staff_id = get_my_staff_id() or pp_is_manager()) with check (staff_id = get_my_staff_id() or pp_is_manager());

-- Собственикът и авторът на записа са проверени направо (иначе insert … returning не минава)
drop policy if exists "pp_items_read" on public.pp_items;
create policy "pp_items_read" on public.pp_items for select to authenticated
  using (staff_id = get_my_staff_id() or created_by = get_my_staff_id() or pp_can_see_item(id));
drop policy if exists "pp_items_insert" on public.pp_items;
create policy "pp_items_insert" on public.pp_items for insert to authenticated
  with check (created_by = get_my_staff_id() and (staff_id = get_my_staff_id() or pp_is_manager()));
drop policy if exists "pp_items_update" on public.pp_items;
create policy "pp_items_update" on public.pp_items for update to authenticated
  using (staff_id = get_my_staff_id() or pp_is_manager()) with check (staff_id = get_my_staff_id() or pp_is_manager());
drop policy if exists "pp_items_delete" on public.pp_items;
create policy "pp_items_delete" on public.pp_items for delete to authenticated
  using (staff_id = get_my_staff_id() or pp_is_manager());

drop policy if exists "pp_files_read" on public.pp_files;
create policy "pp_files_read" on public.pp_files for select to authenticated
  using (staff_id = get_my_staff_id() or pp_can_see_item(item_id));
drop policy if exists "pp_files_insert" on public.pp_files;
create policy "pp_files_insert" on public.pp_files for insert to authenticated
  with check (pp_owns_item(item_id));
drop policy if exists "pp_files_delete" on public.pp_files;
create policy "pp_files_delete" on public.pp_files for delete to authenticated
  using (pp_owns_item(item_id));

drop policy if exists "pp_goals_read" on public.pp_goals;
create policy "pp_goals_read" on public.pp_goals for select to authenticated
  using (staff_id = get_my_staff_id() or pp_is_manager() or pp_commission_sees(staff_id));
drop policy if exists "pp_goals_write" on public.pp_goals;
create policy "pp_goals_write" on public.pp_goals for all to authenticated
  using (staff_id = get_my_staff_id()) with check (staff_id = get_my_staff_id());

-- Връзките: вижда ги лицето и който вижда кампанията; добавя/маха ги лицето, докато самооценката е отворена
drop policy if exists "pp_eval_links_read" on public.pp_eval_links;
create policy "pp_eval_links_read" on public.pp_eval_links for select to authenticated
  using (eval_is_mine(participant_id) or pp_eval_viewer(eval_campaign_of(participant_id)));
drop policy if exists "pp_eval_links_insert" on public.pp_eval_links;
create policy "pp_eval_links_insert" on public.pp_eval_links for insert to authenticated
  with check (eval_is_mine(participant_id) and eval_can_upload(participant_id)
    and exists (select 1 from pp_items i where i.id = item_id and i.staff_id = get_my_staff_id()));
drop policy if exists "pp_eval_links_update" on public.pp_eval_links;
create policy "pp_eval_links_update" on public.pp_eval_links for update to authenticated
  using (eval_is_mine(participant_id) and eval_can_upload(participant_id))
  with check (eval_is_mine(participant_id) and eval_can_upload(participant_id));
drop policy if exists "pp_eval_links_delete" on public.pp_eval_links;
create policy "pp_eval_links_delete" on public.pp_eval_links for delete to authenticated
  using (eval_is_mine(participant_id) and eval_can_upload(participant_id));

-- ── Данни от ЕИС за периода (оценяваща функция): контролна дейност, дейности, предишни оценки ────────
create or replace function public.pp_evidence(p_staff uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare checks jsonb := '[]'; counts jsonb; evals jsonb := '[]';
begin
  if not (p_staff = get_my_staff_id() or pp_is_manager() or pp_commission_sees(p_staff)) then raise exception 'Нямате права'; end if;
  if to_regclass('public.control_checks') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', k.id, 'date', k.check_date, 'book_no', k.book_no, 'subject', k.subject,
        'inspector', (select s.first_name || ' ' || s.last_name from staff_profiles s where s.id = k.inspector_id),
        'strengths', k.strengths, 'conclusions', k.conclusions) order by k.check_date desc), '[]')
      into checks
      from control_check_staff cs join control_checks k on k.id = cs.check_id
     where cs.staff_id = p_staff and k.status = 'signed' and k.check_date between p_from and p_to;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'kind', c.kind, 'total', p.final_total, 'result', p.result,
      'grade', coalesce(p.employer_grade, p.grade), 'at', coalesce(p.employer_at, p.acked_at, p.finalized_at)) order by c.created_at desc), '[]')
    into evals
    from eval_participants p join eval_campaigns c on c.id = p.campaign_id
   where p.staff_id = p_staff and p.final_total is not null and p.sent_at is not null
     and coalesce(p.finalized_at, p.created_at)::date between p_from and p_to + 365;
  counts := jsonb_build_array(
    jsonb_build_object('k', 'portfolio', 'l', 'Публикации в „Портфолио“', 'n', eval_count('portfolio_posts', 'author_id', 'coalesce(event_date, created_at::date)', p_staff, p_from, p_to)),
    jsonb_build_object('k', 'site', 'l', '…от тях на сайта', 'n', eval_count('portfolio_posts', 'author_id', 'coalesce(event_date, created_at::date)', p_staff, p_from, p_to, 'site_published_at is not null')),
    jsonb_build_object('k', 'materials', 'l', 'Споделени материали', 'n', eval_count('materials', 'uploaded_by', 'created_at', p_staff, p_from, p_to)),
    jsonb_build_object('k', 'room', 'l', 'Публикации в класната стая', 'n', eval_count('class_room_posts', 'author_id', 'created_at', p_staff, p_from, p_to)),
    jsonb_build_object('k', 'dtt', 'l', 'Сесии ABA (DTT)', 'n', eval_count('dtt_sessions', 'staff_id', 'held_on', p_staff, p_from, p_to)),
    jsonb_build_object('k', 'pecs', 'l', 'Сесии PECS', 'n', eval_count('pecs_sessions', 'staff_id', 'held_on', p_staff, p_from, p_to)),
    jsonb_build_object('k', 'remelka', 'l', 'Сесии „Ремелка“', 'n', eval_count('remelka_sessions', 'staff_id', 'held_on', p_staff, p_from, p_to)),
    jsonb_build_object('k', 'dev', 'l', 'Оценки на развитието', 'n', eval_count('dev_assessments', 'assessor_id', 'assessed_on', p_staff, p_from, p_to)),
    jsonb_build_object('k', 'motor', 'l', 'Двигателни оценки', 'n', eval_count('motor_sessions', 'assessor_id', 'assessed_on', p_staff, p_from, p_to))
  );
  return jsonb_build_object('from', p_from, 'to', p_to, 'checks', checks, 'counts', counts, 'evals', evals);
end $$;
grant execute on function public.pp_evidence(uuid, date, date) to authenticated;

-- ── Хранилище: „<staff_id>/<item_id>/<файл>“ ─────────────────────────────
insert into storage.buckets (id, name, public) values ('pro-portfolio', 'pro-portfolio', false)
on conflict (id) do nothing;

drop policy if exists "pro_portfolio_read" on storage.objects;
create policy "pro_portfolio_read" on storage.objects for select to authenticated
  using (bucket_id = 'pro-portfolio' and (
    (storage.foldername(name))[1] = get_my_staff_id()::text
    or exists (select 1 from public.pp_files f where f.path = name and pp_can_see_item(f.item_id))));
drop policy if exists "pro_portfolio_insert" on storage.objects;
create policy "pro_portfolio_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'pro-portfolio' and ((storage.foldername(name))[1] = get_my_staff_id()::text or pp_is_manager()));
drop policy if exists "pro_portfolio_delete" on storage.objects;
create policy "pro_portfolio_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'pro-portfolio' and ((storage.foldername(name))[1] = get_my_staff_id()::text or pp_is_manager()));
