-- Контролна дейност — етап 3: годишен план и график на контролната дейност.
-- Изисква 2026-10-22_control_activity.sql. Безопасно за повторно пускане.
--
-- • Всеки проверяващ има по един план за учебната година (директорът — своя; ЗДУД, ЗДАСД — своите).
--   Планът е в 6 части: анализ на предходната година, цели и задачи, обект и предмет, методи, график, отчитане.
-- • Графикът е редове по месеци; проверките се свързват с ред от графика (plan_item_id) —
--   така се вижда изпълнението на плана и обхватът.
-- • Вижда: собственикът и директорът. Редактира: собственикът (докато е чернова) и директорът.
--   Утвърждава директорът (със заповед — номерът ѝ се вписва).

create table if not exists public.control_plans (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  owner_id uuid not null references public.staff_profiles(id) on delete cascade,
  owner_title text,
  analysis text,          -- 1. анализ на контролната дейност през предходната година
  goals text,             -- 2. цел и задачи
  objects text,           -- 3. обект и предмет на контрола
  methods text,           -- 4. методи и форми
  reporting text,         -- 6. отчитане (5. е графикът)
  status text not null default 'draft' check (status in ('draft', 'approved')),
  order_ref text,         -- „Заповед № РД-… / …“ за утвърждаване
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, owner_id)
);

create table if not exists public.control_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.control_plans(id) on delete cascade,
  month int not null check (month between 1 and 12),
  kind text not null default 'current' check (kind in ('preliminary', 'current', 'follow_up')),
  focus text not null default 'pedagogical' check (focus in ('pedagogical', 'administrative')),
  form text not null default 'observation' check (form in ('thematic', 'current', 'observation', 'study')),
  subject text not null,                 -- обект и предмет: „Наблюдение на учебни часове — класни ръководители I–IV“
  scope text,                            -- кого обхваща (свободен текст)
  template_id uuid references public.control_templates(id) on delete set null,
  target int not null default 1 check (target between 1 and 200),   -- колко проверки (протокола) се очакват
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists control_plan_items_plan_idx on public.control_plan_items (plan_id, month);

alter table public.control_checks add column if not exists plan_item_id uuid references public.control_plan_items(id) on delete set null;
create index if not exists control_checks_plan_item_idx on public.control_checks (plan_item_id);

-- Заключването на подписания протокол пропуска изчистването на връзките (изтрит шаблон, посещение, ред от плана):
-- иначе „on delete set null“ би блокирало триенето им.
create or replace function public.control_checks_lock() returns trigger
language plpgsql set search_path = public as $$
declare keep text[] := array['scan_path', 'status', 'voided_reason', 'voided_at', 'updated_at'];
        n jsonb; o jsonb; k text;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    n := to_jsonb(new); o := to_jsonb(old);
    foreach k in array array['template_id', 'visit_booking_id', 'follow_up_of', 'plan_item_id'] loop
      if n ->> k is null then n := n - k; o := o - k; end if;
    end loop;
    if (n - keep) <> (o - keep) then
      raise exception 'Подписаният протокол не се редактира — анулирайте го и съставете нов';
    end if;
    if new.status = 'draft' or (old.status = 'voided' and new.status <> 'voided') then
      raise exception 'Протоколът не може да се върне в чернова';
    end if;
    if new.status = 'voided' and coalesce(trim(new.voided_reason), '') = '' then
      raise exception 'Посочете мотив за анулирането';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status <> 'draft' and current_setting('control.signing', true) is distinct from '1' then
    raise exception 'Подписването става само с бутона „Подпиши и впиши в Книгата“';
  end if;
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'Новият протокол е чернова';
  end if;
  return new;
end $$;

create or replace function public.control_plan_can_see(p_plan uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select control_is_director() or exists (select 1 from control_plans p where p.id = p_plan and p.owner_id = get_my_staff_id())
$$;
create or replace function public.control_plan_can_edit(p_plan uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select control_is_director()
    or exists (select 1 from control_plans p where p.id = p_plan and p.owner_id = get_my_staff_id() and p.status = 'draft')
$$;

-- Утвърждаване / връщане в чернова — само директорът
create or replace function public.control_plan_approve(p_plan uuid, p_order text, p_on boolean default true) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not control_is_director() then raise exception 'Планът се утвърждава от директора'; end if;
  if p_on then
    update control_plans set status = 'approved', order_ref = nullif(trim(coalesce(p_order, '')), ''), approved_at = now(), updated_at = now() where id = p_plan;
  else
    update control_plans set status = 'draft', approved_at = null, updated_at = now() where id = p_plan;
  end if;
end $$;
grant execute on function public.control_plan_approve(uuid, text, boolean) to authenticated;

-- Утвърденият план се пази от промени (освен от директора)
create or replace function public.control_plans_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if old.status = 'approved' and not control_is_director() then
    raise exception 'Планът е утвърден — промени прави директорът';
  end if;
  if new.status is distinct from old.status and not control_is_director() then
    raise exception 'Планът се утвърждава от директора';
  end if;
  return new;
end $$;
drop trigger if exists control_plans_guard on public.control_plans;
create trigger control_plans_guard before update on public.control_plans
  for each row execute function public.control_plans_guard();

alter table public.control_plans enable row level security;
alter table public.control_plan_items enable row level security;

drop policy if exists "control_plans_read" on public.control_plans;
create policy "control_plans_read" on public.control_plans for select to authenticated
  using (control_is_director() or owner_id = get_my_staff_id());
drop policy if exists "control_plans_insert" on public.control_plans;
create policy "control_plans_insert" on public.control_plans for insert to authenticated
  with check (status = 'draft' and control_is_inspector() and (owner_id = get_my_staff_id() or control_is_director()));
drop policy if exists "control_plans_update" on public.control_plans;
create policy "control_plans_update" on public.control_plans for update to authenticated
  using (control_is_director() or owner_id = get_my_staff_id())
  with check (control_is_director() or owner_id = get_my_staff_id());
drop policy if exists "control_plans_delete" on public.control_plans;
create policy "control_plans_delete" on public.control_plans for delete to authenticated
  using (control_plan_can_edit(id));

drop policy if exists "control_plan_items_read" on public.control_plan_items;
create policy "control_plan_items_read" on public.control_plan_items for select to authenticated using (control_plan_can_see(plan_id));
drop policy if exists "control_plan_items_write" on public.control_plan_items;
create policy "control_plan_items_write" on public.control_plan_items for all to authenticated
  using (control_plan_can_edit(plan_id)) with check (control_plan_can_edit(plan_id));

notify pgrst, 'reload schema';
