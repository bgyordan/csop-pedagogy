import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BullyingCouncilClient from './BullyingCouncilClient'
export const dynamic = 'force-dynamic'

export default async function BullyingCouncilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: members } = await supabase.from('bullying_council_members')
    .select('id, staff_id, name, position, is_chair, sort')
    .eq('academic_year_id', cy?.id).order('is_chair', { ascending: false }).order('sort').order('name')

  const isManager = ['admin', 'zdud', 'director'].includes(me.role)
  const amMember = (members || []).some((m: any) => m.staff_id === me.id)
  if (!isManager && !amMember) redirect('/dashboard')

  const [{ data: staff }, { data: protocols }, { data: studentsRaw }, { data: documents }] = await Promise.all([
    supabase.from('staff_profiles').select('id, first_name, last_name, position').eq('is_active', true).order('last_name'),
    supabase.from('bullying_protocols').select('*').eq('academic_year_id', cy?.id).order('number', { ascending: false }),
    supabase.from('students').select('id, first_name, middle_name, last_name').eq('status', 'active').order('last_name'),
    supabase.from('bullying_documents').select('*').eq('academic_year_id', cy?.id).order('created_at', { ascending: false }),
  ])
  const students = (studentsRaw || []).map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name}`.replace(/\s+/g, ' ').trim() }))

  // случаите от дневника (тази година) — протокол „По казус“ избира случая, вместо да се преписва
  const [{ data: casesRaw }, { data: enr }] = await Promise.all([
    supabase.from('incident_cases').select('id, number, occurred_on, kind, level, forms, description, status, protocol_id').eq('academic_year_id', cy?.id).order('number', { ascending: false }),
    supabase.from('student_enrollments').select('student_id, class:classes(name)').eq('academic_year_id', cy?.id),
  ])
  const caseIds = (casesRaw || []).map((c: any) => c.id)
  const { data: partsRaw } = caseIds.length
    ? await supabase.from('incident_participants').select('case_id, student_id, name, role').in('case_id', caseIds)
    : { data: [] as any[] }
  const clsBy: Record<string, string> = {}
  ;(enr || []).forEach((e: any) => { if (e.class?.name) clsBy[e.student_id] = `паралелка ${e.class.name}` })
  const nameBy = Object.fromEntries(students.map(s => [s.id, s.name]))
  const ORDER: Record<string, number> = { perpetrator: 0, involved: 1, victim: 2, affected: 3, witness: 9 }
  const cases = (casesRaw || []).map((c: any) => {
    const ps = (partsRaw || []).filter((x: any) => x.case_id === c.id && x.role !== 'witness')
      .sort((a: any, b: any) => (ORDER[a.role] ?? 5) - (ORDER[b.role] ?? 5))
    const main = ps.find((x: any) => x.student_id) || null
    return {
      id: c.id, number: c.number, occurred_on: c.occurred_on, kind: c.kind, level: c.level, forms: c.forms || [],
      description: c.description || '', status: c.status, protocol_id: c.protocol_id,
      studentId: main?.student_id || '', cls: main?.student_id ? clsBy[main.student_id] || '' : '',
      who: ps.map((x: any) => (x.student_id ? nameBy[x.student_id] : x.name) || '').filter(Boolean).join(', '),
    }
  })

  return (
    <BullyingCouncilClient
      meId={me.id}
      isManager={isManager}
      members={members || []}
      staff={staff || []}
      protocols={protocols || []}
      students={students}
      documents={documents || []}
      cases={cases}
      academicYearId={cy?.id || null}
      yearName={cy?.name || ''}
    />
  )
}
