-- Паралелката, от която детето е отписано — за да остане в отчетите (ИУП) за месеца на отписване,
-- след като архивирането махне записването му за годината.
alter table students add column if not exists archived_class_id uuid references classes(id) on delete set null;

-- Вече архивираните, които още стоят в паралелка тази година: запомняме паралелката им…
update students s set archived_class_id = e.class_id
from student_enrollments e
join academic_years y on y.id = e.academic_year_id and y.is_current
where e.student_id = s.id and s.status = 'archived' and s.archived_class_id is null;

-- …и ги махаме от паралелката (както прави архивирането сега)
delete from student_enrollments e
using students s, academic_years y
where e.student_id = s.id and y.id = e.academic_year_id and y.is_current and s.status = 'archived';
