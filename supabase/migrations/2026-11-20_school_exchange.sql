-- „Обмен с училища“: кутия за документите от училищата (имейл) → разнасяне към училище или дете.
-- status: inbox (неразпределен) · filed (при училището) · to_student (отнесен в досието на дете)
alter table public.school_files alter column school_id drop not null;
alter table public.school_files
  add column if not exists status text not null default 'filed',
  add column if not exists doc_type text,
  add column if not exists student_id uuid references public.students(id) on delete set null,
  add column if not exists academic_year_id uuid references public.academic_years(id) on delete set null,
  add column if not exists original_name text,
  add column if not exists attachment_id uuid,
  add column if not exists filed_at timestamptz;
create index if not exists school_files_status_idx on public.school_files(status);
