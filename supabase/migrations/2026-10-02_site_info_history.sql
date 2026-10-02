-- Сайт, част В:
--  1) site_settings.site_info — данните на сайта, които се сменят от ЕИС → Сайт → Настройки
--     (контакти, работно време, телефони, банкова сметка за дарения, сигнали, обява най-горе на сайта).
--  2) site_audit — история кой какво е променил по сайта. Пише се автоматично от тригери,
--     без значение от кой екран е направена промяната.
-- Безопасно за повторно пускане.

insert into public.site_settings (key, value)
select 'site_info', jsonb_build_object(
  'notice', jsonb_build_object('on', false, 'text', '', 'link', '', 'until', ''),
  'contact', jsonb_build_object(
    'address', 'ул. „Петко Стайнов“ 7', 'city', '9000 Варна',
    'email', 'info-400052@edu.mon.bg', 'phone', '+359 888 490 771',
    'facebook', 'https://www.facebook.com/dimitar.miladinov.374/?locale=bg_BG'),
  'hours', jsonb_build_object('center', '8:00 – 18:00', 'admin', '8:00 – 16:30', 'director', 'вторник, 9:00 – 10:00'),
  'phones', jsonb_build_array(
    jsonb_build_object('name', 'Светлана Иванова', 'role', 'Директор', 'phone', '+359 878 521 823'),
    jsonb_build_object('name', 'Силвия Кьошкерян', 'role', 'Зам.-директор УД', 'phone', '+359 882 699 867'),
    jsonb_build_object('name', 'Йордан Йорданов', 'role', 'Зам.-директор АСД', 'phone', '+359 893 405 737'),
    jsonb_build_object('name', 'Деловодство', 'role', 'Администрация', 'phone', '+359 888 490 771')),
  'bank', jsonb_build_object(
    'to', 'Училищно настоятелство към ЦСОП – Варна', 'iban', 'BG12 UNCR 7000 1523 4891 00',
    'bic', 'UNCRBGSF', 'reason', 'Дарение за дейността на ЦСОП – Варна'),
  'signali', jsonb_build_object('person', 'Силвия Кьошкерян, ЗДУД', 'email', 'signali@csop-varna.bg', 'phone', '')
)
where not exists (select 1 from public.site_settings where key = 'site_info');

-- ───────── история ─────────
create table if not exists public.site_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  staff_id uuid,
  staff_name text,
  tbl text not null,
  op text not null,            -- insert | update | delete
  title text,
  ref_id text
);
create index if not exists site_audit_at_idx on public.site_audit (at desc);

alter table public.site_audit enable row level security;
drop policy if exists "site_audit_read" on public.site_audit;
create policy "site_audit_read" on public.site_audit for select using (auth.role() = 'authenticated');

create or replace function public.site_audit_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb; o jsonb; who uuid; sid uuid; sname text; t text;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  -- само пренареждане (sort_order) или служебно поле не се записва
  if tg_op = 'UPDATE' then
    o := to_jsonb(old);
    if (r - 'sort_order' - 'updated_at') = (o - 'sort_order' - 'updated_at') then return null; end if;
  end if;
  begin who := auth.uid(); exception when others then who := null; end;
  if who is not null then
    select id, first_name || ' ' || last_name into sid, sname from staff_profiles where user_id = who limit 1;
  end if;
  t := coalesce(r->>'title', r->>'name', r->>'key', r->>'caption', '');
  if tg_table_name = 'site_team' then
    select first_name || ' ' || last_name into t from staff_profiles where id = (r->>'staff_id')::uuid;
  end if;
  insert into site_audit (staff_id, staff_name, tbl, op, title, ref_id)
  values (sid, coalesce(sname, 'система'), tg_table_name, lower(tg_op), left(coalesce(t, ''), 200),
          coalesce(r->>'id', r->>'key', r->>'staff_id'));
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['site_news', 'site_documents', 'site_events', 'gallery_albums', 'gallery_photos', 'site_settings', 'site_jobs', 'site_team']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists site_audit_trg on public.%I', t);
      execute format('create trigger site_audit_trg after insert or update or delete on public.%I for each row execute function public.site_audit_log()', t);
    end if;
  end loop;
end $$;
