-- Контролна дейност — етап 2: проследяване на препоръките, последващ контрол, справка от системата.
-- Изисква 2026-10-22_control_activity.sql. Безопасно за повторно пускане.
--
-- • Отговорникът по препоръка (обикновено провереният учител) отчита изпълнението ѝ след подписването;
--   проверяващият (или директорът) потвърждава „изпълнена“ / „неизпълнена“ или я връща.
-- • Последващ контрол: нов протокол, свързан с първия (follow_up_of). Критериите са препоръките;
--   при подписването му статусите на препоръките се обновяват автоматично
--   (3 — изпълнена, 2 — остава отворена, 1 — неизпълнена).
-- • Справка от системата: моментна снимка на данните към деня на проверката (evidence) — заключва се с протокола.

alter table public.control_checks add column if not exists follow_up_of uuid references public.control_checks(id) on delete set null;
alter table public.control_checks add column if not exists evidence jsonb;
create index if not exists control_checks_follow_up_idx on public.control_checks (follow_up_of);

alter table public.control_recommendations add column if not exists reported_at timestamptz;
alter table public.control_recommendations add column if not exists review_note text;
alter table public.control_recommendations add column if not exists reviewed_at timestamptz;
alter table public.control_recommendations add column if not exists verified_in uuid references public.control_checks(id) on delete set null;
create index if not exists control_recommendations_resp_idx on public.control_recommendations (responsible_id);

-- Отговорникът по препоръка вижда подписания протокол (за да знае какво му е препоръчано)
create or replace function public.control_can_see(p_check uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select control_is_director()
    or exists (select 1 from control_checks c where c.id = p_check and c.inspector_id = get_my_staff_id())
    or exists (select 1 from control_checks c join control_check_staff s on s.check_id = c.id
               where c.id = p_check and c.status <> 'draft' and s.staff_id = get_my_staff_id())
    or exists (select 1 from control_checks c join control_recommendations r on r.check_id = c.id
               where c.id = p_check and c.status <> 'draft' and r.responsible_id = get_my_staff_id())
$$;

-- Отчет от отговорника: „Изпълних препоръката — ето как“
create or replace function public.control_rec_report(p_rec uuid, p_report text) returns void
language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select r.*, c.status as check_status into x
    from control_recommendations r join control_checks c on c.id = r.check_id where r.id = p_rec for update of r;
  if not found then raise exception 'Няма такава препоръка'; end if;
  if x.check_status <> 'signed' then raise exception 'Протоколът не е подписан'; end if;
  if x.responsible_id is distinct from get_my_staff_id() then raise exception 'Отчита само отговорникът по препоръката'; end if;
  if x.status = 'done' then raise exception 'Препоръката вече е приета за изпълнена'; end if;
  if coalesce(trim(p_report), '') = '' then raise exception 'Опишете какво е направено'; end if;
  update control_recommendations set status = 'reported', report = trim(p_report), reported_at = now() where id = p_rec;
end $$;
grant execute on function public.control_rec_report(uuid, text) to authenticated;

-- Проверяващият / директорът: „изпълнена“, „неизпълнена“ или обратно „отворена“ (с бележка)
create or replace function public.control_rec_review(p_rec uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare x record;
begin
  if p_status not in ('open', 'done', 'not_done') then raise exception 'Невалиден статус'; end if;
  select r.*, c.status as check_status, c.inspector_id into x
    from control_recommendations r join control_checks c on c.id = r.check_id where r.id = p_rec for update of r;
  if not found then raise exception 'Няма такава препоръка'; end if;
  if x.check_status <> 'signed' then raise exception 'Протоколът не е подписан'; end if;
  if not (x.inspector_id = get_my_staff_id() or control_is_director()) then raise exception 'Нямате права'; end if;
  update control_recommendations set status = p_status, review_note = nullif(trim(coalesce(p_note, '')), ''),
    reviewed_at = case when p_status = 'open' then null else now() end where id = p_rec;
end $$;
grant execute on function public.control_rec_review(uuid, text, text) to authenticated;

-- Подписване: както в етап 1 + при последващ контрол обновява препоръките от първия протокол
create or replace function public.control_sign(p_check uuid) returns int
language plpgsql security definer set search_path = public as $$
declare c record; n int;
begin
  select * into c from control_checks where id = p_check for update;
  if c is null then raise exception 'Няма такъв протокол'; end if;
  if c.status <> 'draft' then raise exception 'Протоколът вече е подписан'; end if;
  if c.inspector_id <> get_my_staff_id() then raise exception 'Подписва само проверяващият'; end if;
  if coalesce(trim(c.subject), '') = '' then raise exception 'Попълнете какво е проверено'; end if;
  if not exists (select 1 from control_check_staff s where s.check_id = p_check) then
    raise exception 'Посочете проверения служител';
  end if;
  perform pg_advisory_xact_lock(hashtext('control_book_' || coalesce(c.academic_year_id::text, '')));
  select coalesce(max(book_no), 0) + 1 into n from control_checks
    where academic_year_id is not distinct from c.academic_year_id and book_no is not null;
  perform set_config('control.signing', '1', true);
  update control_checks set status = 'signed', book_no = n, signed_at = now() where id = p_check;
  perform set_config('control.signing', '0', true);

  if c.follow_up_of is not null then
    update control_recommendations r set
      status = case (c.findings -> ('r_' || r.id::text) ->> 's') when '3' then 'done' when '1' then 'not_done' else 'open' end,
      review_note = coalesce(nullif(c.findings -> ('r_' || r.id::text) ->> 'n', ''), r.review_note),
      reviewed_at = now(), verified_in = p_check
    where r.check_id = c.follow_up_of and r.status <> 'done'
      and (c.findings -> ('r_' || r.id::text) ->> 's') in ('1', '2', '3');
  end if;
  return n;
end $$;
grant execute on function public.control_sign(uuid) to authenticated;

notify pgrst, 'reload schema';
