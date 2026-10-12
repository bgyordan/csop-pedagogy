-- Дежурства: кой е „В графика“ за учебната година.
-- Без ред тук важи подразбирането по роля (учител, класен ръководител, логопед);
-- ред с included=true/false го включва или изключва изрично.
-- Безопасно за повторно пускане.
create table if not exists public.duty_pool (
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  included boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (academic_year_id, staff_id)
);
alter table public.duty_pool enable row level security;
drop policy if exists "duty_pool_read" on public.duty_pool;
create policy "duty_pool_read" on public.duty_pool for select to authenticated using (true);
drop policy if exists "duty_pool_write" on public.duty_pool;
create policy "duty_pool_write" on public.duty_pool for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary'));
notify pgrst, 'reload schema';
