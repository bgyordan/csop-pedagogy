-- ТЕЛК/ЛКК и заповедта от РЦПППО — на едно място („Документи със срок“).
-- Досега „Медицинска експертиза“ и „Заповед за насочване“ във „Външни документи“ носеха свой срок
-- (учебна година), отделно от „ТЕЛК/ЛКК“ и „Заповед РЦПППО“ (дата). Оттук нататък:
--   • срокът е само в student_documents (telk / rcpppo);
--   • файловете остават в student_attachments и се показват като „скан“ към съответния документ.
-- Този файл пренася стария срок там, където в student_documents липсва (нищо не се трие).
-- Срок „до 2027/2028“ → 30.06.2028. Безопасно за повторно пускане.

-- 1) няма запис в student_documents → създава се от най-далечния срок на файловете
insert into public.student_documents (student_id, doc_type, valid_until, note, updated_at)
select a.student_id,
       case a.doc_type when 'medical_expertise' then 'telk' else 'rcpppo' end,
       make_date(max(split_part(a.valid_until_year, '/', 2)::int), 6, 30),
       'срокът е пренесен от „Външни документи“',
       now()
from public.student_attachments a
where a.doc_type in ('medical_expertise', 'referral_order')
  and a.valid_until_year ~ '^\d{4}/\d{4}$'
  and not exists (
    select 1 from public.student_documents d
    where d.student_id = a.student_id
      and d.doc_type = case a.doc_type when 'medical_expertise' then 'telk' else 'rcpppo' end)
group by a.student_id, a.doc_type;

-- 2) има запис, но без срок (нито дата, нито „безсрочен“, нито „до края на клас/етап“) → попълва се датата
update public.student_documents d
set valid_until = s.until, updated_at = now()
from (
  select student_id,
         case doc_type when 'medical_expertise' then 'telk' else 'rcpppo' end as dt,
         make_date(max(split_part(valid_until_year, '/', 2)::int), 6, 30) as until
  from public.student_attachments
  where doc_type in ('medical_expertise', 'referral_order') and valid_until_year ~ '^\d{4}/\d{4}$'
  group by student_id, doc_type
) s
where d.student_id = s.student_id and d.doc_type = s.dt
  and d.valid_until is null
  and coalesce(d.indefinite, false) = false
  and coalesce(d.valid_label, '') = '';
