-- Ставки за лекторски час (€) — въвеждат се от управата / деловодството, без промяна на кода.
-- unified = заместването от бюджета е със същата ставка като над норматив (по ВПРЗ няма разлика);
-- np_same = заместването по НП „Без свободен час“ е със същата ставка. Без отметките — отделни ставки.
create table if not exists public.lecturer_rates (
  id smallint primary key default 1 check (id = 1),
  unified boolean not null default true,
  rate_over numeric(6,2) not null default 6.29,   -- над норматив (и общата при unified)
  rate_sub numeric(6,2) not null default 6.29,    -- заместване от бюджета (когато не е unified)
  np_same boolean not null default false,
  rate_np numeric(6,2) not null default 7.38,     -- заместване по НП (когато не е np_same)
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff_profiles(id) on delete set null
);
insert into public.lecturer_rates (id) values (1) on conflict (id) do nothing;

alter table public.lecturer_rates enable row level security;
drop policy if exists lecturer_rates_read on public.lecturer_rates;
create policy lecturer_rates_read on public.lecturer_rates for select to authenticated using (true);
drop policy if exists lecturer_rates_write on public.lecturer_rates;
create policy lecturer_rates_write on public.lecturer_rates for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary'));

notify pgrst, 'reload schema';
