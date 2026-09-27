-- В една паралелка (разписание) по едно и също време (ден + час) може да има само ЕДИН учител/час.
-- Преди създаване: изчистени дублираните ФВС часове (класен + учител по ФВС).
create unique index if not exists schedule_slots_one_per_cell on public.schedule_slots (schedule_id, day, period);
