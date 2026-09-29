-- „Запознах се“ с материалите за съгласуване (педагогически съвет и др.).
-- Един ред на служител и комплект; при повторно натискане се обновява датата.
-- Безопасно за повторно пускане. Без таблицата страницата работи, само без „Запознах се“.
create table if not exists public.council_acks (
  set_id uuid not null references public.council_sets(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  acked_at timestamptz not null default now(),
  primary key (set_id, staff_id)
);

alter table public.council_acks enable row level security;
drop policy if exists "council_acks_read" on public.council_acks;
create policy "council_acks_read" on public.council_acks for select using (true);
drop policy if exists "council_acks_own" on public.council_acks;
create policy "council_acks_own" on public.council_acks for all
  using (staff_id = get_my_staff_id())
  with check (staff_id = get_my_staff_id());
