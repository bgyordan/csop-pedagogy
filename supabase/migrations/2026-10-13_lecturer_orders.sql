-- Лекторски: коя заповед от регистъра важи за всеки служител през учебната година.
-- По една на вид: 'over' — над норматив (учители, логопеди…), 'ifo' — ИФО часовете (отделна заповед).
-- Зарежда се веднъж в „Лекторски часове“; декларациите вземат номера и датата оттук всеки месец.
-- Безопасно за повторно пускане.
create table if not exists public.lecturer_orders (
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  kind text not null check (kind in ('over', 'ifo')),
  order_id uuid not null references public.orders(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (academic_year_id, staff_id, kind)
);
alter table public.lecturer_orders enable row level security;
drop policy if exists "lecturer_orders_read" on public.lecturer_orders;
create policy "lecturer_orders_read" on public.lecturer_orders for select to authenticated using (true);
drop policy if exists "lecturer_orders_write" on public.lecturer_orders;
create policy "lecturer_orders_write" on public.lecturer_orders for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));
notify pgrst, 'reload schema';
