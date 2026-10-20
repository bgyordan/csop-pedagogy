-- Посещения на час — фиксирани часове за всички (напр. само 3. и 4. час), вместо по седмичното разписание.
-- Празно = старият начин (всеки избира свой час). Безопасно за повторно пускане.
alter table public.visit_campaigns add column if not exists slot_periods int[] not null default '{}';

create or replace function public.visit_booking_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record; n int;
begin
  select * into c from visit_campaigns where id = new.campaign_id;
  if c is null then raise exception 'Няма такава проверка'; end if;
  if new.date < c.date_from or new.date > c.date_to then raise exception 'Денят е извън периода'; end if;
  if new.date = any(c.excluded_dates) then raise exception 'В този ден няма посещения'; end if;
  if extract(isodow from new.date) > 5 then raise exception 'Денят не е работен'; end if;
  if cardinality(c.slot_periods) > 0 and not (new.period = any(c.slot_periods)) then raise exception 'Този час не е за посещения'; end if;
  select count(*) into n from visit_bookings b where b.campaign_id = new.campaign_id and b.date = new.date and b.id <> new.id;
  if n >= c.per_day then raise exception 'Денят вече е зает — изберете друг'; end if;
  new.updated_at := now();
  return new;
end $$;

notify pgrst, 'reload schema';
