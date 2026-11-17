-- „Кабинети и дейности“: съвместна дейност и със специалисти — напр. паралелка 14 + логопед + рехабилитатор.
-- Добавените колеги виждат проекта/събитието като свое и могат да го редактират.
-- Безопасно за повторно пускане.
create table if not exists public.portfolio_post_staff (
  post_id  uuid not null references public.portfolio_posts(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  primary key (post_id, staff_id)
);
alter table public.portfolio_post_staff enable row level security;

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
      or (p.kind = 'project' and exists (
        select 1 from portfolio_post_groups pg
        join coud_groups g on g.id = pg.group_id
        where pg.post_id = p.id and g.teacher_id = get_my_staff_id()))
      or (p.kind in ('project', 'event') and exists (
        select 1 from portfolio_post_staff ps
        where ps.post_id = p.id and ps.staff_id = get_my_staff_id()))
    ))
$$;
grant execute on function public.portfolio_can_edit(uuid) to authenticated;

drop policy if exists "portfolio_staff_read" on public.portfolio_post_staff;
create policy "portfolio_staff_read" on public.portfolio_post_staff for select to authenticated using (true);
drop policy if exists "portfolio_staff_write" on public.portfolio_post_staff;
create policy "portfolio_staff_write" on public.portfolio_post_staff for all to authenticated
  using (portfolio_can_edit(post_id)) with check (portfolio_can_edit(post_id));

grant select, insert, update, delete on public.portfolio_post_staff to authenticated;
notify pgrst, 'reload schema';
