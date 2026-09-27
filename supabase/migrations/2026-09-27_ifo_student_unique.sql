-- ИФО дете не може да е при двама учители в един и същ час (ден + номер на час) в срока
create unique index if not exists teacher_ifo_slots_student_slot_uniq
  on public.teacher_ifo_slots (student_id, academic_year_id, term, day, period);
