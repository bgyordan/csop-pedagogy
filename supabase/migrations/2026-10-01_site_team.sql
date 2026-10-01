-- Екипът на публичния сайт (csop-varna.bg/za-nas/ekip) се чете от служителите в ЕИС.
-- site_team пази само настройките за сайта: дали човекът се показва и с какъв надпис под името.
-- Изгледът public_team дава на сайта САМО име, група и надпис на активните служители — без имейл/телефон.
-- Безопасно за повторно пускане.

create table if not exists public.site_team (
  staff_id uuid primary key references public.staff_profiles(id) on delete cascade,
  show boolean not null default true,
  title text,                     -- надпис под името на сайта; празно = автоматично от длъжността
  updated_at timestamptz not null default now()
);

alter table public.site_team enable row level security;
drop policy if exists "site_team_read" on public.site_team;
create policy "site_team_read" on public.site_team for select using (auth.role() = 'authenticated');
drop policy if exists "site_team_edit" on public.site_team;
create policy "site_team_edit" on public.site_team for all
  using (get_my_role() in ('admin', 'director', 'zdud', 'secretary'))
  with check (get_my_role() in ('admin', 'director', 'zdud', 'secretary'));

create or replace view public.public_team as
select
  p.id,
  p.first_name || ' ' || p.last_name as name,
  case
    when p.role in ('director', 'zdud', 'admin', 'secretary') then 'admin'
    when p.role in ('psychologist', 'speech_therapist', 'rehabilitator') then 'therapy'
    when p.role in ('class_teacher', 'teacher', 'coordinator') then 'teachers'
    when p.role = 'educator' then 'educators'
    when p.role = 'support' and coalesce(p.position, '') ilike '%помощник%' then 'assistants'
    else 'other'
  end as grp,
  coalesce(nullif(trim(t.title), ''),
    case
      when p.role = 'director' then 'Директор'
      when p.role = 'zdud' then 'Зам.-директор УД'
      when p.role in ('class_teacher', 'teacher') then 'Учител'
      when p.role = 'psychologist' then 'Психолог'
      when p.role = 'speech_therapist' then 'Логопед'
      when p.role = 'rehabilitator' and coalesce(p.position, '') ilike 'ерготерапевт%' then 'Ерготерапевт'
      when p.role = 'rehabilitator' then 'Рехабилитатор'
      when p.role = 'educator' then 'Възпитател'
      when p.role = 'support' and coalesce(p.position, '') ilike '%помощник%' then 'Помощник на учителя'
      else coalesce(nullif(trim(p.position), ''), 'Служител')
    end) as title,
  case p.role
    when 'director' then 1 when 'zdud' then 2 when 'admin' then 3 when 'secretary' then 4
    when 'psychologist' then 5 when 'speech_therapist' then 6 when 'rehabilitator' then 7
    else 9
  end as sort
from public.staff_profiles p
left join public.site_team t on t.staff_id = p.id
where p.is_active is not false
  and coalesce(t.show, not (p.role = 'support' and coalesce(p.position, '') not ilike '%помощник%'))
order by grp, sort, p.last_name, p.first_name;

-- Сайтът чете с публичния ключ (anon); изгледът показва само горните колони.
grant select on public.public_team to anon, authenticated;

-- Начални надписи, които длъжността в ЕИС не дава точно (Ванина може да ги смени от ЕИС → Сайт → Екип)
insert into public.site_team (staff_id, title)
select id, 'Зам.-директор АСД' from public.staff_profiles
where role = 'admin' and first_name = 'Йордан' and last_name = 'Йорданов'
on conflict (staff_id) do nothing;
insert into public.site_team (staff_id, title)
select id, 'Клиничен психолог' from public.staff_profiles
where first_name = 'Рая' and last_name = 'Стефанова'
on conflict (staff_id) do nothing;
insert into public.site_team (staff_id, title)
select id, 'Кинезитерапевт' from public.staff_profiles
where first_name = 'Мариян' and last_name = 'Янакиев'
on conflict (staff_id) do nothing;
