-- Смяна на имейла за вход на служител (от „Служители“ → Редактирай → Имейл).
-- Дневник: кой, на кого, от какъв на какъв имейл. Пише само сървърът (service role).
-- Безопасно за повторно пускане.
create table if not exists public.login_email_log (
  id bigserial primary key,
  staff_id uuid references staff_profiles(id) on delete set null,
  old_email text,
  new_email text not null,
  auth_changed boolean not null default false, -- сменен ли е и акаунтът за вход (не само профилът)
  changed_by uuid references staff_profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table public.login_email_log enable row level security;
drop policy if exists "login_email_log admin read" on public.login_email_log;
create policy "login_email_log admin read" on public.login_email_log for select
  using (exists (select 1 from staff_profiles where user_id = auth.uid() and role in ('admin', 'director')));
notify pgrst, 'reload schema';
