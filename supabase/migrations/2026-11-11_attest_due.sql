-- Атестиране: кой подлежи (регистър и „Добави подлежащите“ в кампанията).
-- 1) Отложени — напр. дълъг болничен или отпуск над 1 година (чл. 78, ал. 1 от Наредба № 15/2019):
--    въвеждат се от регистъра с причина; такива лица не се предлагат за кампанията, докато не се махне отлагането.
-- 2) Годината на постъпване от импорта от НЕИСПУО (pp_profile.neispuo.since_year) — за лицата без въведено
--    атестиране (правилото за 2 години в институцията, чл. 78, ал. 4–5). Функцията е само за организаторите,
--    за да не зависи от видимостта на портфолиото.
-- Пуска се след 2026-10-24_evaluation_stages.sql и 2026-10-31_neispuo_staff_import.sql. Безопасно за повторно пускане.

create table if not exists public.eval_attest_defer (
  staff_id uuid primary key references public.staff_profiles(id) on delete cascade,
  reason text not null,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.eval_attest_defer enable row level security;
drop policy if exists "eval_attest_defer_read" on public.eval_attest_defer;
create policy "eval_attest_defer_read" on public.eval_attest_defer for select to authenticated
  using (eval_is_manager());
drop policy if exists "eval_attest_defer_write" on public.eval_attest_defer;
create policy "eval_attest_defer_write" on public.eval_attest_defer for all to authenticated
  using (eval_is_manager()) with check (eval_is_manager());

create or replace function public.eval_staff_since() returns table (staff_id uuid, since_year int)
language sql stable security definer set search_path = public as $$
  select p.staff_id, (p.neispuo->>'since_year')::int
  from pp_profile p
  where eval_is_manager() and (p.neispuo->>'since_year') ~ '^\d{4}$'
$$;
grant execute on function public.eval_staff_since() to authenticated;
