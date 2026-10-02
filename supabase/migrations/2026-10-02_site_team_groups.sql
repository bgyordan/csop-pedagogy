-- Екип на сайта: помощен персонал с надпис „Помощник на учителя“ (сменен от ЕИС → Сайт → Екип)
-- отива в групата „Помощник на учителя“, дори длъжността му в ЕИС да е друга.
-- Безопасно за повторно пускане.
create or replace view public.public_team as
select
  p.id,
  p.first_name || ' ' || p.last_name as name,
  case
    when p.role in ('director', 'zdud', 'admin', 'secretary') then 'admin'
    when p.role in ('psychologist', 'speech_therapist', 'rehabilitator') then 'therapy'
    when p.role in ('class_teacher', 'teacher', 'coordinator') then 'teachers'
    when p.role = 'educator' then 'educators'
    when p.role = 'support' and (coalesce(p.position, '') ilike '%помощник%' or coalesce(t.title, '') ilike '%помощник%') then 'assistants'
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
