-- История на преместванията на ученик между паралелки (кога, откъде, накъде, кой).
-- Безопасно за повторно пускане. Преместването работи и без таблицата — само не пази история.
create table if not exists public.student_class_moves (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete cascade,
  from_class_id uuid references public.classes(id) on delete set null,
  to_class_id uuid references public.classes(id) on delete set null,
  moved_on date not null default current_date,
  note text,
  moved_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists student_class_moves_student_idx on public.student_class_moves(student_id);

alter table public.student_class_moves enable row level security;
drop policy if exists "class_moves_read" on public.student_class_moves;
create policy "class_moves_read" on public.student_class_moves for select using (true);
drop policy if exists "class_moves_write" on public.student_class_moves;
create policy "class_moves_write" on public.student_class_moves for all
  using (get_my_role() in ('admin', 'zdud', 'director', 'secretary'))
  with check (get_my_role() in ('admin', 'zdud', 'director', 'secretary'));
