-- Генератор на заповеди (Деловодство → Заповеди → Генератор).
-- Чернови и „мои шаблони“: попълнените данни по шаблон + ръчно редактираният текст.
-- При „Впиши в Книгата“ се създава ред в orders (номер по деловодната година) и черновата се свързва с него.
-- Безопасно за повторно пускане.
create table if not exists public.order_drafts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'draft' check (kind in ('draft', 'template')),
  template_key text not null,
  title text not null default '',
  name text,                    -- име на „мой шаблон“ (kind = 'template')
  data jsonb not null default '{}'::jsonb,   -- полетата от формата
  body jsonb,                   -- ръчно редактиран текст; null = автоматичен от шаблона
  order_date date,
  order_id uuid references public.orders(id) on delete set null,
  order_number text,
  registered_at timestamptz,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_drafts_updated_idx on public.order_drafts (updated_at desc);
create index if not exists order_drafts_order_idx on public.order_drafts (order_id);

alter table public.order_drafts enable row level security;
-- Ръководството и деловодството работят заедно по черновите (както по Книгата за заповеди).
drop policy if exists "order_drafts_rw" on public.order_drafts;
create policy "order_drafts_rw" on public.order_drafts for all to authenticated
  using (get_my_role()::text in ('admin', 'director', 'zdud', 'zdasd', 'secretary'))
  with check (get_my_role()::text in ('admin', 'director', 'zdud', 'zdasd', 'secretary'));

notify pgrst, 'reload schema';
