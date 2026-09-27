-- Буква на паралелката в изпращащото училище (9 „а“ ≠ 9 „б“ — различни учебни планове).
-- Класът остава отделно (римско), за да не се чупят справките по клас.
alter table public.students add column if not exists external_class_letter text;

-- 1) ПРЕГЛЕД — кои записи съдържат буква в класа (нищо не се променя):
-- select id, external_class,
--        regexp_replace(external_class, '^\s*(.*?[0-9IVXLCivxlc])\s*[-.]?\s*([а-я])\.?\s*$', '\1') as klas,
--        regexp_replace(external_class, '^\s*(.*?[0-9IVXLCivxlc])\s*[-.]?\s*([а-я])\.?\s*$', '\2') as bukva
-- from public.students
-- where external_class ~ '^\s*.*?[0-9IVXLCivxlc]\s*[-.]?\s*[а-я]\.?\s*$';

-- 2) РАЗДЕЛЯНЕ — „9 а“ / „IXа“ / „5-б“ → клас „9“/„IX“/„5“ + буква „а“/„б“
update public.students
set external_class_letter = regexp_replace(external_class, '^\s*(.*?[0-9IVXLCivxlc])\s*[-.]?\s*([а-я])\.?\s*$', '\2'),
    external_class        = regexp_replace(external_class, '^\s*(.*?[0-9IVXLCivxlc])\s*[-.]?\s*([а-я])\.?\s*$', '\1')
where external_class_letter is null
  and external_class ~ '^\s*.*?[0-9IVXLCivxlc]\s*[-.]?\s*[а-я]\.?\s*$';
