-- Отпуск по няколко члена от КТ в едно заместване (напр. 2 дни чл. 155 + 2 дни чл. 160).
-- substitutions.kt_article е основният член за целия период; тук са частите от периода с ДРУГ член.
-- Всеки учебен ден взима члена на частта, в която попада, иначе основния.
-- Безопасно за повторно пускане.
create table if not exists public.substitution_kt_parts (
  id uuid primary key default gen_random_uuid(),
  substitution_id uuid not null references public.substitutions(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  kt_article text not null,
  created_at timestamptz not null default now()
);
create index if not exists substitution_kt_parts_sub_idx on public.substitution_kt_parts (substitution_id);

alter table public.substitution_kt_parts enable row level security;
drop policy if exists "kt_parts_read" on public.substitution_kt_parts;
create policy "kt_parts_read" on public.substitution_kt_parts for select to authenticated using (true);
drop policy if exists "kt_parts_write" on public.substitution_kt_parts;
create policy "kt_parts_write" on public.substitution_kt_parts for all to authenticated
  using (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary'))
  with check (get_my_role()::text in ('admin', 'zdud', 'director', 'secretary'));
notify pgrst, 'reload schema';
