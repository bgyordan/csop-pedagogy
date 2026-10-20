-- Посещения на час — изключени учители (напр. изнесените групи или вече посетени): не избират и не се броят.
-- Безопасно за повторно пускане.
alter table public.visit_campaigns add column if not exists excluded_staff uuid[] not null default '{}';

drop policy if exists "visit_bookings_write" on public.visit_bookings;
create policy "visit_bookings_write" on public.visit_bookings for all to authenticated
  using (visit_is_mgmt() or (staff_id = get_my_staff_id() and exists (
    select 1 from visit_campaigns c where c.id = campaign_id and c.is_open and get_my_role()::text = any(c.roles)
      and not (get_my_staff_id() = any(c.excluded_staff)))))
  with check (visit_is_mgmt() or (staff_id = get_my_staff_id() and exists (
    select 1 from visit_campaigns c where c.id = campaign_id and c.is_open and get_my_role()::text = any(c.roles)
      and not (get_my_staff_id() = any(c.excluded_staff)))));

notify pgrst, 'reload schema';
