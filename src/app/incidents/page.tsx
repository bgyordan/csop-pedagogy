// Дневник на случаите — тормоз и инциденти с поведение (вместо хартиената книга).
// Само за екипа: Координационният съвет, координиращият екип и управата. Класният вижда случаите на своите деца в досието.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import IncidentsClient from './IncidentsClient'
export const dynamic = 'force-dynamic'

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ open?: string; year?: string }> }) {
  const sp = await searchParams
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
  if (!isCouncil) redirect('/dashboard')

  // година: текущата по подразбиране; „all“ — всички (дирята остава и след края на годината)
  const { data: years } = await supabase.from('academic_years').select('id, name').order('name', { ascending: false })
  const yearSel = sp.year === 'all' ? 'all' : (years || []).some((y: any) => y.id === sp.year) ? sp.year! : (cy?.id || '')
  let cq = supabase.from('incident_cases').select('*').order('occurred_on', { ascending: false })
  if (yearSel !== 'all') cq = cq.eq('academic_year_id', yearSel)
  const [{ data: casesRaw }, { data: studentsRaw }, { data: enr }, { data: staff }, { data: protocols }, { data: members }] = await Promise.all([
    cq,
    supabase.from('students').select('id, first_name, last_name').eq('status', 'active').order('first_name'),
    supabase.from('student_enrollments').select('student_id, class:classes(name)').eq('academic_year_id', cy?.id),
    supabase.from('staff_profiles').select('id, first_name, last_name'),
    isCouncil ? supabase.from('bullying_protocols').select('id, number, date').eq('academic_year_id', cy?.id).order('number', { ascending: false }) : Promise.resolve({ data: [] as any[] }),
    // съставът на съвета — за подписите в годишния доклад
    supabase.from('bullying_council_members').select('name, position, is_chair, sort').eq('academic_year_id', cy?.id).order('is_chair', { ascending: false }).order('sort').order('name'),
  ])
  // отворен от досието случай от друга година — добавяме го
  let cases = casesRaw || []
  if (sp.open && !cases.some((c: any) => c.id === sp.open)) {
    const { data: one } = await supabase.from('incident_cases').select('*').eq('id', sp.open).maybeSingle()
    if (one) cases = [one, ...cases]
  }
  const ids = cases.map((c: any) => c.id)
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
      cases={cases as any} initialOpen={sp.open || null}
      years={(years || []).map((y: any) => ({ id: y.id, name: y.name }))} yearSel={yearSel} parts={(parts || []) as any} events={(events || []) as any}
      students={students}
      studentNames={Object.fromEntries((old || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`]))}
      staffNames={Object.fromEntries((staff || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`]))}
      protocols={(protocols || []) as any}
      members={(members || []) as any}
    />
  )
}
