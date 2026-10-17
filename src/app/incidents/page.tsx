// Дневник на случаите — тормоз и инциденти с поведение (вместо хартиената книга).
// Записва всеки служител; вижда — съветът и ръководството всички, авторът своите, класният — с децата от паралелката му.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import IncidentsClient from './IncidentsClient'
export const dynamic = 'force-dynamic'

export default async function IncidentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: council, error: rpcErr } = await supabase.rpc('incident_is_council')
  if (rpcErr) return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">Дневникът на случаите още не е подготвен в базата — пуснете SQL файла 2026-10-17_incidents.sql.</div>
    </div>
  )
  const isCouncil = !!council

  const [{ data: cases }, { data: studentsRaw }, { data: enr }, { data: staff }, { data: protocols }] = await Promise.all([
    supabase.from('incident_cases').select('*').eq('academic_year_id', cy?.id).order('occurred_on', { ascending: false }),
    supabase.from('students').select('id, first_name, last_name').eq('status', 'active').order('first_name'),
    supabase.from('student_enrollments').select('student_id, class:classes(name)').eq('academic_year_id', cy?.id),
    supabase.from('staff_profiles').select('id, first_name, last_name'),
    isCouncil ? supabase.from('bullying_protocols').select('id, number, date').eq('academic_year_id', cy?.id).order('number', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
  ])
  const ids = (cases || []).map((c: any) => c.id)
  const [{ data: parts }, { data: events }] = ids.length
    ? await Promise.all([
        supabase.from('incident_participants').select('*').in('case_id', ids),
        supabase.from('incident_events').select('*').in('case_id', ids).order('at'),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  const clsBy: Record<string, string> = {}
  ;(enr || []).forEach((e: any) => { if (e.class?.name) clsBy[e.student_id] = `${e.class.name}` })
  const students = (studentsRaw || []).map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`, cls: clsBy[s.id] ? `паралелка ${clsBy[s.id]}` : undefined }))
  // имена и на деца, които вече не са активни, но са в стари случаи
  const missing = Array.from(new Set((parts || []).map((x: any) => x.student_id).filter((id: string) => id && !students.some(s => s.id === id))))
  const { data: old } = missing.length ? await supabase.from('students').select('id, first_name, last_name').in('id', missing) : { data: [] as any[] }

  return (
    <IncidentsClient
      meId={me.id} isCouncil={isCouncil} isAdmin={['admin', 'zdud', 'director'].includes(me.role)}
      yearId={cy?.id || null} yearName={cy?.name || ''}
      cases={(cases || []) as any} parts={(parts || []) as any} events={(events || []) as any}
      students={students}
      studentNames={Object.fromEntries((old || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`]))}
      staffNames={Object.fromEntries((staff || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`]))}
      protocols={(protocols || []) as any}
    />
  )
}
