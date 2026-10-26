-- Портфолио: дати и събития към публикация (проект, кабинет, събитие, материал).
-- Напр. проект „Есенна работилница“ → „Открит урок“ на 15.11, „Изложба за родителите“ на 03.12.
-- Акцентираните дати излизат с отличителен знак на картата, в лентата „Предстоящи събития“
-- на портфолиото и в календара (слой „Събития от портфолиото“).
-- Кой ги вижда и кой ги пише — както самата публикация (portfolio_can_see / portfolio_can_edit).
-- Безопасно за повторно пускане.

create table if not exists public.portfolio_dates (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.portfolio_posts(id) on delete cascade,
  date date not null,
  time_from time,
  time_to time,
  title text not null,
  place text,
  note text,
  highlight boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_dates_post_idx on public.portfolio_dates (post_id, date);
create index if not exists portfolio_dates_date_idx on public.portfolio_dates (date) where highlight;

alter table public.portfolio_dates enable row level security;

drop policy if exists "portfolio_dates_read" on public.portfolio_dates;
create policy "portfolio_dates_read" on public.portfolio_dates for select to authenticated
  using (portfolio_can_see(post_id));

drop policy if exists "portfolio_dates_write" on public.portfolio_dates;
create policy "portfolio_dates_write" on public.portfolio_dates for all to authenticated
  using (portfolio_can_edit(post_id)) with check (portfolio_can_edit(post_id));
