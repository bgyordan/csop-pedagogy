-- Алергии / хранене: ясно „Няма“ или „Има“ (с вид, към какво, какво да се прави при реакция),
-- вместо „няма“ в бележката и „безсрочен“. Само медицинско (без религиозни/лични режими).
-- Безопасно за повторно пускане.
alter table public.student_documents add column if not exists allergy_status text check (allergy_status in ('none', 'has'));
alter table public.student_documents add column if not exists allergy_kinds text[] not null default '{}';
alter table public.student_documents add column if not exists allergens text[] not null default '{}';
alter table public.student_documents add column if not exists reaction_plan text;
alter table public.student_documents add column if not exists emergency_med boolean not null default false;

-- досегашните записи: „няма“ в бележката → „Няма“; останалите с текст → „Има“ (за преглед)
update public.student_documents
   set allergy_status = 'none', note = null, indefinite = false
 where doc_type = 'allergy' and allergy_status is null
   and lower(btrim(coalesce(note, ''))) ~ '^(няма|не|-|—|няма алергии?|без алергии?|няма алергия|няма данни за алергии?)\.?$';
update public.student_documents
   set allergy_status = 'has'
 where doc_type = 'allergy' and allergy_status is null and coalesce(btrim(note), '') <> '';

notify pgrst, 'reload schema';
