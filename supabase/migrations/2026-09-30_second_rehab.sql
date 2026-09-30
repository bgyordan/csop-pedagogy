-- Второ място за рехабилитатор при детето (олекотен вариант).
-- Ерго-, кинезитерапевт и рехабилитатор са с една роля „рехабилитатор“,
-- затова детето трябва да може да е при двама. Нищо съществуващо не се променя.

alter table public.students
  add column if not exists therapist_rehab2_id uuid
  references public.staff_profiles(id) on delete set null;
-- FK името по подразбиране е students_therapist_rehab2_id_fkey (ползва се в join-овете)

-- Историята записва и второто място (role остава 'rehabilitator')
create or replace function public.log_therapist_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := get_my_staff_id();
begin
  if new.therapist_psychologist_id is distinct from old.therapist_psychologist_id then
    insert into therapist_changes(student_id, role, old_staff_id, new_staff_id, changed_by)
    values (new.id, 'psychologist', old.therapist_psychologist_id, new.therapist_psychologist_id, me);
  end if;
  if new.therapist_speech_id is distinct from old.therapist_speech_id then
    insert into therapist_changes(student_id, role, old_staff_id, new_staff_id, changed_by)
    values (new.id, 'speech_therapist', old.therapist_speech_id, new.therapist_speech_id, me);
  end if;
  if new.therapist_rehab_id is distinct from old.therapist_rehab_id then
    insert into therapist_changes(student_id, role, old_staff_id, new_staff_id, changed_by)
    values (new.id, 'rehabilitator', old.therapist_rehab_id, new.therapist_rehab_id, me);
  end if;
  if new.therapist_rehab2_id is distinct from old.therapist_rehab2_id then
    insert into therapist_changes(student_id, role, old_staff_id, new_staff_id, changed_by)
    values (new.id, 'rehabilitator', old.therapist_rehab2_id, new.therapist_rehab2_id, me);
  end if;
  return new;
end $$;

drop trigger if exists trg_log_therapist_change on public.students;
create trigger trg_log_therapist_change
  after update of therapist_psychologist_id, therapist_speech_id, therapist_rehab_id, therapist_rehab2_id on public.students
  for each row execute function public.log_therapist_change();

-- PostgREST да види новата колона веднага
notify pgrst, 'reload schema';
