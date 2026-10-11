-- МАТЕРИАЛИ — начален комплект от ЕИС: ~70 готови PDF материала (работни листове, табла, карти, игри, социални истории).
-- Файловете идват с приложението (public/materials-seed); ръководството ги зарежда в библиотеката с един бутон
-- на страница „Материали“. Тук: превю, брой страници, ключ на комплекта и източникът. Безопасно за повторно пускане.

alter table public.materials add column if not exists preview_path text;   -- малка картинка (JPG) в кофата materials
alter table public.materials add column if not exists pages int;
alter table public.materials add column if not exists seed_key text;       -- само за материалите от комплекта
create unique index if not exists materials_seed_key_idx on public.materials (seed_key) where seed_key is not null;

-- обновяване на файл (при ново издание на комплекта) — само ръководството
drop policy if exists "materials_files_update" on storage.objects;
create policy "materials_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'materials' and get_my_role()::text in ('admin', 'zdud', 'director'))
  with check (bucket_id = 'materials' and get_my_role()::text in ('admin', 'zdud', 'director'));

-- Собствени материали на ЕИС — могат да се дават и на родители (онлайн стая), безсрочно
insert into public.material_sources (name, allow_parents, sort, note) values
  ('ЕИС — начален комплект', true, 0, 'Създадени в ЕИС. Пиктограми Twemoji (CC-BY 4.0), шрифтове Nunito и Andika (SIL OFL) — свободни за използване и разпространение.')
on conflict (name) do nothing;
