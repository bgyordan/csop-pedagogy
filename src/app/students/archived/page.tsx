import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Archive } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import ArchivedClient from './ArchivedClient'
export const dynamic = 'force-dynamic'

export default async function ArchivedStudentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('staff_profiles').select('role').eq('user_id', user.id).single()
  const canAccess = ['admin', 'zdud', 'director', 'secretary'].includes(profile?.role || '')
  if (!canAccess) redirect('/dashboard')

  const { data: students } = await supabase
    .from('students')
    .select('id, first_name, middle_name, last_name, external_class, archive_reason, archived_at, sending_school:sending_schools(name, city)')
    .eq('status', 'archived')
    .order('archived_at', { ascending: false })

  const rows = (students || []).map((s: any) => ({
    id: s.id,
    name: getFullName(s),
    externalClass: s.external_class || '',
    school: s.sending_school?.name || '',
    schoolCity: s.sending_school?.city || '',
    reason: s.archive_reason || '',
    archivedAt: s.archived_at || null,
  }))

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} /> Към учениците
      </Link>
      <div className="mb-6 flex items-center gap-2">
        <Archive size={20} className="text-slate-400" />
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Архивирани ученици</h1>
          <p className="text-slate-500 text-sm mt-0.5">{rows.length} {rows.length === 1 ? 'ученик' : 'ученика'}</p>
        </div>
      </div>
      <ArchivedClient rows={rows} />
    </div>
  )
}
