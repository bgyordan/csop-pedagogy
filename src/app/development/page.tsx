import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DevOverviewClient from './DevOverviewClient'
import type { OverviewRow } from './DevOverviewClient'
export const dynamic = 'force-dynamic'

// „Развитие на децата“ — обща картина за координиращия екип и психолозите:
// кой етап е направен, профил, цели (GAS) и обща промяна за годината.
export default async function DevelopmentOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  if (!me || !(['admin', 'zdud', 'director', 'psychologist'].includes(me.role) || me.is_coordinator)) redirect('/dashboard')

  const { data: year } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const { data: enr } = await supabase.from('student_enrollments')
    .select('student:students(id, first_name, last_name, status, therapist_psychologist_id), class:classes(id, name)')
    .eq('academic_year_id', year?.id)
  const kids = (enr || []).filter((e: any) => e.student && e.student.status === 'active')
  const ids = kids.map((e: any) => e.student.id)

  const chunk = <T,>(arr: T[], n = 300) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
  const assessments: any[] = [], profiles: any[] = [], targets: any[] = []
  let ready = true
  for (const part of chunk(ids)) {
    const [a, p, t] = await Promise.all([
      supabase.from('dev_assessments').select('id, student_id, academic_year_id, kind, assessed_on, created_at').in('student_id', part),
      supabase.from('dev_profiles').select('student_id, groups, gmfcs, macs, cfcs, asd_level, icf').in('student_id', part),
      supabase.from('dev_targets').select('id, student_id').in('student_id', part),
    ])
    if (a.error) { ready = false; break }
    assessments.push(...(a.data || [])); profiles.push(...(p.data || [])); targets.push(...(t.data || []))
  }

  // Оценки по умения — за общата промяна през годината (входна → последна)
  const scores: any[] = [], gas: any[] = []
  if (ready) {
    for (const part of chunk(assessments.map(a => a.id))) {
      const { data } = await supabase.from('dev_scores').select('assessment_id, skill_id, score').in('assessment_id', part)
      scores.push(...(data || []))
    }
    for (const part of chunk(targets.map(t => t.id))) {
      const { data } = await supabase.from('dev_gas').select('target_id, assessment_id, gas').in('target_id', part)
      gas.push(...(data || []))
    }
  }

  const byStudent = <T extends { student_id: string }>(arr: T[]) => {
    const m: Record<string, T[]> = {}; arr.forEach(x => { (m[x.student_id] ||= []).push(x) }); return m
  }
  const asBy = byStudent(assessments), tgBy = byStudent(targets)
  const prBy = Object.fromEntries(profiles.map(p => [p.student_id, p]))
  const scBy: Record<string, any[]> = {}; scores.forEach(s => { (scBy[s.assessment_id] ||= []).push(s) })
  const asOrder = (l: any[]) => [...l].sort((a, b) => a.assessed_on.localeCompare(b.assessed_on) || a.created_at.localeCompare(b.created_at))

  // Общ % на профила към дадена оценка (последната стойност на всяко умение, без „неприложимо“)
  const overall = (list: any[], upto: number) => {
    const best: Record<string, number> = {}
    list.slice(0, upto + 1).forEach(a => (scBy[a.id] || []).forEach(s => { best[s.skill_id] = s.score }))
    const v = Object.values(best).filter(x => x >= 0)
    return v.length ? Math.round(v.reduce((x, y) => x + y, 0) / (v.length * 4) * 100) : null
  }

  const rows: OverviewRow[] = kids.map((e: any) => {
    const s = e.student
    const all = asOrder(asBy[s.id] || [])
    const inYear = all.filter(a => a.academic_year_id === year?.id)
    const stage = (k: string) => inYear.filter(a => a.kind === k).map(a => a.assessed_on).pop() || null
    let change: number | null = null
    if (inYear.length >= 2) {
      const i0 = all.indexOf(inYear[0]), i1 = all.indexOf(inYear[inYear.length - 1])
      const a = overall(all, i0), b = overall(all, i1)
      if (a !== null && b !== null) change = b - a
    }
    const tIds = (tgBy[s.id] || []).map(t => t.id)
    const order: Record<string, number> = {}; all.forEach((a, i) => { order[a.id] = i })
    const lastGas = tIds.map(tid => gas.filter(g => g.target_id === tid).sort((x, y) => (order[y.assessment_id] ?? -1) - (order[x.assessment_id] ?? -1))[0]?.gas).filter(v => v !== undefined) as number[]
    return {
      id: s.id, name: `${s.first_name} ${s.last_name}`, classId: e.class?.id || '', className: e.class?.name || '',
      mine: s.therapist_psychologist_id === me.id, profile: prBy[s.id] || null,
      entry: stage('entry'), mid: stage('mid'), exit: stage('exit'), last: all.length ? all[all.length - 1].assessed_on : null,
      count: inYear.length,
      targets: tIds.length, rated: lastGas.length, reached: lastGas.filter(v => v >= 0).length, change,
    }
  }).sort((a: OverviewRow, b: OverviewRow) => a.className.localeCompare(b.className, 'bg') || a.name.localeCompare(b.name, 'bg'))

  return <DevOverviewClient rows={rows} ready={ready} yearName={year?.name || ''} isPsychologist={me.role === 'psychologist'} />
}
