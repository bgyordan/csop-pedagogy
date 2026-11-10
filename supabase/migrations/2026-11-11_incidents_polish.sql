-- Дневник случаи — доизпипване. Безопасно за повторно пускане.
-- 1) Поредният номер се дава от базата в момента на записа — двама колеги едновременно не получават един и същ №.
-- 2) „Разговор с родител“ в дирята сам отбелязва „уведомен родител“ на случая (и когато го пише класният).
-- 3) Класният добавя само бележка, мярка и разговор с родител; редовете за статус и протокол пише екипът на съвета.

create or replace function public.incident_set_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('incident_cases_number'));
  select coalesce(max(number), 0) + 1 into new.number
    from incident_cases where academic_year_id is not distinct from new.academic_year_id;
  return new;
end $$;
drop trigger if exists incident_cases_number on public.incident_cases;
create trigger incident_cases_number before insert on public.incident_cases
  for each row execute function public.incident_set_number();

create or replace function public.incident_event_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'parent' then
    update incident_cases set parents_notified = true where id = new.case_id and not parents_notified;
  end if;
  return new;
end $$;
drop trigger if exists incident_events_after on public.incident_events;
create trigger incident_events_after after insert on public.incident_events
  for each row execute function public.incident_event_after();

drop policy if exists "incident_events_insert" on public.incident_events;
create policy "incident_events_insert" on public.incident_events for insert to authenticated
  with check (staff_id = get_my_staff_id() and incident_can_see(case_id)
              and (incident_is_council() or kind in ('note', 'measure', 'parent')));

notify pgrst, 'reload schema';
