-- Посещения на час — сутрин и следобед поотделно:
-- сутрин (учители): избор между slot_periods (напр. 1.–4. час), до per_day на ден;
-- следобед (учители ЦОУД): избор между slot_periods_pm (ЦОУД часове 21–26), до per_day_pm на ден.
-- Безопасно за повторно пускане.
alter table public.visit_campaigns add column if not exists slot_periods_pm int[] not null default '{}';
alter table public.visit_campaigns add column if not exists per_day_pm int not null default 1 check (per_day_pm between 0 and 10);

create or replace function public.visit_booking_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record; n int; pm boolean;
begin
  select * into c from visit_campaigns where id = new.campaign_id;
  if c is null then raise exception 'Няма такава проверка'; end if;
  if new.date < c.date_from or new.date > c.date_to then raise exception 'Денят е извън периода'; end if;
  if new.date = any(c.excluded_dates) then raise exception 'В този ден няма посещения'; end if;
  if extract(isodow from new.date) > 5 then raise exception 'Денят не е работен'; end if;
  pm := new.period >= 21;   -- ЦОУД часовете (21–26) са следобедните
  if pm then
    if cardinality(c.slot_periods_pm) > 0 and not (new.period = any(c.slot_periods_pm)) then raise exception 'Този час не е за посещения'; end if;
    select count(*) into n from visit_bookings b where b.campaign_id = new.campaign_id and b.date = new.date and b.period >= 21 and b.id <> new.id;
    if n >= c.per_day_pm then raise exception 'Следобедният час в този ден вече е зает — изберете друг ден'; end if;
  else
    if cardinality(c.slot_periods) > 0 and not (new.period = any(c.slot_periods)) then raise exception 'Този час не е за посещения'; end if;
    select count(*) into n from visit_bookings b where b.campaign_id = new.campaign_id and b.date = new.date and b.period < 21 and b.id <> new.id;
    if n >= c.per_day then raise exception 'Денят вече е зает — изберете друг'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

notify pgrst, 'reload schema';
