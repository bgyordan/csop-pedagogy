-- ОНЛАЙН СТАЯ + МАТЕРИАЛИ: публикация може да е материал от библиотеката („Добави от библиотеката“).
-- Предлагат се само материали от източници, разрешени за родители и неизтекли. Безопасно за повторно пускане.
-- Изисква 2026-10-11_online_room*.sql и 2026-10-11_materials.sql.
alter table public.online_room_posts add column if not exists material_id uuid references public.materials(id) on delete set null;
