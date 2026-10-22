-- Контролна дейност — етап 4: самооценка на проверения, приключване на Книгата, триене след 5 години.
-- Изисква 2026-10-22_control_activity.sql. Безопасно за повторно пускане.

-- ── Самооценка ───────────────────────────────────────────────────────────────
-- Проверяващият поисква самооценка по критериите на протокола; провереният я попълва, докато протоколът е чернова.
-- Провереният не вижда черновата — получава само предмета, датата и критериите (control_self_requests).
alter table public.control_check_staff add column if not exists self_requested_at timestamptz;
alter table public.control_check_staff add column if not exists self_assessment jsonb;     -- { "k": { "s": 3, "n": "..." }, "_note": "общ коментар" }
alter table public.control_check_staff add column if not exists self_assessed_at timestamptz;

create or replace function public.control_self_requests()
returns table (check_id uuid, subject text, check_date date, inspector text, criteria jsonb, self_assessment jsonb, self_assessed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.subject, c.check_date, coalesce(p.first_name || ' ' || p.last_name, ''), c.criteria, s.self_assessment, s.self_assessed_at
  from control_check_staff s
  join control_checks c on c.id = s.check_id
  left join staff_profiles p on p.id = c.inspector_id
  where s.staff_id = get_my_staff_id() and s.self_requested_at is not null and c.status = 'draft'
  order by c.check_date
$$;
grant execute on function public.control_self_requests() to authenticated;

create or replace function public.control_self_assess(p_check uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from control_checks where id = p_check;
  if not found then raise exception 'Няма такава проверка'; end if;
  if c.status <> 'draft' then raise exception 'Протоколът вече е подписан — самооценката е затворена'; end if;
  update control_check_staff set self_assessment = p_data, self_assessed_at = now()
    where check_id = p_check and staff_id = get_my_staff_id() and self_requested_at is not null;
  if not found then raise exception 'Не е поискана самооценка от вас'; end if;
end $$;
grant execute on function public.control_self_assess(uuid, jsonb) to authenticated;

-- ── Приключване на Книгата за учебната година ────────────────────────────────
-- След приключване в годината не се подписват нови протоколи (Книгата се подписва в НЕИСПУО като PDF).
create table if not exists public.control_book_closures (
  academic_year_id uuid primary key references public.academic_years(id) on delete cascade,
  closed_at timestamptz not null default now(),
  closed_by uuid references public.staff_profiles(id) on delete set null,
  records int not null default 0
);
alter table public.control_book_closures enable row level security;
drop policy if exists "control_book_closures_read" on public.control_book_closures;
create policy "control_book_closures_read" on public.control_book_closures for select to authenticated using (true);

create or replace function public.control_close_book(p_year uuid, p_on boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not control_is_director() then raise exception 'Книгата се приключва от директора'; end if;
  if p_on then
    if exists (select 1 from control_checks where academic_year_id = p_year and status = 'draft') then
      raise exception 'Има неподписани чернови за годината — подпишете или изтрийте ги';
    end if;
    insert into control_book_closures (academic_year_id, closed_by, records)
      values (p_year, get_my_staff_id(), (select count(*) from control_checks where academic_year_id = p_year and book_no is not null))
      on conflict (academic_year_id) do update set closed_at = now(), closed_by = excluded.closed_by, records = excluded.records;
  else
    delete from control_book_closures where academic_year_id = p_year;
  end if;
end $$;
grant execute on function public.control_close_book(uuid, boolean) to authenticated;

-- Подписването проверява дали Книгата за годината е приключена
create or replace function public.control_book_open_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.book_no is not null and old.book_no is null
     and exists (select 1 from control_book_closures b where b.academic_year_id = new.academic_year_id) then
    raise exception 'Книгата за тази учебна година е приключена';
  end if;
  return new;
end $$;
drop trigger if exists control_book_open_guard on public.control_checks;
create trigger control_book_open_guard before update on public.control_checks
  for each row execute function public.control_book_open_guard();

-- ── Триене след 5 години (Наредба № 8, прил. 2; GDPR) ───────────────────────
-- Само директорът; само учебни години, приключили преди повече от 5 години. Сканираните файлове се трият от приложението преди това.
create or replace function public.control_purge_year(p_year uuid) returns int
language plpgsql security definer set search_path = public as $$
declare y text; ends date; n int;
begin
  if not control_is_director() then raise exception 'Само директорът'; end if;
  select name into y from academic_years where id = p_year;
  if y is null then raise exception 'Няма такава година'; end if;
  ends := make_date((split_part(y, '-', 1))::int + 1, 9, 14);
  if ends + interval '5 years' > current_date then raise exception 'Срокът за съхранение (5 години) още не е изтекъл'; end if;
  delete from control_checks where academic_year_id = p_year;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.control_purge_year(uuid) to authenticated;

notify pgrst, 'reload schema';
