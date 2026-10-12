-- Спонтанен неучебен ден (заповед на кмета, грипна ваканция…), маркиран от „Учебен календар“ в ЕИС.
-- is_school_day = false → денят изпада от декларациите (заместване, над норматив), МОН отчета и „Днес отсъстват“;
-- spontaneous = true → но седмиците в заповедта за лекторски (планирането) не се променят.
-- Причината се пази в notes.
alter table academic_calendar_days add column if not exists spontaneous boolean not null default false;
