-- Портфолио: чернови — публикация, която вижда само авторът (и съавторите на проект от същата паралелка),
-- докато не я публикува. Съществуващите остават публикувани. Безопасно за повторно пускане.
alter table public.portfolio_posts add column if not exists is_shared boolean not null default true;

-- Кой вижда публикацията: публикуваните — всички; черновата — авторът и класните на свързаните паралелки (при проект)
create or replace function public.portfolio_can_see(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from portfolio_posts p
    where p.id = p_post and (
      p.is_shared
      or p.author_id = get_my_staff_id()
      or (p.kind = 'project' and exists (
        select 1 from portfolio_post_classes pc
        join class_teacher_assignments cta on cta.class_id = pc.class_id
        where pc.post_id = p.id and cta.staff_id = get_my_staff_id()))
    ))
$$;
grant execute on function public.portfolio_can_see(uuid) to authenticated;

drop policy if exists "portfolio_posts_read" on public.portfolio_posts;
create policy "portfolio_posts_read" on public.portfolio_posts for select to authenticated
  using (is_shared or author_id = get_my_staff_id() or portfolio_can_see(id));

drop policy if exists "portfolio_media_read" on public.portfolio_media;
create policy "portfolio_media_read" on public.portfolio_media for select to authenticated
  using (portfolio_can_see(post_id));

drop policy if exists "portfolio_classes_read" on public.portfolio_post_classes;
create policy "portfolio_classes_read" on public.portfolio_post_classes for select to authenticated
  using (portfolio_can_see(post_id));
