-- АБА в досието на детето:
--  1) ABC картон — бърз запис на поведение (предистория → поведение → последствие, интензитет 1–5) за минута,
--     с анализ само за това дете. Ежедневен работен инструмент на екипа; тежките случаи продължават да се
--     вписват в „Дневник на случаите“ (incident_cases) — двете не се смесват.
--  2) DTT (дискретни опити) — цели, сесии с опити + / − / P, автоматично „Усвоено“ по критерий (напр. 80% в 3 поредни сесии).
-- Достъп: works_with_student (от PECS) — класен, учители, ЦОУД, терапевти, ЕПЛР екип, координатори, ръководство.
-- Безопасно за повторно пускане.

-- ── ABC картон ──
create table if not exists public.abc_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  occurred_on date not null default current_date,
  occurred_time time,
  place text,
  antecedent text not null,              -- A: какво предшества
  behavior text not null,                -- B: какво направи детето
  consequence text not null,             -- C: какво последва
  intensity smallint not null check (intensity between 1 and 5),
  note text,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists abc_records_idx on public.abc_records (student_id, occurred_on);

-- ── DTT: цели ──
create table if not exists public.dtt_targets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  title text not null,                   -- „Посочва червения цвят сред 3 опции“
  area text,                             -- област (цветове, имитация, самообслужване…)
  criterion_pct smallint not null default 80 check (criterion_pct between 50 and 100),
  criterion_sessions smallint not null default 3 check (criterion_sessions between 1 and 10),
  trials_per_session smallint not null default 10 check (trials_per_session between 1 and 30),
  status text not null default 'active' check (status in ('active', 'mastered', 'paused')),
  added_on date not null default current_date,
  mastered_on date,
  added_by uuid references public.staff_profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists dtt_targets_idx on public.dtt_targets (student_id, status);

-- ── DTT: сесии — опитите като низ от „+“, „-“, „P“ (в реда на провеждане) ──
create table if not exists public.dtt_sessions (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.dtt_targets(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  held_on date not null default current_date,
  marks text not null check (marks ~ '^[+P-]+$'),
  staff_id uuid references public.staff_profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists dtt_sessions_idx on public.dtt_sessions (target_id, held_on);

-- ── Достъп: само който работи с детето (+ координатори и ръководство) ──
do $$
declare t text;
begin
  foreach t in array array['abc_records', 'dtt_targets', 'dtt_sessions'] loop
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
-- триене: записите и сесиите — авторът или ръководството; целите — екипът
create policy "abc_records_delete" on public.abc_records for delete to authenticated
  using (works_with_student(student_id) and (staff_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director')));
create policy "dtt_sessions_delete" on public.dtt_sessions for delete to authenticated
  using (works_with_student(student_id) and (staff_id = get_my_staff_id() or get_my_role()::text in ('admin', 'zdud', 'director')));
create policy "dtt_targets_delete" on public.dtt_targets for delete to authenticated using (works_with_student(student_id));

notify pgrst, 'reload schema';
