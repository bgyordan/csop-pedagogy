import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import CorrespondenceClient from './CorrespondenceClient'
export const dynamic = 'force-dynamic'
const PAGE_SIZE = 20
export default async function CorrespondencePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; direction?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('role, is_coordinator, id').eq('user_id', user.id).single()
  const canAccess = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '') || profile?.is_coordinator === true
  if (!canAccess) redirect('/dashboard')
  const canEdit = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
  const page = Math.max(1, parseInt(params.page || '1'))
  const q = params.q || ''
  const direction = params.direction || ''
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  let query = supabase
    .from('correspondence')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
  if (q) query = query.or(`number.ilike.%${q}%,subject.ilike.%${q}%,from_whom.ilike.%${q}%,to_whom.ilike.%${q}%`)
  if (direction) query = query.eq('direction', direction)
  const { data: correspondence, count } = await query
  const [{ data: students }, { data: staff }, { data: nomenclature }] = await Promise.all([
    supabase.from('students').select('id, first_name, last_name').eq('status', 'active').order('last_name'),
    supabase.from('staff_profiles').select('id, first_name, last_name').eq('is_active', true).order('last_name'),
    supabase.from('nomenclature_items').select('*').eq('for_correspondence', true).order('section_code').order('item_code'),
  ])
  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex items-center px-5 py-2 rounded-full text-sm font-semibold text-[#0f2240] bg-blue-50/80 border border-blue-100/80 shadow-sm">
          Единен деловоден регистър
        </span>
        <span className="text-slate-400 text-xs">входящи · изходящи · вътрешни</span>
      </div>
      <CorrespondenceClient
        correspondence={correspondence || []}
        totalCount={count || 0}
        page={page}
        pageSize={PAGE_SIZE}
        searchValue={q}
        directionValue={direction}
        canEdit={canEdit}
        currentUserId={profile?.id || ''}
        students={students || []}
        staff={staff || []}
        nomenclature={nomenclature || []}
      />
    </div>
  )
}
