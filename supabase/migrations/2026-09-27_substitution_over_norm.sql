-- Заместване: лекторски (над норматив, платено) или вътрешно (в рамките на нормата, без заплащане)
alter table public.substitutions add column if not exists over_norm boolean not null default true;
-- НП винаги е с лекторски
update public.substitutions set over_norm = true where bsch_eligible = true;
