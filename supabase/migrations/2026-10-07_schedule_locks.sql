-- Утвърдено седмично разписание за срок: след заключване учителите не могат да променят своите часове
-- (редакторът и копирането от I срок спират); управата (админ, ЗДУД, директор) може.
create table if not exists public.schedule_locks (
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  term smallint not null check (term in (1, 2)),
  locked_at timestamptz not null default now(),
  locked_by uuid references public.staff_profiles(id) on delete set null,
  primary key (academic_year_id, term)
);

alter table public.schedule_locks enable row level security;
drop policy if exists schedule_locks_read on public.schedule_locks;
create policy schedule_locks_read on public.schedule_locks for select to authenticated using (true);
drop policy if exists schedule_locks_write on public.schedule_locks;
create policy schedule_locks_write on public.schedule_locks for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director'));

notify pgrst, 'reload schema';
