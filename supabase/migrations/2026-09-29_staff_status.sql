-- Статус на неактивен служител: защо е неактивен, до кога, кой го замества.
-- Безопасно за повторно пускане. Кодът работи и ПРЕДИ тази миграция (просто без новите полета).
alter table staff_profiles add column if not exists inactive_reason text;   -- 'long_leave' | 'left' | 'retired'
alter table staff_profiles add column if not exists inactive_until date;    -- при дълъг отпуск: очаквано завръщане
alter table staff_profiles add column if not exists replaced_by uuid references staff_profiles(id) on delete set null;
