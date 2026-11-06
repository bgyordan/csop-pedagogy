-- Корекциите на колегата по декларациите му за период („Редакция“ в „Моите лекторски“):
-- махнати/върнати дни над норматив, часове по замествания, ръчно добавени замествания.
-- Пазят се, за да не се губят при ново влизане. Безопасно за повторно пускане.
create table if not exists public.declaration_edits (
  staff_id    uuid not null references public.staff_profiles(id) on delete cascade,
  period_from date not null,
  period_to   date not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (staff_id, period_from, period_to)
);
alter table public.declaration_edits enable row level security;

drop policy if exists declaration_edits_read on public.declaration_edits;
create policy declaration_edits_read on public.declaration_edits for select to authenticated using (
  staff_id in (select id from public.staff_profiles where user_id = auth.uid())
  or exists (select 1 from public.staff_profiles where user_id = auth.uid() and role in ('admin', 'zdud', 'director', 'secretary'))
);
drop policy if exists declaration_edits_write on public.declaration_edits;
create policy declaration_edits_write on public.declaration_edits for all to authenticated
  using (staff_id in (select id from public.staff_profiles where user_id = auth.uid()))
  with check (staff_id in (select id from public.staff_profiles where user_id = auth.uid()));

grant select, insert, update, delete on public.declaration_edits to authenticated;
notify pgrst, 'reload schema';
