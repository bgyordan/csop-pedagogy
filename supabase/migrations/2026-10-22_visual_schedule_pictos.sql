-- Визуален график — сменените картинки/кратки имена се пазят за ПАРАЛЕЛКАТА (не само в браузъра),
-- с кой и кога, за да ги вижда ЗДУД (и админ) в „Промени от колегите“.
-- subject_key = името на предмета от разписанието, или '#arrival' / '#break' / '#home' за допълнителните стъпки.
-- Чете всеки вписан; пише ръководството, класният и учителите с часове в паралелката.
-- Безопасно за повторно пускане.

create table if not exists public.visual_schedule_pictos (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_key text not null,
  picto text,
  label text,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (class_id, subject_key)
);
create index if not exists visual_schedule_pictos_updated_idx on public.visual_schedule_pictos (updated_at desc);

create or replace function public.visual_schedule_can_edit(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select get_my_role()::text in ('admin', 'zdud', 'director')
    or exists (select 1 from class_teacher_assignments a
               where a.class_id = p_class and a.staff_id = get_my_staff_id())
    or exists (select 1 from schedule_slots s join class_schedules cs on cs.id = s.schedule_id
               where cs.class_id = p_class and s.staff_id = get_my_staff_id())
$$;

alter table public.visual_schedule_pictos enable row level security;

drop policy if exists "vs_pictos_read" on public.visual_schedule_pictos;
create policy "vs_pictos_read" on public.visual_schedule_pictos for select to authenticated using (true);

drop policy if exists "vs_pictos_write" on public.visual_schedule_pictos;
create policy "vs_pictos_write" on public.visual_schedule_pictos for all to authenticated
  using (visual_schedule_can_edit(class_id))
  with check (visual_schedule_can_edit(class_id) and updated_by = get_my_staff_id());

notify pgrst, 'reload schema';
