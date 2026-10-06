import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Wallet } from 'lucide-react'
import { loadCurriculum, overWithIch, lecturerOf, TEACHER_NORM, canSeeLecturerReport as canSee } from '@/lib/curriculum'
import type { CurLine } from '@/lib/curriculum'
import LecturerPlanReport from './LecturerPlanReport'
import ClassPlanReport from './ClassPlanReport'
import type { ClassRow } from './ClassPlanReport'
import ReportTabs from './ReportTabs'
import ShortReport from './ShortReport'
import type { PlanRow } from './LecturerPlanReport'
import { loadOwnClasses, groupFields, byStaffGroup } from '@/lib/staff-order'
export const dynamic = 'force-dynamic'

// Справка „Лекторски по учебен план“ — само за четене, изчислена от учебния план (НЕИСПУО).
// Достъп: админ, директор, ЗДУД и деловодството (технически секретар), без ЗАС.

export default async function LecturerPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role, position').eq('user_id', user.id).single()
  if (!canSee(me)) redirect('/reports/hub')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const [{ lines, importedAt }, { data: staff }, { data: ifo }, { data: plans }] = await Promise.all([
    loadCurriculum(supabase, cy?.id, { all: true }),
    supabase.from('staff_profiles').select('*'),
    // ИФО децата в седмичното разписание на учителя (I срок) — кои деца стоят зад ИЧ
    supabase.from('teacher_ifo_slots').select('teacher_id, student:students(first_name, last_name)').eq('academic_year_id', cy?.id).eq('term', 1),
    // ИЧ, признати за лекторски по заповед (Лекторски → Бърза таблица → „лект.“)
    supabase.from('lecturer_plans').select('*').eq('academic_year_id', cy?.id),
  ])
  const ownClass = await loadOwnClasses(supabase, cy?.id)
  const ichLectOf: Record<string, number> = {}
  ;(plans || []).forEach((p: any) => { if (p.ich_lecturer) ichLectOf[p.staff_id] = Number(p.ich_lecturer) })
  const ifoKids: Record<string, Set<string>> = {}
  ;(ifo || []).forEach((r: any) => { if (r.student) (ifoKids[r.teacher_id] ||= new Set()).add(`${r.student.first_name} ${r.student.last_name}`) })

  const byStaff: Record<string, CurLine[]> = {}
  lines.forEach(l => { if (l.staffId) (byStaff[l.staffId] ||= []).push(l) })
  const r1 = (x: number) => Math.round(x * 10) / 10

  const rows: PlanRow[] = (staff || [])
    .filter((s: any) => byStaff[s.id] || (s.is_active !== false && TEACHER_NORM[s.role]))
    .map((s: any) => {
      const ls = byStaff[s.id] || []
      let n1 = 0, n2 = 0, h1 = 0, ich1 = 0, ich2 = 0, ichN1 = 0, ichN2 = 0, ichYear = 0, therapy = 0
      const w1: number[] = [], w2: number[] = []
      ls.forEach(l => {
        if (l.individual) { ich1 += l.h1; ich2 += l.h2; ichN1 += l.h1 * 21 / l.norm; ichN2 += l.h2 * 21 / l.norm; ichYear += l.total; return }
        const k = 21 / l.norm
        h1 += l.h1; n1 += l.h1 * k; n2 += l.h2 * k
        if (k < 1) therapy += l.h1
        if (l.h1) w1.push(l.w1); if (l.h2) w2.push(l.w2)
      })
      const norm = TEACHER_NORM[s.role] ?? null
      const W1 = w1.length ? Math.max(...w1) : 18, W2 = w2.length ? Math.max(...w2) : 18
      // ИЧ допълват до нормата; над нея — само по заповед
      const c1 = norm ? overWithIch(n1, ichN1, norm, ichLectOf[s.id] || 0) : null
      const c2 = norm ? overWithIch(n2, ichN2, norm, ichLectOf[s.id] || 0) : null
      const o1 = c1?.over || 0, o2 = c2?.over || 0
      // за „Кратко“ — общата сметка (същата е и в „Лекторски → Разпредели“)
      const L = lecturerOf(ls, s)
      const { normAll, normYear, yearSimple: yS, yearMixed: yM, diff1, diff2, diffY, ichW1, ichW2, ichYearAll } = L
      // без часове извън ИЧ „под/над“ няма смисъл (иначе излиза −нормата)
      const noMain = !L.hasMain
      const sortBg = (a: string, b: string) => a.localeCompare(b, 'bg', { numeric: true })
      const classes = Array.from(new Set(ls.filter(l => !l.individual).map(l => l.holder))).sort(sortBg)
      const ichClasses = Array.from(new Set(ls.filter(l => l.individual).map(l => l.holder))).sort(sortBg)
      return {
        id: s.id, name: `${s.first_name} ${s.last_name}`, position: s.position || '',
        ...groupFields(s, ownClass),
        hasPlan: ls.length > 0, classes,
        h1: r1(h1), n1: r1(n1), n2: r1(n2), therapy: r1(therapy), norm,
        over1: o1, over2: o2, overYear: Math.round(o1 * W1 + o2 * W2), W1, W2,
        ich1: r1(ich1), ich2: r1(ich2), ichYear: Math.round(ichYear), ichClasses,
        ichFill: c1?.fill || 0, ichLect: c1?.lect || 0,
        normAll, normYear, yearSimple: yS, yearMixed: yM, noIchSimple: L.noIchSimple, noIchMixed: L.noIchMixed, ichYearAll, ichW1, ichW2, diff1: noMain ? null : diff1, diff2: noMain ? null : diff2, diffY: noMain ? null : diffY,
        ifoKids: Array.from(ifoKids[s.id] || []).sort((a, b) => a.localeCompare(b, 'bg')),
        lines: ls.map(l => ({ id: l.id, holder: l.holder, subject: l.subject, h1: l.h1, h2: l.h2, total: l.total, kind: l.kind, individual: l.individual, therapy: l.norm !== 21 })),
      }
    })
    // класни по паралелка → учители → логопеди → рехабилитатори → психолози → възпитатели → ръководство
    .sort(byStaffGroup)

  // ── по паралелки (както е изгледът във вноса): паралелка → предмети, учители, часове ──
  const overOf: Record<string, number> = {}
  rows.forEach(r => { if (r.over1 > 0) overOf[r.id] = r.over1 })
  const byHolder: Record<string, CurLine[]> = {}
  lines.forEach(l => { (byHolder[l.classId || l.holder] ||= []).push(l) })
  const classRows: ClassRow[] = Object.entries(byHolder).map(([key, ls]) => {
    const main = ls.filter(l => !l.individual), ich = ls.filter(l => l.individual)
    const byKind: Record<string, number> = {}
    main.forEach(l => { const k = l.kind || 'друго'; byKind[k] = r1((byKind[k] || 0) + l.h1) })
    return {
      key, name: ls[0].holder, classId: ls[0].classId,
      group: ls[0].classId ? 'class' : /цоуд/i.test(ls[0].holder) ? 'coud' : 'other',
      teachers: Array.from(new Set(main.map(l => l.teacher).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'bg')),
      h1: r1(main.reduce((a, l) => a + l.h1, 0)), h2: r1(main.reduce((a, l) => a + l.h2, 0)),
      total: Math.round(main.reduce((a, l) => a + l.total, 0)), byKind,
      ich1: r1(ich.reduce((a, l) => a + l.h1, 0)), ichTotal: Math.round(ich.reduce((a, l) => a + l.total, 0)),
      lines: ls.map(l => ({ id: l.id, subject: l.subject, teacher: l.teacher, teacherOver: l.staffId ? overOf[l.staffId] || 0 : 0,
        h1: l.h1, h2: l.h2, total: l.total, kind: l.kind, individual: l.individual, therapy: l.norm !== 21 })),
    }
  })

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <Link href="/reports/hub" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 print:hidden">
        <ArrowLeft size={15} /> Назад към справки
      </Link>
      <header className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 text-teal-700"><Wallet size={20} /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Лекторски по учебен план</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {cy?.name} · по учебния план от НЕИСПУО{importedAt ? `, качен ${new Date(importedAt).toLocaleDateString('bg-BG')}` : ''} · само справка
          </p>
        </div>
      </header>
      <ReportTabs
        short={<ShortReport rows={rows.filter(r => r.hasPlan).map(r => ({ name: r.name, position: r.position, group: r.group, groupLabel: r.groupLabel, ownClass: r.ownClass, norm: r.normAll, normYear: r.normYear, ich: r.ichYearAll, ichW1: r.ichW1, ichW2: r.ichW2, diff1: r.diff1, diff2: r.diff2, diffY: r.diffY, simple: r.noIchSimple, mixed: r.noIchMixed, simpleAll: r.yearSimple, mixedAll: r.yearMixed }))} yearName={cy?.name || ''}
          unlinked={Object.entries(lines.filter(l => !l.staffId && l.teacher).reduce((m: Record<string, number>, l) => { m[l.teacher] = (m[l.teacher] || 0) + l.h1; return m }, {}))
            .map(([name, h]) => ({ name, h: Math.round(h * 10) / 10 })).sort((a, b) => a.name.localeCompare(b.name, 'bg'))} />}
        teachers={<LecturerPlanReport rows={rows} yearName={cy?.name || ''} />}
        classes={<ClassPlanReport rows={classRows} yearName={cy?.name || ''} />} />
    </div>
  )
}
