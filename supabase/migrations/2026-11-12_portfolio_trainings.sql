-- Професионално портфолио — регистър на вътрешните обучения (методически обучения, семинари в ЦСОП и др.).
-- ЗДУД/директорът вписва обучението веднъж — с тема, дата, часове, лектор и участници — и то се появява само
-- в портфолиото на всеки участник (раздел „Квалификация“, с часовете). Промяна на обучението обновява всички;
-- изтриването маха записите от портфолиата. Изисква 2026-10-26_pro_portfolio.sql. Безопасно за повторно пускане.
create table if not exists public.pp_trainings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date_from date not null,
  date_to date,
  hours numeric,                                   -- академични часове
  provider text default 'ЦСОП – Варна',            -- организатор
  lecturer text,                                   -- лектор / водещ
  kind text not null default 'internal' check (kind in ('internal', 'external', 'self')),
  note text,
  created_by uuid default get_my_staff_id() references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pp_trainings_date_idx on public.pp_trainings (date_from desc);

alter table public.pp_items add column if not exists training_id uuid references public.pp_trainings(id) on delete cascade;
create index if not exists pp_items_training_idx on public.pp_items (training_id) where training_id is not null;

alter table public.pp_trainings enable row level security;
drop policy if exists "pp_trainings_read" on public.pp_trainings;
create policy "pp_trainings_read" on public.pp_trainings for select to authenticated using (true);
drop policy if exists "pp_trainings_write" on public.pp_trainings;
create policy "pp_trainings_write" on public.pp_trainings for all to authenticated
  using (pp_is_manager()) with check (pp_is_manager());
