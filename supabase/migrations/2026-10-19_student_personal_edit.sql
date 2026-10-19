-- Досие → карта „Лични данни“: редакция на място.
-- Редактират админ, ЗДУД, деловодството и КЛАСНИЯТ на паралелката на детето (текуща година) —
-- същото правило като за родителите (can_edit_student_guardians от 2026-10-19_guardians_class_teacher.sql).
-- Функцията пипа САМО личните полета (имена, дата на раждане, изпращащо училище, клас и буква там, пътуващ) —
-- форма, паралелка, ОРЕС, терапевти и т.н. остават за управата.
-- Безопасно за повторно пускане. Пуска се веднъж в Studio → SQL Editor (след файла за родителите).

create or replace function public.update_student_personal(
  sid uuid,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_birth_date date,
  p_sending_school_id uuid,
  p_external_class text,
  p_external_class_letter text,
  p_is_traveling boolean
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.can_edit_student_guardians(sid) then
    raise exception 'permission denied: нямате права да редактирате данните на това дете';
  end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = '' then
    raise exception 'Името и фамилията са задължителни';
  end if;
  update students set
    first_name = trim(p_first_name),
    middle_name = nullif(trim(coalesce(p_middle_name, '')), ''),
    last_name = trim(p_last_name),
    birth_date = p_birth_date,
    sending_school_id = p_sending_school_id,
    external_class = nullif(trim(coalesce(p_external_class, '')), ''),
    external_class_letter = nullif(lower(trim(coalesce(p_external_class_letter, ''))), ''),
    is_traveling = coalesce(p_is_traveling, false)
  where id = sid;
end;
$$;

grant execute on function public.update_student_personal(uuid, text, text, text, date, uuid, text, text, boolean) to authenticated;
