import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CorrespondenceClient from './CorrespondenceClient'

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

  const canAccess = ['admin', 'zdud', 'director'].includes(profile?.role || '') || profile?.is_coordinator === true
  if (!canAccess) redirect('/dashboard')

  const canEdit = ['admin', 'zdud', 'director'].includes(profile?.role || '')

  const page = Math.max(1, parseInt(params.page || '1'))
  const q = params.q || ''
  const direction = params.direction || ''
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('correspondence')
    .select('*, student:students(first_name, last_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.or(`number.ilike.%${q}%,subject.ilike.%${q}%,from_whom.ilike.%${q}%,to_whom.ilike.%${q}%`)
  }
  if (direction) {
    query = query.eq('direction', direction)
  }

  const { data: correspondence, count } = await query

  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, last_name')
    .eq('status', 'active')
    .order('last_name')

  const { data: staff } = await supabase
    .from('staff_profiles')
    .select('id, first_name, last_name')
    .eq('status', 'active')
    .order('first_name')

  return (
    <div className="p-4 md:p-8">
      {/* ТВЪРД ЛИНК КЪМ ДАШБОРДА (Главното меню) */}
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#0f2240] transition-colors mb-6 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
        <ArrowLeft className="w-4 h-4" />
        Към главното меню
      </Link>

      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Кореспонденция</h1>
        <p className="text-slate-500 text-sm mt-1">Регистър на входящи, изходящи и вътрешни документи</p>
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
      />
    </div>
  )
}
