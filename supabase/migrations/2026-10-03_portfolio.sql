-- ПОРТФОЛИО: публикации на колегите (кабинет, проект, събитие, материал) с текст, снимки и файлове.
-- „Моето портфолио“ + обща стена „Портфолио на ЦСОП“; „Предложи за сайта“ → опашка при деловодителя.
-- Старите „Проекти“ (class_projects) се КОПИРАТ тук; старите таблици остават непокътнати.
-- Безопасно за повторно пускане.

create table if not exists public.portfolio_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.staff_profiles(id) on delete set null,
  kind text not null default 'cabinet' check (kind in ('cabinet', 'project', 'event', 'material')),
  title text not null,
  body text,
  cover_path text,
  event_date date,
  ideas text, activities text, goals text,
  period_from date, period_to date,
  status text check (status in ('idea', 'in_progress', 'done')),
  academic_year_id uuid references public.academic_years(id) on delete set null,
  site_status text not null default 'none' check (site_status in ('none', 'requested', 'published', 'declined')),
  site_consent boolean not null default false,
  site_note text,
  site_reply text,
  site_news_id uuid,
  site_requested_at timestamptz,
  site_published_at timestamptz,
  legacy_project_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portfolio_posts_created_idx on public.portfolio_posts (created_at desc);
create index if not exists portfolio_posts_site_idx on public.portfolio_posts (site_status);

create table if not exists public.portfolio_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.portfolio_posts(id) on delete cascade,
  path text not null,
  thumb_path text,
  name text,
  mime text,
  size bigint,
  caption text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_media_post_idx on public.portfolio_media (post_id, sort);

create table if not exists public.portfolio_post_classes (
  post_id uuid not null references public.portfolio_posts(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  primary key (post_id, class_id)
);

-- Кой може да редактира: авторът, управата, а при проект — и класните на свързаните паралелки
create or replace function public.portfolio_can_edit(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from portfolio_posts p
    where p.id = p_post and (
      p.author_id = get_my_staff_id()
      or get_my_role() in ('admin', 'zdud', 'director')
      or (p.kind = 'project' and exists (
        select 1 from portfolio_post_classes pc
        join class_teacher_assignments cta on cta.class_id = pc.class_id
        where pc.post_id = p.id and cta.staff_id = get_my_staff_id()))
    ))
$$;
grant execute on function public.portfolio_can_edit(uuid) to authenticated;

-- Деловодителят/управата отбелязват докъде е публикацията за сайта
create or replace function public.portfolio_set_site_status(p_post uuid, p_status text, p_news uuid default null, p_reply text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if get_my_role() not in ('admin', 'zdud', 'director', 'secretary') then raise exception 'Нямате права'; end if;
  if p_status not in ('requested', 'published', 'declined') then raise exception 'Невалиден статус'; end if;
  update portfolio_posts set
    site_status = p_status,
    site_news_id = coalesce(p_news, site_news_id),
    site_reply = case when p_status = 'declined' then p_reply else site_reply end,
    site_published_at = case when p_status = 'published' then now() else site_published_at end
  where id = p_post;
end $$;
grant execute on function public.portfolio_set_site_status(uuid, text, uuid, text) to authenticated;

alter table public.portfolio_posts enable row level security;
alter table public.portfolio_media enable row level security;
alter table public.portfolio_post_classes enable row level security;

drop policy if exists "portfolio_posts_read" on public.portfolio_posts;
create policy "portfolio_posts_read" on public.portfolio_posts for select to authenticated using (true);
drop policy if exists "portfolio_posts_insert" on public.portfolio_posts;
create policy "portfolio_posts_insert" on public.portfolio_posts for insert to authenticated
  with check (author_id = get_my_staff_id());
drop policy if exists "portfolio_posts_update" on public.portfolio_posts;
create policy "portfolio_posts_update" on public.portfolio_posts for update to authenticated
  using (portfolio_can_edit(id)) with check (true);
drop policy if exists "portfolio_posts_delete" on public.portfolio_posts;
create policy "portfolio_posts_delete" on public.portfolio_posts for delete to authenticated
  using (author_id = get_my_staff_id() or get_my_role() in ('admin', 'zdud', 'director'));

drop policy if exists "portfolio_media_read" on public.portfolio_media;
create policy "portfolio_media_read" on public.portfolio_media for select to authenticated using (true);
drop policy if exists "portfolio_media_write" on public.portfolio_media;
create policy "portfolio_media_write" on public.portfolio_media for all to authenticated
  using (portfolio_can_edit(post_id)) with check (portfolio_can_edit(post_id));

drop policy if exists "portfolio_classes_read" on public.portfolio_post_classes;
create policy "portfolio_classes_read" on public.portfolio_post_classes for select to authenticated using (true);
drop policy if exists "portfolio_classes_write" on public.portfolio_post_classes;
create policy "portfolio_classes_write" on public.portfolio_post_classes for all to authenticated
  using (portfolio_can_edit(post_id)) with check (portfolio_can_edit(post_id));

-- Хранилище за снимките и файловете (частно — вижда се само от влезли служители)
insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', false)
on conflict (id) do nothing;

drop policy if exists "portfolio_files_read" on storage.objects;
create policy "portfolio_files_read" on storage.objects for select to authenticated
  using (bucket_id = 'portfolio');
drop policy if exists "portfolio_files_insert" on storage.objects;
create policy "portfolio_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio');
drop policy if exists "portfolio_files_delete" on storage.objects;
create policy "portfolio_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and (owner = auth.uid() or get_my_role() in ('admin', 'zdud', 'director')));

-- Пренасяне на съществуващите „Проекти“ (без да се трият старите)
do $$
begin
  if to_regclass('public.class_projects') is not null then
    insert into public.portfolio_posts
      (author_id, kind, title, ideas, activities, goals, period_from, period_to, status, academic_year_id, legacy_project_id, created_at, updated_at)
    select s.id, 'project', coalesce(nullif(trim(cp.title), ''), 'Проект'), cp.ideas, cp.activities, cp.goals,
           cp.period_from, cp.period_to,
           case when cp.status in ('idea', 'in_progress', 'done') then cp.status else 'idea' end,
           cp.academic_year_id, cp.id, coalesce(cp.created_at, now()), coalesce(cp.created_at, now())
    from public.class_projects cp
    left join public.staff_profiles s on s.id = cp.created_by
    on conflict (legacy_project_id) do nothing;

    if to_regclass('public.class_project_classes') is not null then
      insert into public.portfolio_post_classes (post_id, class_id)
      select p.id, cpc.class_id
      from public.class_project_classes cpc
      join public.portfolio_posts p on p.legacy_project_id = cpc.project_id
      on conflict do nothing;
    end if;
  end if;
end $$;
