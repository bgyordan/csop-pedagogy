import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarCheck, AlertTriangle, ArrowRight, Check } from 'lucide-react'
import { loadPlanCards, planProgress, isScheduleLocked, settlePlan, subjectCanon, type PlanCard } from '@/lib/curriculum'
import PlanAdminBar from './PlanAdminBar'
export const dynamic = 'force-dynamic'

const r1 = (x: number) => Math.round(x * 10) / 10
const fmt = (x: number) => r1(x).toLocaleString('bg-BG', { maximumFractionDigits: 1 })

// „Разписание по план“ (управата): колко от учебния план (НЕИСПУО) е наредено — по паралелки и по учители;
// утвърждаване на срока и копиране на цялото училище от I във II срок.
export default async function SchedulePlanPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const { term: termParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director'].includes(me.role)) redirect('/dashboard')
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  // по подразбиране — текущият срок (II срок от 3 февруари до лятото)
  const now = new Date(); const md = (now.getMonth() + 1) * 100 + now.getDate()
  const term = termParam === '2' ? 2 : termParam === '1' ? 1 : (md >= 203 && md < 901 ? 2 : 1)

  const { data: subjects } = await supabase.from('subjects').select('id, name')
  const cards = await loadPlanCards(supabase, cy?.id, { all: true }, term, subjects || [])
  const [{ placed, offByStaff, offByClass }, lock, { data: classes }] = await Promise.all([
    planProgress(supabase, cy?.id, term, cards, subjectCanon(subjects || [])),
    isScheduleLocked(supabase, cy?.id, term),
    supabase.from('classes').select('id, name').eq('academic_year_id', cy?.id),
  ])

  type Row = { id: string; name: string; plan: number; done: number; over: number; cards: number; list: PlanCard[]; off: number }
  const sum = (rows: Record<string, Row>, id: string, nm: string, c: PlanCard) => {
    const r = (rows[id] ||= { id, name: nm, plan: 0, done: 0, over: 0, cards: 0, list: [], off: 0 })
    r.plan += c.hours; r.cards++; r.list.push(c)
  }
  // без половин час в разписанието: 0,5 → 0 или 1; 0,5 + 0,5 на учител в паралелка → 1 час (settlePlan)
  const settle = (r: Row) => {
    const st = settlePlan(r.list, placed, c => `${c.place}|${c.classId}|${c.staffId}`)
    r.done = r.plan - st.left; r.over = st.over
  }
  const clsName: Record<string, string> = {}
  ;(classes || []).forEach((c: any) => { clsName[c.id] = c.name })
  const byClass: Record<string, Row> = {}, byTeacher: Record<string, Row> = {}
  const unlinked = new Set<string>()
  cards.filter(c => c.place !== 'info').forEach(c => {
    if (!c.subjectId) unlinked.add(c.subject)
    if (c.place === 'class' && c.classId) sum(byClass, c.classId, clsName[c.classId] || c.holder, c)
    if (c.staffId) sum(byTeacher, c.staffId, c.teacher, c)
  })
  Object.values(byClass).forEach(r => { settle(r); r.off = offByClass[r.id] || 0 })
  Object.values(byTeacher).forEach(r => { settle(r); r.off = offByStaff[r.id] || 0 })
  const sortName = (a: Row, b: Row) => a.name.localeCompare(b.name, 'bg', { numeric: true })
  const classRows = Object.values(byClass).sort(sortName)
  const teacherRows = Object.values(byTeacher).sort(sortName)
  const noTeacher = cards.filter(c => c.place !== 'info' && !c.staffId)
  const tq = term === 2 ? '&term=2' : ''

  const Status = ({ r }: { r: Row }) => {
    const left = r1(r.plan - r.done)
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${left <= 0 ? 'bg-emerald-50 text-emerald-700' : r.done === 0 ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>
        {left <= 0 ? <><Check size={11} /> готово</> : `остават ${fmt(left)}`}
        {r.over > 0 && <span className="text-amber-700"> · +{fmt(r.over)} над</span>}
        {r.off > 0 && <span className="text-rose-700" title="Часове в разписанието с предмет или учител, различни от реда в учебния план — свържи ги в редактора"> · {r.off} извън плана</span>}
      </span>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><CalendarCheck size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Разписание по план</h1>
          <p className="text-slate-500 text-sm mt-0.5">{cy?.name} · какво от учебния план (НЕИСПУО) е наредено в седмичното разписание</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          {[1, 2].map(t => (
            <Link key={t} href={`?term=${t}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === t ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === t ? { backgroundColor: '#0f2240' } : {}}>
              {t === 1 ? 'I' : 'II'} срок
            </Link>
          ))}
        </div>
        <PlanAdminBar term={term} locked={!!lock} lockInfo={lock ? `${lock.by}${lock.by ? ', ' : ''}${new Date(lock.locked_at).toLocaleDateString('bg-BG')}` : ''} />
      </div>

      {cards.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-sm">
          Няма учебен план за срока — качете го от НЕИСПУО в „Учебни планове“.
        </div>
      )}

      {(unlinked.size > 0 || noTeacher.length > 0) && (
        <div className="mb-5 flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            {unlinked.size > 0 && <div>Предмети от НЕИСПУО, още несвързани с предмет в EIS (свързват се от картата в редактора): <span className="font-medium">{Array.from(unlinked).join(', ')}</span></div>}
            {noTeacher.length > 0 && <div>{noTeacher.length} {noTeacher.length === 1 ? 'ред' : 'реда'} от плана без свързан учител — свържете го в „Учебни планове“.</div>}
          </div>
        </div>
      )}

      {classRows.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-2">По паралелки</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="text-left px-4 py-2.5 font-medium">Паралелка</th>
                <th className="text-right px-3 py-2.5 font-medium">По план</th>
                <th className="text-right px-3 py-2.5 font-medium">Наредени</th>
                <th className="text-left px-3 py-2.5 font-medium">Състояние</th>
                <th />
              </tr></thead>
              <tbody>
                {classRows.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-800">{r.name}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmt(r.plan)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmt(r.done)}</td>
                    <td className="px-3 py-2"><Status r={r} /></td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/schedule-plan/class?c=${r.id}${tq}`} className="inline-flex items-center gap-1 text-xs text-[#0f2240] hover:underline">Нареди <ArrowRight size={12} /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {teacherRows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-2">По учители (вкл. ИЧ)</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="text-left px-4 py-2.5 font-medium">Учител</th>
                <th className="text-right px-3 py-2.5 font-medium">По план</th>
                <th className="text-right px-3 py-2.5 font-medium">Наредени</th>
                <th className="text-left px-3 py-2.5 font-medium">Състояние</th>
                <th />
              </tr></thead>
              <tbody>
                {teacherRows.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-800">{r.name}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmt(r.plan)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmt(r.done)}</td>
                    <td className="px-3 py-2"><Status r={r} /></td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/my-schedule/edit?staff=${r.id}${tq}`} className="inline-flex items-center gap-1 text-xs text-[#0f2240] hover:underline">Нареди <ArrowRight size={12} /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
