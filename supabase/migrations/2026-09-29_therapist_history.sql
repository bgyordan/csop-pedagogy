-- 1) Терапевтите и ЕПЛР екипът вече НЕ са обвързани:
--    махаме ръчно създадения тригер, който пренаписваше ЕПЛР екипа при смяна на терапевт.
--    (функцията sync_therapist_to_eplr остава в базата — при нужда тригерът се връща с един ред)
drop trigger if exists trg_sync_therapist_to_eplr on public.students;

-- 2) История: кой, кога, кое дете взе/махна/смени като психолог, логопед или рехабилитатор.
create table if not exists public.therapist_changes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  role text not null,                                   -- psychologist | speech_therapist | rehabilitator
  old_staff_id uuid references public.staff_profiles(id) on delete set null,
  new_staff_id uuid references public.staff_profiles(id) on delete set null,
  changed_by uuid references public.staff_profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists therapist_changes_student_idx on public.therapist_changes(student_id, changed_at desc);

alter table public.therapist_changes enable row level security;
drop policy if exists "therapist_changes_read" on public.therapist_changes;
create policy "therapist_changes_read" on public.therapist_changes for select using (true);
-- писане само от тригера по-долу (security definer), не директно

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
  return new;
end $$;

drop trigger if exists trg_log_therapist_change on public.students;
create trigger trg_log_therapist_change
  after update of therapist_psychologist_id, therapist_speech_id, therapist_rehab_id on public.students
  for each row execute function public.log_therapist_change();
