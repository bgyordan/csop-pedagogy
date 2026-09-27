-- Лекторски над норматива: всеки маркиран час помни срока (I/II), по чието разписание е маркиран
alter table public.lecturer_slots add column if not exists term smallint not null default 1;
