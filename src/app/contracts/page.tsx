import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import ContractsClient from './ContractsClient'

const PAGE_SIZE = 20

export default async function ContractsPage({
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
    .from('contracts')
    .select('*, student:students(first_name, last_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.or(`number.ilike.%${q}%,subject.ilike.%${q}%,counterparty.ilike.%${q}%`)
  }

  const { data: contracts, count } = await query

  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('status', 'active')
    .order('last_name')

  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Договори</h1>
        <p className="text-slate-500 text-sm mt-1">Регистър на договорите</p>
      </div>
      <ContractsClient
        contracts={contracts || []}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
        searchValue={q}
        canEdit={canEdit}
        currentUserId={profile?.id || ''}
        students={students || []}
      />
    </div>
  )
}
