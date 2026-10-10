-- „Влез като…“ — дневник кой админ като кого е влизал. Пише само сървърът (service role).
-- Безопасно за повторно пускане.
create table if not exists public.impersonation_log (
  id bigserial primary key,
  admin_staff_id uuid references staff_profiles(id) on delete set null,
  target_staff_id uuid references staff_profiles(id) on delete set null,
  started_at timestamptz not null default now()
);
alter table public.impersonation_log enable row level security;
drop policy if exists "impersonation_log admin read" on public.impersonation_log;
create policy "impersonation_log admin read" on public.impersonation_log for select
  using (exists (select 1 from staff_profiles where user_id = auth.uid() and role = 'admin'));
notify pgrst, 'reload schema';
