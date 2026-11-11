-- Професионално портфолио — професионален път и членство (както в EPO.bg, но с попълване в ЕИС):
--   career      — история на длъжностите: [{ "from": "2019-01", "to": null, "institution": "ЦСОП – Варна", "position": "учител …" }]
--   memberships — членство в организации: [{ "org": "СБУ", "from": "2019-01", "to": null, "role": "член" }]
--   motto       — любим цитат / мото (по желание)
-- Работата в ЦСОП по години (паралелки, ЦОУД групи, деца в ЕПЛР екипи) не се пази — чете се от ЕИС.
-- Изисква 2026-10-26_pro_portfolio.sql. Безопасно за повторно пускане.
alter table public.pp_profile add column if not exists career jsonb not null default '[]';
alter table public.pp_profile add column if not exists memberships jsonb not null default '[]';
alter table public.pp_profile add column if not exists motto text;
