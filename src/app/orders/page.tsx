import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import OrdersClient from './OrdersClient'
export const dynamic = 'force-dynamic'
const PAGE_SIZE = 20
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
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
  const page = Math.max(1, parseInt(params.page || '1'))
  const q = params.q || ''
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  let query = supabase
    .from('orders')
    .select('*, student:students(first_name, last_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (q) query = query.or(`number.ilike.%${q}%,title.ilike.%${q}%`)
  const { data: orders, count } = await query
  const [{ data: students }, { data: nomenclature }] = await Promise.all([
    supabase.from('students').select('id, first_name, last_name').eq('status', 'active').order('last_name'),
    supabase.from('nomenclature_items').select('*').eq('for_orders', true).order('section_code').order('item_code'),
  ])
  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6">
  <div className="w-full flex items-center px-6 py-3 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_6px_rgba(15,34,64,0.08)]">
    <span className="text-sm font-semibold text-slate-700 tracking-wide">Регистър на заповедите</span>
  </div>
</div>
      <OrdersClient
        orders={orders || []}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
        searchValue={q}
        canEdit={canEdit}
        currentUserId={profile?.id || ''}
        students={students || []}
        nomenclature={nomenclature || []}
      />
    </div>
  )
}
