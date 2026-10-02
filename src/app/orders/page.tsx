import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import OrdersClient from './OrdersClient'
import { applyRegistrySort } from '@/lib/registry'
export const dynamic = 'force-dynamic'
const PAGE_SIZE = 20
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; idx?: string; dyear?: string; f?: string; sort?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('role, id').eq('user_id', user.id).single()
  const canAccess = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
  if (!canAccess) redirect('/dashboard')
  const canEdit = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
    const canDelete = profile?.role === 'admin'
  const page = Math.max(1, parseInt(params.page || '1'))
  const q = params.q || ''
  const idx = params.idx || ''
  const f = params.f === 'nofile' ? 'nofile' : ''
  const sort = params.sort || ''
  const curDelo = (() => { const d = new Date(); const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate(); return (m > 9 || (m === 9 && day >= 15)) ? y : y - 1 })()
  const dyear = params.dyear ? parseInt(params.dyear) : curDelo
  const dyStart = `${dyear}-09-15`, dyEnd = `${dyear + 1}-09-14`
  const dyearOptions: { value: string; label: string }[] = []
  for (let y = curDelo; y >= 2025; y--) dyearOptions.push({ value: String(y), label: `${y}/${y + 1}` })
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  // Общите филтри (година, търсене, индекс) — еднакви за списъка и за броячите на бутоните
  const base = (qb: any) => {
    let r = qb.gte('date', dyStart).lte('date', dyEnd)
    if (q) r = r.or(`number.ilike.%${q}%,title.ilike.%${q}%,description.ilike.%${q}%`)
    if (idx) r = r.eq('nomenclature_item', idx)
    return r
  }
  const noFile = (qb: any) => qb.is('file_url', null).not('is_reserved', 'is', true)
  let query = base(supabase.from('orders').select('*, student:students(first_name, last_name)', { count: 'exact' }))
  if (f === 'nofile') query = noFile(query)
  query = applyRegistrySort(query, sort).range(from, to)
  const [{ data: orders, count }, { count: allCount }, { count: noFileCount }] = await Promise.all([
    query,
    base(supabase.from('orders').select('id', { count: 'exact', head: true })),
    noFile(base(supabase.from('orders').select('id', { count: 'exact', head: true }))),
  ])
  const [{ data: students }, { data: staff }, { data: nomenclature }] = await Promise.all([
    supabase.from('students').select('id, first_name, last_name').eq('status', 'active').order('last_name'),
    supabase.from('staff_profiles').select('id, first_name, last_name').eq('is_active', true).order('last_name'),
    supabase.from('nomenclature_items').select('*').eq('for_orders', true).order('section_code').order('item_code'),
  ])
  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6">
        <div className="w-full flex items-center px-6 py-3 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
          <span className="text-sm font-medium text-slate-700 tracking-wide">Регистър заповеди</span>
        </div>
      </div>
      <OrdersClient
        orders={orders || []}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
        searchValue={q}
        filterIndex={idx}
        filterValue={f}
        sortValue={sort}
        counts={{ all: allCount || 0, nofile: noFileCount || 0 }}
        dyearValue={String(dyear)}
        dyearOptions={dyearOptions}
             canEdit={canEdit}
        canDelete={canDelete}
        currentUserId={profile?.id || ''}
        students={students || []}
        staff={staff || []}
        nomenclature={nomenclature || []}
      />
    </div>
  )
}
