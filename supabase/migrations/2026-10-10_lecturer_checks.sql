-- „Отчитане лекторски“ — отметките по ХАРТИЕНАТА декларация (самата декларация не се пази).
-- Един ред = служител × вид × период: получена → проверена (ОК / несъответствие) → изплатена.
-- Безопасно за повторно пускане.
create table if not exists public.lecturer_checks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  kind text not null check (kind in ('over', 'sub_budget', 'sub_np')),
  period_from date not null,
  period_to date not null,
  received_at timestamptz,
  received_by uuid references staff_profiles(id) on delete set null,
  status text check (status in ('ok', 'issue')),
  note text,
  hours_at_check numeric,
  checked_at timestamptz,
  checked_by uuid references staff_profiles(id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references staff_profiles(id) on delete set null,
  unique (staff_id, kind, period_from, period_to)
);
alter table public.lecturer_checks enable row level security;
drop policy if exists "lecturer_checks read" on public.lecturer_checks;
create policy "lecturer_checks read" on public.lecturer_checks for select using (
  staff_id in (select id from staff_profiles where user_id = auth.uid())
  or exists (select 1 from staff_profiles where user_id = auth.uid() and role in ('admin','zdud','director','secretary'))
);
drop policy if exists "lecturer_checks write" on public.lecturer_checks;
create policy "lecturer_checks write" on public.lecturer_checks for all using (
  exists (select 1 from staff_profiles where user_id = auth.uid() and role in ('admin','zdud','director','secretary'))
) with check (
  exists (select 1 from staff_profiles where user_id = auth.uid() and role in ('admin','zdud','director','secretary'))
);
notify pgrst, 'reload schema';
