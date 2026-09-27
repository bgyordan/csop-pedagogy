-- Последно / предишно влизане на служителите (показва се в таблото и в „Служители“)
alter table public.staff_profiles
  add column if not exists last_login_at timestamptz,
  add column if not exists prev_login_at timestamptz;

-- първоначално попълване от Supabase Auth
update public.staff_profiles sp
set last_login_at = u.last_sign_in_at
from auth.users u
where u.id = sp.user_id and sp.last_login_at is null;
