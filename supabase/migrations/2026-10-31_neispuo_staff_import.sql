-- Импорт на данни за персонала от НЕИСПУО (Администрация → Импорт от НЕИСПУО):
-- образование, квалификации, ПКС и стаж отиват в профила на професионалното портфолио (pp_profile),
-- а персоналният номер от НЕИСПУО — при служителя, за да се разпознава при следващ импорт.
-- Изисква: 2026-10-26_pro_portfolio.sql. Безопасно за повторно пускане.

alter table public.staff_profiles add column if not exists neispuo_id text;   -- „Персонален образователен номер“
create unique index if not exists staff_profiles_neispuo_id_key on public.staff_profiles (lower(neispuo_id)) where neispuo_id is not null;

-- Справка от последния импорт: длъжност, договор, стаж по видове, кредити, ЗНПР, дата на експорта
alter table public.pp_profile add column if not exists neispuo jsonb;

-- Запис на един импорт. p_rows: [{ staff_id, neispuo_id, set: { education, specialty, teacher_q, other_q, pks,
-- work_since, teacher_since, years_extra }, staff: { position, phone }, neispuo: {…} }]
-- В „set“ и „staff“ идват само полетата, които потребителят е решил да запише.
create or replace function public.neispuo_import_staff(p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  r jsonb; s jsonb; st jsonb; sid uuid; n int := 0;
begin
  if coalesce(get_my_role()::text, '') not in ('admin', 'director', 'zdud') then
    raise exception 'Нямате права за импорт на данни за персонала';
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    sid := (r->>'staff_id')::uuid;
    if sid is null or not exists (select 1 from staff_profiles where id = sid) then continue; end if;
    s := coalesce(r->'set', '{}'::jsonb);
    st := coalesce(r->'staff', '{}'::jsonb);

    if nullif(r->>'neispuo_id', '') is not null then
      update staff_profiles set neispuo_id = null where lower(neispuo_id) = lower(r->>'neispuo_id') and id <> sid;
      update staff_profiles set neispuo_id = r->>'neispuo_id' where id = sid;
    end if;
    if st ? 'position' then update staff_profiles set position = st->>'position' where id = sid; end if;
    if st ? 'phone' then update staff_profiles set phone = st->>'phone' where id = sid; end if;

    insert into pp_profile (staff_id) values (sid) on conflict (staff_id) do nothing;
    update pp_profile set
      education     = case when s ? 'education' then coalesce(s->'education', '[]'::jsonb) else education end,
      specialty     = case when s ? 'specialty' then s->>'specialty' else specialty end,
      teacher_q     = case when s ? 'teacher_q' then (s->>'teacher_q')::boolean else teacher_q end,
      other_q       = case when s ? 'other_q' then s->>'other_q' else other_q end,
      pks           = case when s ? 'pks' then s->>'pks' else pks end,
      work_since    = case when s ? 'work_since' then (s->>'work_since')::date else work_since end,
      teacher_since = case when s ? 'teacher_since' then (s->>'teacher_since')::date else teacher_since end,
      years_extra   = case when s ? 'years_extra' then nullif(s->'years_extra', 'null'::jsonb) else years_extra end,
      neispuo       = coalesce(r->'neispuo', neispuo),
      updated_at    = now()
    where staff_id = sid;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.neispuo_import_staff(jsonb) from public;
grant execute on function public.neispuo_import_staff(jsonb) to authenticated;

notify pgrst, 'reload schema';
