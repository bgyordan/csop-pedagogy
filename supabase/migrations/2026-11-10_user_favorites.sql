-- „Любими“ страници в менюто — пазят се в базата, за да са еднакви на всяко устройство.
-- Един ред на потребител; всеки вижда и променя само своя.
create table if not exists public.user_favorites (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_favorites enable row level security;
drop policy if exists "user_favorites_own" on public.user_favorites;
create policy "user_favorites_own" on public.user_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
notify pgrst, 'reload schema';
