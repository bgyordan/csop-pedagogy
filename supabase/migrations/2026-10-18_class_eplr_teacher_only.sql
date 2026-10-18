-- ЕПЛР „само класен ръководител“ за паралелка.
-- За някои паралелки (напр. изнесените в домовете) ЕПЛР не е в пълен състав — работи само класният.
-- Отметката се слага РЪЧНО (не автоматично за изнесените) от админ/ЗДУД/директор или Координиращия екип.
-- Такива паралелки не се броят в „без ЕПЛР екип“. Безопасно за повторно пускане.

alter table public.classes add column if not exists eplr_class_teacher_only boolean not null default false;

create or replace function public.set_class_eplr_teacher_only(p_class uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (
    get_my_role()::text in ('admin', 'zdud', 'director')
    or exists (select 1 from staff_profiles where id = get_my_staff_id() and is_coordinator)
  ) then
    raise exception 'Нямате право да променяте ЕПЛР режима на паралелката';
  end if;
  update public.classes set eplr_class_teacher_only = coalesce(p_value, false) where id = p_class;
end $$;

revoke all on function public.set_class_eplr_teacher_only(uuid, boolean) from public, anon;
grant execute on function public.set_class_eplr_teacher_only(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
