-- Стажът от НЕИСПУО вече не се взима при импорта (подвеждащ е — въвежда се ръчно в портфолиото).
-- Този файл маха стажа, който вече е записан от импорта:
--   1) началните дати за общ и учителски стаж, но само ако съвпадат с изчислените от НЕИСПУО
--      (ако някой ги е поправил ръчно след импорта, остават);
--   2) годините стаж от справката „От НЕИСПУО“.
-- Изисква: 2026-10-31_neispuo_staff_import.sql. Безопасно за повторно пускане.

-- дата „преди N години (и един ден)“ към датата на справката — както ги смяташе импортът
create or replace function pg_temp.neispuo_since(p_as_of text, p_years text) returns date
language sql immutable as $$
  select case when p_as_of is null or p_years is null or p_years !~ '^\d+(\.\d+)?$' then null
    else (p_as_of::date
      - make_interval(years => floor(p_years::numeric)::int, months => round((p_years::numeric - floor(p_years::numeric)) * 12)::int)
      - interval '1 day')::date end
$$;

update public.pp_profile
set work_since = null
where neispuo ? 'years_total' and work_since is not null
  and abs(work_since - pg_temp.neispuo_since(neispuo->>'as_of', neispuo->>'years_total')) <= 3;

update public.pp_profile
set teacher_since = null
where neispuo ? 'years_teacher' and teacher_since is not null
  and abs(teacher_since - pg_temp.neispuo_since(neispuo->>'as_of', neispuo->>'years_teacher')) <= 3;

update public.pp_profile
set neispuo = neispuo - 'years_total' - 'years_specialty' - 'years_teacher'
where neispuo ?| array['years_total', 'years_specialty', 'years_teacher'];
