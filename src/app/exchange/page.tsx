import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { ArrowLeftRight } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import ExchangeClient from './ExchangeClient'
export const dynamic = 'force-dynamic'

// Обмен с училища: документите от училищата (по имейл) се качват наведнъж в „кутията“,
// преглеждат се и се разнасят — към училището (учебни планове…) или в досието на дете (заповед ЕПЛР…).
export default async function ExchangePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) redirect('/dashboard')

  const [{ data: year }, { data: schools }, { data: kids }, { data: inbox }, { data: recent }] = await Promise.all([
    supabase.from('academic_years').select('id, name').eq('is_current', true).single(),
    supabase.from('sending_schools').select('id, name, city').eq('is_active', true).order('name'),
    supabase.from('students').select('id, first_name, middle_name, last_name, sending_school_id').eq('status', 'active').order('first_name'),
    supabase.from('school_files').select('id, name, original_name, path, size, mime_type, created_at')
      .eq('status', 'inbox').order('created_at', { ascending: true }),
    supabase.from('school_files')
      .select('id, name, path, status, doc_type, filed_at, school_id, student_id, school:sending_schools(name), student:students(first_name, middle_name, last_name)')
      .in('status', ['filed', 'to_student']).not('filed_at', 'is', null)
      .order('filed_at', { ascending: false }).limit(20),
  ])

  const kidList = (kids || []).map((k: any) => ({ id: k.id, name: getFullName(k), schoolId: k.sending_school_id as string | null }))
  const recentList = (recent || []).map((r: any) => ({
    id: r.id, name: r.name, path: r.path, status: r.status, docType: r.doc_type, filedAt: r.filed_at,
    schoolId: r.school_id, studentId: r.student_id,
    where: r.status === 'to_student' ? (r.student ? getFullName(r.student) : 'дете') : (r.school?.name || 'училище'),
  }))

  return (
    <div className="p-4 md:p-8 max-w-[1500px] mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 shadow-sm text-sky-600">
          <ArrowLeftRight size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Обмен с училища</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-light">Качи документите от имейла, виж всеки и го отнеси — към училището или в досието на дете</p>
        </div>
      </header>
      <ExchangeClient
        staffId={me!.id} yearId={year?.id || null} yearName={year?.name || ''}
        schools={(schools || []).map((s: any) => ({ id: s.id, name: s.name, city: s.city }))}
        kids={kidList} initialInbox={inbox || []} initialRecent={recentList}
      />
    </div>
  )
}
