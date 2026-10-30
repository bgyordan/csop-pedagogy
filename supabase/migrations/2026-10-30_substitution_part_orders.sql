-- Заместник на заместника: всяка част от разпределението може да има СВОЯ заповед.
-- Издадената заповед не се пипа — новият заместник за дните получава нова заповед (order_id на неговите редове).
-- Безопасно за повторно пускане.
alter table public.substitution_assignments add column if not exists order_id uuid references public.orders(id) on delete set null;

-- Вече разделените замествания с издадена заповед: техните редове са покрити от тази заповед
update public.substitution_assignments a set order_id = s.substitution_order_id
from public.substitutions s
where a.substitution_id = s.id and a.order_id is null and s.substitution_order_id is not null;

notify pgrst, 'reload schema';
