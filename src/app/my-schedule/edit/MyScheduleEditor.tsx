'use client'
import { useState, useMemo } from 'react'
import { Loader2, Check, Plus, X, Save, AlertTriangle, Copy, Lock, Unlock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { saveMySchedule, checkClassCollision, checkIfoCollision, addSubjectQuick, releaseClassSlot, copyMyScheduleFromTerm1, linkCurriculumSubject, type MyCell } from './actions'
import { PERIOD_TIMES, PERIOD_LABEL, periodsOverlap } from '@/lib/periods'
import { settlePlan, type PlanCard } from '@/lib/curriculum'

type Cls = { id: string; name: string }
type Stud = { id: string; name: string; classId?: string | null }
type Subj = { id: string; name: string; allows_pullout?: boolean }
type Slot = { day: number; period: number; holderType: 'class' | 'ifo'; holderId: string; subjectId: string; group?: boolean }

const DAYS = [
  { n: 1, label: 'Понеделник' }, { n: 2, label: 'Вторник' }, { n: 3, label: 'Сряда' },
  { n: 4, label: 'Четвъртък' }, { n: 5, label: 'Петък' },
]


export default function MyScheduleEditor({ academicYearId, term, classes, students, subjects, initialSlots, myClassTeacherIds = [], targetStaffId, taken = {}, plan = [], norm = 21 }: {
  academicYearId: string; term: number; classes: Cls[]; students: Stud[]; subjects: Subj[]; initialSlots: Slot[]; myClassTeacherIds?: string[]; targetStaffId?: string
  taken?: Record<string, Record<string, { by: string; subject: string }>>
  plan?: PlanCard[]           // часовете по учебния план (НЕИСПУО) за срока
  norm?: number | null        // седмична норма; null — годишна (управата), не се показва
}) {
  const { toast } = useToast()
  const [takenMap, setTakenMap] = useState(taken)
  const [busyOpen, setBusyOpen] = useState<string | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [subjectList, setSubjectList] = useState<Subj[]>(subjects)
  const [show7, setShow7] = useState<boolean>(() => initialSlots.some(s => s.period === 7))
  const [showAfternoon, setShowAfternoon] = useState<boolean>(() => initialSlots.some(s => s.period >= 8))
  const morning = show7 ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6]
  const afternoon = [8, 9, 10, 11, 12]
  const PERIODS = showAfternoon ? [...morning, ...afternoon] : morning
  const [showAddSubj, setShowAddSubj] = useState(false)
  const [newSubjName, setNewSubjName] = useState('')
  const [newSubjPullout, setNewSubjPullout] = useState(false)
  // моите паралелки: класните ми + тези от съществуващи слотове
  const [myClasses, setMyClasses] = useState<string[]>(() => {
    const fromSlots = initialSlots.filter(s => s.holderType === 'class').map(s => s.holderId)
    return Array.from(new Set([...myClassTeacherIds, ...fromSlots]))
  })
  const [myStudents, setMyStudents] = useState<string[]>(
    () => Array.from(new Set(initialSlots.filter(s => s.holderType === 'ifo').map(s => s.holderId)))
  )
  // активен носител — паралелка или ученик, в който цъкам сега
  const [active, setActive] = useState<string>(() => {
    const first = plan.find(c => c.place === 'class' && c.subjectId)
    if (first) return `plan:${first.key}`
    if (myClassTeacherIds.length > 0) return `class:${myClassTeacherIds[0]}`
    return ''
  })
  // картите от плана (предметът се свързва в движение)
  const [cards, setCards] = useState<PlanCard[]>(plan)
  // ИЧ: детето не идва от НЕИСПУО — избира се ръчно; при отваряне се познава от вече наредените часове
  const [ichStudent, setIchStudent] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    const used = new Set<string>()
    plan.filter(c => c.place === 'ich' && c.subjectId).forEach(c => {
      const hit = initialSlots.find(s => s.holderType === 'ifo' && s.subjectId === c.subjectId && !used.has(`${s.holderId}|${s.subjectId}`) &&
        (!c.classId || students.find(st => st.id === s.holderId)?.classId === c.classId))
      if (hit) { out[c.key] = hit.holderId; used.add(`${hit.holderId}|${hit.subjectId}`) }
    })
    return out
  })
  const [linking, setLinking] = useState<string | null>(null)
  const activeCard = active.startsWith('plan:') ? cards.find(c => `plan:${c.key}` === active) || null : null
  const [grid, setGrid] = useState<Record<string, { holderType: 'class' | 'ifo'; holderId: string; subjectId: string; group?: boolean }>>(() => {
    const g: Record<string, any> = {}
    initialSlots.forEach(s => { g[`${s.day}-${s.period}`] = { holderType: s.holderType, holderId: s.holderId, subjectId: s.subjectId, group: !!s.group } })
    return g
  })
  const [editCell, setEditCell] = useState<string | null>(null)
  // „+ група“ върху зает час: паралелката е разделена, влизам в същия час със своята група
  const [groupCell, setGroupCell] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [collisions, setCollisions] = useState<Record<string, string>>({})

  const [showAddClass, setShowAddClass] = useState(false)
  const [showAddStud, setShowAddStud] = useState(false)
  const [studSearch, setStudSearch] = useState('')

  const clsName = (id: string) => classes.find(c => c.id === id)?.name || '?'
  const studName = (id: string) => students.find(s => s.id === id)?.name || '?'
  const subjName = (id: string) => subjectList.find(s => s.id === id)?.name || ''

  const availableClasses = classes.filter(c => !myClasses.includes(c.id))
  const availableStudents = students.filter(s => !myStudents.includes(s.id) &&
    s.name.toLowerCase().includes(studSearch.toLowerCase()))

  const holders = [
    ...myClasses.map(id => ({ val: `class:${id}`, label: `Паралелка ${clsName(id)}`, kind: 'class' as const })),
    ...myStudents.map(id => ({ val: `ifo:${id}`, label: `ИФО: ${studName(id)}`, kind: 'ifo' as const })),
  ]

  async function checkCollisionFor(day: number, period: number, holderType: 'class' | 'ifo', holderId: string) {
    const key = `${day}-${period}`
    if (holderType === 'class') {
      const res: any = await checkClassCollision(holderId, academicYearId, term, day, period, targetStaffId)
      if (res.busy) { setCollisions(prev => ({ ...prev, [key]: `${clsName(holderId)}: заета от ${res.by}${res.subject ? ' (' + res.subject + ')' : ''}` })); return }
    } else {
      const res: any = await checkIfoCollision(holderId, academicYearId, term, day, period, targetStaffId)
      if (res.busy) { setCollisions(prev => ({ ...prev, [key]: `ИФО ${studName(holderId)} е при ${res.by} (${res.at}${res.subject ? ', ' + res.subject : ''})` })); return }
    }
    setCollisions(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  // бърз режим: клик на клетка → ако има активен носител, отваряме само избор на предмет
  async function onCellClick(day: number, period: number) {
    const key = `${day}-${period}`
    setGroupCell(null)
    if (activeCard && activeCard.place !== 'info') { placeFromCard(day, period); return }
    setEditCell(editCell === key ? null : key)
  }

  // ── Нареждане от учебния план: клик на клетка → часът от активната карта (втори клик — маха го) ──
  function placeFromCard(day: number, period: number, group = false) {
    const c = activeCard
    if (!c) return
    if (!c.subjectId) { toast('Първо свържете предмета „' + c.subject + '“ с предмет в EIS', 'error'); return }
    let holder = ''
    if (c.place === 'class' && c.classId) {
      holder = `class:${c.classId}`
      if (!myClasses.includes(c.classId)) setMyClasses(p => [...p, c.classId!])
    } else if (c.place === 'ich') {
      const sid = ichStudent[c.key]
      if (!sid) { toast('Изберете детето, с което е този ИЧ', 'error'); return }
      holder = `ifo:${sid}`
      if (!myStudents.includes(sid)) setMyStudents(p => [...p, sid])
    }
    if (!holder) return
    const key = `${day}-${period}`
    const cur = grid[key]
    if (!group && cur && `${cur.holderType}:${cur.holderId}` === holder && cur.subjectId === c.subjectId) { clearCell(day, period); return }
    setSubjectForCell(day, period, c.subjectId, holder, group)
  }

  async function linkSubject(c: PlanCard, subjectId: string) {
    if (!subjectId) return
    setLinking(c.key)
    const res: any = await linkCurriculumSubject(c.subject, subjectId)
    setLinking(null)
    if (res?.error) { toast(res.error, 'error'); return }
    setCards(prev => prev.map(x => x.subject === c.subject ? { ...x, subjectId } : x))
    if (c.place !== 'info') setActive(`plan:${c.key}`)
    toast('Предметът е свързан')
  }

  async function createAndLink(c: PlanCard) {
    setLinking(c.key)
    const res: any = await addSubjectQuick(c.subject, false)
    if (res?.error) { setLinking(null); toast(res.error, 'error'); return }
    setSubjectList(prev => [...prev, res.subject].sort((a, b) => a.name.localeCompare(b.name, 'bg')))
    await linkSubject(c, res.subject.id)
  }

  async function setSubjectForCell(day: number, period: number, subjectId: string, holderOverride?: string, group?: boolean) {
    const key = `${day}-${period}`
    const holderVal = holderOverride || active
    if (!subjectId || !holderVal) return
    const [ht, hid] = holderVal.split(':')
    const isGroup = group ?? (grid[key]?.group || false)
    setGrid(prev => ({ ...prev, [key]: { holderType: ht as 'class' | 'ifo', holderId: hid, subjectId, group: isGroup } }))
    setEditCell(null)
    setGroupCell(null)
    if (isGroup) { setCollisions(prev => { const n = { ...prev }; delete n[key]; return n }); return }
    await checkCollisionFor(day, period, ht as 'class' | 'ifo', hid)
  }

  function clearCell(day: number, period: number) {
    const key = `${day}-${period}`
    setGrid(prev => { const n = { ...prev }; delete n[key]; return n })
    setCollisions(prev => { const n = { ...prev }; delete n[key]; return n })
    setEditCell(null)
  }

  async function save() {
    const n = Object.keys(allCollisions).length
    if (n > 0 && !confirm(`Има ${n} колизии (виж червеното каре). Да запазя ли все пак?`)) return
    setSaving(true)
    const cells: MyCell[] = Object.entries(grid).map(([key, v]) => {
      const [day, period] = key.split('-').map(Number)
      return { day, period, holderType: v.holderType, holderId: v.holderId, subjectId: v.subjectId, group: !!v.group }
    })
    const res: any = await saveMySchedule(academicYearId, term, cells, targetStaffId)
    if (res.error) { toast('Грешка: ' + res.error, 'error'); setSaving(false); return }
    toast('Разписанието е запазено')
    setSaving(false)
  }

  async function addNewSubject() {
    if (!newSubjName.trim()) return
    const res: any = await addSubjectQuick(newSubjName, newSubjPullout)
    if (res.error) { toast(res.error, 'error'); return }
    if (res.subject) {
      setSubjectList(prev => [...prev, res.subject].sort((a, b) => a.name.localeCompare(b.name, 'bg')))
      setNewSubjName(''); setNewSubjPullout(false); setShowAddSubj(false)
      toast('Предметът е добавен')
    }
  }

  // моите часове, които се застъпват ПО ВРЕМЕ в един ден (напр. 6. час и ИФО 1)
  const ownOverlaps = useMemo(() => {
    const out: Record<string, string> = {}
    const keys = Object.keys(grid)
    keys.forEach(k => {
      const [d, p] = k.split('-').map(Number)
      const other = keys.map(x => x.split('-').map(Number)).find(([d2, p2]) => d2 === d && p2 !== p && periodsOverlap(p, p2))
      if (other) out[k] = `застъпва се по време с ${PERIOD_LABEL[other[1]]}${other[1] < 8 ? '. час' : ''} (${PERIOD_TIMES[other[1]]}) — не можете да сте на две места`
    })
    return out
  }, [grid])
  const allCollisions: Record<string, string> = { ...ownOverlaps, ...collisions }

  // ── Сверка с учебния план: колко часа от всяка карта са наредени, кои клетки са извън плана ──
  const planCheck = useMemo(() => {
    const cellKey = (v: { holderType: string; holderId: string; subjectId: string }) => `${v.holderType === 'class' ? 'c' : 'i'}|${v.holderId}|${v.subjectId}`
    const cardKey = (c: PlanCard) => !c.subjectId ? '' :
      c.place === 'class' ? `c|${c.classId}|${c.subjectId}` : c.place === 'ich' && ichStudent[c.key] ? `i|${ichStudent[c.key]}|${c.subjectId}` : ''
    const pool: Record<string, number> = {}
    Object.values(grid).forEach(v => { const k = cellKey(v); pool[k] = (pool[k] || 0) + 1 })
    const placed: Record<string, number> = {}
    const groups: Record<string, PlanCard[]> = {}
    cards.forEach(c => { const k = cardKey(c); if (k) (groups[k] ||= []).push(c) })
    // еднакви редове (паралелка + предмет) делят наредените часове по ред; излишъкът отива на последния
    Object.entries(groups).forEach(([k, cs]) => {
      let left = pool[k] || 0
      cs.forEach((c, i) => { const n = i === cs.length - 1 ? left : Math.min(left, c.hours); placed[c.key] = n; left -= n })
    })
    const offPlan = new Set(Object.entries(grid).filter(([, v]) => !groups[cellKey(v)]).map(([k]) => k))
    const placeable = cards.filter(c => c.place !== 'info')
    const planH = placeable.reduce((a, c) => a + c.hours, 0)
    // без половин час в разписанието: 0,5 → 0 или 1; 0,5 + 0,5 в една паралелка (или при едно дете) → 1 час
    const st = settlePlan(placeable, placed, c => c.place === 'ich' ? `i|${c.classId}|${ichStudent[c.key] || c.key}` : `c|${c.classId}`)
    const doneH = planH - st.left
    const over = placeable.filter(c => st.card[c.key]?.state === 'over')
    return { placed, offPlan, planH, doneH, over, card: st.card, leftH: st.left }
  }, [grid, cards, ichStudent])
  const hasPlan = cards.length > 0

  const hasHolders = myClasses.length > 0 || myStudents.length > 0 || cards.some(c => c.place !== 'info')
  // заетите от други учители клетки в АКТИВНАТА паралелка
  const activeClassId = active.startsWith('class:') ? active.split(':')[1]
    : (activeCard?.place === 'class' && activeCard.classId) ? activeCard.classId : ''
  const takenHere = activeClassId ? (takenMap[activeClassId] || {}) : {}
  const takenCount = Object.keys(takenHere).length
  // класният на активната паралелка (или мениджър, който нарежда от името на класния) е „шеф“ на паралелката
  const isBoss = !!activeClassId && myClassTeacherIds.includes(activeClassId)

  async function release(day: number, period: number) {
    const key = `${day}-${period}`
    const b = takenHere[key]
    if (!b || !confirm(`Да се освободи ${period}. час (${b.by}${b.subject ? ' · ' + b.subject : ''})? Часът ще изчезне от разписанието на ${b.by}.`)) return
    setReleasing(true)
    const res: any = await releaseClassSlot(activeClassId, academicYearId, term, day, period, targetStaffId)
    setReleasing(false)
    if (res.error) { toast(res.error, 'error'); return }
    setTakenMap(prev => { const n = { ...prev, [activeClassId]: { ...(prev[activeClassId] || {}) } }; delete n[activeClassId][key]; return n })
    setBusyOpen(null)
    toast('Часът е освободен')
  }

  // ── Брой часове: обикновен час = 1, час с „позволява вземане“ (терапии) = 0,7 ──
  const NORM = norm || 21
  // „Час на класа“ винаги = 1, дори да е маркиран с вземане
  const weightOf = (subjectId: string) => {
    const sub = subjectList.find(s => s.id === subjectId)
    if (!sub?.allows_pullout) return 1
    return (sub.name || '').toLowerCase().includes('час на класа') ? 1 : 0.7
  }
  const r1 = (x: number) => Math.round(x * 10) / 10
  const fmt = (x: number) => r1(x).toLocaleString('bg-BG', { maximumFractionDigits: 1 })
  const cellsAll = Object.entries(grid)
  const totalCount = cellsAll.length
  // II срок: копиране на моето разписание от I срок
  const staffQ = targetStaffId ? `&staff=${targetStaffId}` : ''
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [copying, setCopying] = useState(false)
  async function copyTerm1() {
    setCopying(true)
    const res: any = await copyMyScheduleFromTerm1(academicYearId, targetStaffId)
    setCopying(false)
    setConfirmCopy(false)
    if (res?.error) { toast(res.error, 'error'); return }
    toast(`Копирани ${res.count} часа от I срок`, 'success')
    setTimeout(() => window.location.reload(), 900)
  }
  const pulloutCount = cellsAll.filter(([, v]) => weightOf(v.subjectId) < 1).length
  const weighted = r1(cellsAll.reduce((a, [, v]) => a + weightOf(v.subjectId), 0))
  const normOk = weighted >= NORM

  return (
    <div className="space-y-5">
      {/* Срок */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2${staffQ}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>
        {term === 2 && (
          confirmCopy ? (
            <span className="inline-flex items-center gap-2 text-xs text-slate-600">
              Разписанието за II срок ще се замени с това от I срок. Продължаваме?
              <button onClick={copyTerm1} disabled={copying}
                className="px-2.5 py-1 rounded-lg border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 disabled:opacity-50">
                {copying ? <Loader2 size={12} className="animate-spin" /> : 'Да'}
              </button>
              <button onClick={() => setConfirmCopy(false)} disabled={copying}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Не</button>
            </span>
          ) : (
            <button onClick={() => setConfirmCopy(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-[#0f2240] hover:bg-slate-50 hover:shadow-sm transition">
              <Copy size={13} /> Копирай от I срок
            </button>
          )
        )}
      </div>
      {/* Учебен план (НЕИСПУО) — оттук се нарежда разписанието */}
      {hasPlan && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">По учебния план (НЕИСПУО) · {term === 2 ? 'II' : 'I'} срок — избери час и цъкай в клетките</div>
            {planCheck.planH > 0 && (
              <div className={`text-xs font-medium ${planCheck.leftH <= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {planCheck.leftH <= 0 ? 'всичко по плана е наредено' : `остават ${fmt(planCheck.leftH)} от ${fmt(planCheck.planH)} ч.`}
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(c => {
              const n = planCheck.placed[c.key] || 0
              const isActive = active === `plan:${c.key}`
              const info = c.place === 'info'
              const cs = planCheck.card[c.key]
              const state = info ? '' : cs?.state === 'over' ? 'over' : cs?.state === 'done' ? 'done' : ''
              const kids = c.place === 'ich' ? (students.filter(st => !c.classId || st.classId === c.classId).length ? students.filter(st => !c.classId || st.classId === c.classId) : students) : []
              return (
                <div key={c.key}
                  onClick={() => { if (!info && c.subjectId) setActive(isActive ? '' : `plan:${c.key}`) }}
                  className={`rounded-xl border px-3 py-2 transition-all ${info ? 'bg-slate-50 border-slate-200 text-slate-500'
                    : isActive ? (c.place === 'ich' ? 'border-violet-500 ring-2 ring-violet-200 bg-violet-50 cursor-pointer' : 'border-[#0f2240] ring-2 ring-slate-200 bg-blue-50 cursor-pointer')
                    : c.subjectId ? 'bg-white border-slate-200 hover:border-slate-400 cursor-pointer' : 'bg-amber-50/50 border-amber-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`text-[11px] font-medium truncate ${c.place === 'ich' ? 'text-violet-600' : info ? 'text-slate-500' : 'text-blue-600'}`}>
                        {c.place === 'ich' ? 'ИЧ · ' : ''}{c.holder}
                      </div>
                      <div className="text-sm text-slate-800 leading-snug break-words">
                        {c.subject}
                        {c.kind && c.kind !== 'ЗП' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-600">{c.kind}</span>}
                        {c.h1 !== c.h2 && <span title="Часове по срокове: I срок – II срок" className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded border bg-amber-50 border-amber-200 text-amber-800 tabular-nums">{fmt(c.h1)}-{fmt(c.h2)}</span>}
                      </div>
                    </div>
                    <div className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${info ? 'bg-slate-100 text-slate-500'
                      : state === 'over' ? 'bg-amber-100 text-amber-800' : state === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                      title={info ? 'часове седмично по плана' : `наредени ${n} от ${fmt(c.hours)} ч. седмично по плана`}>
                      {info ? `${fmt(c.hours)} ч.` : state === 'done' ? <><Check size={11} className="inline -mt-0.5" /> готово</>
                        : state === 'over' ? `+${fmt(cs?.over || 0)} над плана` : `остават ${fmt(cs?.left || 0)}${cs?.shared ? ' (общо)' : ''}`}
                    </div>
                  </div>
                  {c.note && <div className="text-[11px] text-slate-400 mt-0.5">{c.note}</div>}
                  {!info && !c.subjectId && (
                    <div className="mt-1.5 space-y-1" onClick={e => e.stopPropagation()}>
                      <div className="text-[11px] text-amber-700">Предметът не е свързан с предмет в EIS:</div>
                      <select defaultValue="" disabled={linking === c.key} onChange={e => linkSubject(c, e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none">
                        <option value="">— Избери предмет —</option>
                        {subjectList.map(sb => <option key={sb.id} value={sb.id}>{sb.name}</option>)}
                      </select>
                      <button onClick={() => createAndLink(c)} disabled={linking === c.key}
                        className="text-[11px] text-[#0f2240] hover:underline disabled:opacity-50">
                        {linking === c.key ? <Loader2 size={11} className="inline animate-spin" /> : '+'} Създай предмет „{c.subject}“
                      </button>
                    </div>
                  )}
                  {c.place === 'ich' && c.subjectId && (
                    <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                      <select value={ichStudent[c.key] || ''}
                        onChange={e => { const v = e.target.value; setIchStudent(p => ({ ...p, [c.key]: v })); if (v) setActive(`plan:${c.key}`) }}
                        className="w-full px-2 py-1 border border-violet-200 rounded-lg text-xs bg-white focus:outline-none">
                        <option value="">— С кое дете е ИЧ? —</option>
                        {kids.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Моите паралелки / ученици */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{hasPlan ? 'Извън учебния план (ръчно) — паралелка или ИФО ученик, после предмет' : 'Работя с — избери активен (в него нареждаш)'}</div>
        <div className="flex flex-wrap gap-2 items-center">
          {holders.map(h => (
            <button key={h.val} onClick={() => setActive(h.val)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                active === h.val
                  ? (h.kind === 'ifo' ? 'bg-violet-600 text-white border-violet-600' : 'bg-[#0f2240] text-white border-[#0f2240]')
                  : (h.kind === 'ifo' ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-blue-50 text-blue-700 border-blue-100')
              }`}>
              {h.label}
              <span onClick={e => { e.stopPropagation();
                if (h.kind === 'class') setMyClasses(p => p.filter(x => x !== h.val.split(':')[1]))
                else setMyStudents(p => p.filter(x => x !== h.val.split(':')[1]))
                if (active === h.val) setActive('')
              }} className="hover:opacity-70"><X size={13} /></span>
            </button>
          ))}
          {/* добавяне паралелка */}
          <div className="relative">
            <button onClick={() => { setShowAddClass(v => !v); setShowAddStud(false) }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-slate-300 text-slate-500 text-sm hover:bg-slate-50">
              <Plus size={13} /> Паралелка
            </button>
            {showAddClass && (
              <div className="absolute z-30 mt-1 w-56 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                {availableClasses.map(c => (
                  <button key={c.id} onClick={() => { setMyClasses(p => [...p, c.id]); setActive(`class:${c.id}`); setShowAddClass(false) }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700">Паралелка {c.name}</button>
                ))}
                {availableClasses.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Няма други</div>}
              </div>
            )}
          </div>
          {/* добавяне ИФО */}
          <div className="relative">
            <button onClick={() => { setShowAddStud(v => !v); setShowAddClass(false) }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-slate-300 text-slate-500 text-sm hover:bg-slate-50">
              <Plus size={13} /> ИФО ученик
            </button>
            {showAddStud && (
              <div className="absolute z-30 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                <input autoFocus value={studSearch} onChange={e => setStudSearch(e.target.value)} placeholder="Търси ученик…"
                  className="w-full px-2 py-1.5 mb-1 border border-slate-200 rounded-lg text-sm focus:outline-none" />
                <div className="max-h-44 overflow-y-auto">
                  {availableStudents.slice(0, 30).map(s => (
                    <button key={s.id} onClick={() => { setMyStudents(p => [...p, s.id]); setActive(`ifo:${s.id}`); setShowAddStud(false); setStudSearch('') }}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-50 text-slate-700 rounded">{s.name}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {hasHolders && !active && <div className="text-xs text-amber-600 mt-2">{hasPlan ? 'Избери час от учебния план или паралелка/ученик, за да нареждаш.' : 'Избери активна паралелка/ученик, за да нареждаш.'}</div>}
        {takenCount > 0 && <div className="text-xs text-slate-500 mt-2">Сивите клетки са заети от други учители в паралелка {clsName(activeClassId)} ({takenCount} ч.).{isBoss ? ' Като класен можеш да освободиш час с клик върху него.' : ''}</div>}
      </div>

      {hasHolders && norm !== null && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Часове седмично</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-semibold ${normOk ? 'text-emerald-600' : 'text-amber-600'}`}>{fmt(weighted)}</span>
                <span className="text-sm text-slate-500">от норма {NORM}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {totalCount} {totalCount === 1 ? 'час' : 'часа'} в разписанието{pulloutCount > 0 ? ` · от тях ${pulloutCount} × 0,7 (с вземане)` : ''}
              </div>
            </div>
            <div className={`text-xs font-medium px-3 py-1.5 rounded-full ${normOk ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
              {normOk ? (weighted > NORM ? `Нормата е изпълнена (+${fmt(weighted - NORM)})` : 'Нормата е изпълнена') : `Липсват ${fmt(NORM - weighted)}`}
            </div>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${normOk ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, (weighted / NORM) * 100)}%` }} />
          </div>
        </div>
      )}

      {Object.keys(allCollisions).length > 0 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Внимание — колизии:</div>
            {Object.entries(allCollisions).map(([k, txt]) => <div key={k} className="text-xs">{DAYS.find(d => d.n === Number(k.split('-')[0]))?.label}, {PERIOD_LABEL[Number(k.split('-')[1])]}{Number(k.split('-')[1]) < 8 ? '. час' : ''} — {txt}</div>)}
          </div>
        </div>
      )}

      {hasPlan && (planCheck.over.length > 0 || planCheck.offPlan.size > 0) && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Разлика с учебния план (може да се запази):</div>
            {planCheck.over.map(c => (
              <div key={c.key} className="text-xs">{c.place === 'ich' ? 'ИЧ · ' : ''}{c.holder} · {c.subject} — наредени {planCheck.placed[c.key]}, по план {fmt(c.hours)}</div>
            ))}
            {planCheck.offPlan.size > 0 && <div className="text-xs">{planCheck.offPlan.size} {planCheck.offPlan.size === 1 ? 'час не е' : 'часа не са'} в учебния план (отбелязани „извън плана“)</div>}
          </div>
        </div>
      )}

      {!hasHolders ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400 text-sm">
          Първо добавете паралелка или ИФО ученик, с които работите.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-14 px-2 py-3 text-[11px] font-semibold text-slate-400 uppercase">Час</th>
                {DAYS.map(d => (
                  <th key={d.n} className="px-2 py-3 text-xs font-semibold text-slate-600">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(period => (
                <>
                {period === 3 && (
                  <tr key="gm" className="border-b border-slate-100">
                    <td className="px-2 py-0.5 text-center"><div className="text-[9px] text-amber-500 font-medium">ГМ</div></td>
                    <td colSpan={DAYS.length} className="px-2 py-0.5"><div className="text-[9px] text-slate-300">голямо междучасие</div></td>
                  </tr>
                )}
                <tr key={period} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-2 text-center align-top">
                    <div className="font-semibold text-slate-700 text-sm pt-2">{PERIOD_LABEL[period]}{period <= 7 ? '.' : ''}</div>
                    <div className="text-[9px] text-slate-400 leading-tight">{PERIOD_TIMES[period]}</div>
                  </td>
                  {DAYS.map(d => {
                    const key = `${d.n}-${period}`
                    const cell = grid[key]
                    const collided = allCollisions[key]
                    const busy = !cell ? takenHere[key] : undefined
                    if (busy) return (
                      <td key={d.n} className="px-1.5 py-1.5 align-top relative">
                        <div title={`Заето: ${busy.by}${busy.subject ? ' · ' + busy.subject : ''}`}
                          onClick={() => isBoss && setBusyOpen(busyOpen === key ? null : key)}
                          style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(148,163,184,0.16) 0 6px, rgba(255,255,255,0) 6px 12px)' }}
                          className={`w-full min-h-[56px] rounded-xl bg-slate-50 border border-slate-300 px-2.5 py-2 select-none ${isBoss ? 'cursor-pointer hover:border-amber-400 hover:shadow-sm' : 'cursor-not-allowed'}`}>
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
                            {isBoss ? <Unlock size={11} className="text-amber-500" /> : <Lock size={11} />} Зает
                          </div>
                          <div className="text-[11px] font-medium text-slate-700 truncate">{busy.by}</div>
                          {busy.subject && <div className="text-[11px] text-slate-500 line-clamp-2 break-words" title={busy.subject}>{busy.subject}</div>}
                        </div>
                        <button onClick={e => { e.stopPropagation(); setBusyOpen(null); if (activeCard && activeCard.place === 'class') { placeFromCard(d.n, period, true); return } setGroupCell(key); setEditCell(key) }}
                          title="Паралелката е разделена на групи — влизам в същия час със своята група"
                          className="absolute bottom-2.5 right-2.5 text-[10px] px-1.5 py-0.5 rounded-md border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50">
                          + група
                        </button>
                        {editCell === key && groupCell === key && (
                          <CellPicker
                            holders={holders.filter(h => h.val === active)}
                            subjects={subjectList}
                            active={active}
                            title="Предмет за моята група"
                            onSet={(subjId) => setSubjectForCell(d.n, period, subjId, active, true)}
                            onClear={() => {}}
                            onClose={() => { setEditCell(null); setGroupCell(null) }}
                          />
                        )}
                        {isBoss && busyOpen === key && (
                          <div className="absolute z-40 mt-1 left-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-slate-500 uppercase">Зает час</span>
                              <button onClick={() => setBusyOpen(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                            </div>
                            <div className="text-sm text-slate-700">{busy.by}</div>
                            {busy.subject && <div className="text-xs text-slate-500">{busy.subject}</div>}
                            <button onClick={() => release(d.n, period)} disabled={releasing}
                              className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-50 disabled:opacity-50">
                              {releasing ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Освободи часа
                            </button>
                          </div>
                        )}
                      </td>
                    )
                    return (
                      <td key={d.n} className="px-1.5 py-1.5 align-top relative">
                        <button onClick={() => onCellClick(d.n, period)}
                          className={`w-full min-h-[56px] rounded-xl border px-2.5 py-2 text-left transition-all ${
                            collided ? 'border-rose-300 bg-rose-50' :
                            cell ? 'border-slate-200 bg-slate-50 hover:border-slate-400' :
                            'border-dashed border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                          }`}>
                          {cell ? (
                            <>
                              <div className={`text-[11px] font-medium truncate ${cell.holderType === 'ifo' ? 'text-violet-600' : 'text-blue-600'}`}>
                                {cell.holderType === 'class' ? clsName(cell.holderId) : 'ИФО ' + studName(cell.holderId)}
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="text-xs text-slate-700 leading-snug line-clamp-2 break-words min-w-0" title={subjName(cell.subjectId)}>{subjName(cell.subjectId)}</div>
                                {weightOf(cell.subjectId) < 1 && <span className="shrink-0 text-[9px] px-1 rounded bg-teal-50 text-teal-700 border border-teal-100">0,7</span>}
                              </div>
                              {hasPlan && planCheck.offPlan.has(key) && (
                                <div className="text-[9px] text-amber-700" title="Този час не е в учебния план от НЕИСПУО">извън плана</div>
                              )}
                              {(cell.group || (cell.holderType === 'class' && cell.holderId === activeClassId && !!takenHere[key])) && (
                                <div className="text-[10px] text-indigo-700 truncate" title={takenHere[key] ? `Група · заедно с ${takenHere[key].by}` : 'Група'}>
                                  <span className="px-1 rounded bg-indigo-50 border border-indigo-100 mr-1">гр.</span>
                                  {takenHere[key] && cell.holderId === activeClassId ? takenHere[key].by : ''}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-slate-300 pt-1.5 text-center">+</div>
                          )}
                        </button>
                        {editCell === key && !groupCell && (
                          <CellPicker
                            holders={holders}
                            subjects={subjectList}
                            active={active}
                            current={cell}
                            onSet={(subjId, holderVal) => setSubjectForCell(d.n, period, subjId, holderVal)}
                            onClear={() => clearCell(d.n, period)}
                            onClose={() => setEditCell(null)}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasHolders && (
        <div className="flex flex-wrap items-center gap-2">
          {!show7 ? (
            <button onClick={() => setShow7(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"><Plus size={13} /> Добави 7-ми час</button>
          ) : (
            <button onClick={() => { setShow7(false); setGrid(prev => { const n = { ...prev }; DAYS.forEach(d => delete n[`${d.n}-7`]); return n }) }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600"><X size={13} /> Премахни 7-ми час</button>
          )}
          {!showAfternoon ? (
            <button onClick={() => setShowAfternoon(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"><Plus size={13} /> Следобедни ИФО часове</button>
          ) : (
            <button onClick={() => { setShowAfternoon(false); setGrid(prev => { const n = { ...prev }; DAYS.forEach(d => afternoon.forEach(p => delete n[`${d.n}-${p}`])); return n }) }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600"><X size={13} /> Премахни следобедни</button>
          )}
          <button onClick={() => setShowAddSubj(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"><Plus size={13} /> Нов предмет</button>
        </div>
      )}

      {showAddSubj && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={newSubjName} onChange={e => setNewSubjName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNewSubject()}
              placeholder="Име на предмета (може съставно: БЕЛ/История)"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <label className="flex items-center gap-2 text-xs text-slate-600 px-2 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={newSubjPullout} onChange={e => setNewSubjPullout(e.target.checked)} className="rounded" /> позволява вземане
            </label>
            <button onClick={addNewSubject} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#0f2240' }}><Check size={14} /> Добави</button>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={save} disabled={saving || !hasHolders}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Запази разписанието
        </button>
      </div>
    </div>
  )
}

function CellPicker({ holders, subjects, active, current, onSet, onClear, onClose, title = 'Предмет' }: {
  title?: string
  holders: { val: string; label: string; kind: 'class' | 'ifo' }[]
  subjects: Subj[]
  active: string
  current?: { holderType: 'class' | 'ifo'; holderId: string; subjectId: string }
  onSet: (subjectId: string, holderVal?: string) => void
  onClose: () => void
  onClear: () => void
}) {
  // по подразбиране носителят е активният (или текущия на клетката)
  const [holder, setHolder] = useState<string>(
    current ? `${current.holderType}:${current.holderId}` : active
  )
  const [subject, setSubject] = useState<string>(current?.subjectId || '')
  return (
    <div className="absolute z-40 mt-1 left-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase">{title}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>
      {/* носител — по подразбиране активният, но може да се смени за този час */}
      {holders.length > 1 && (
        <select value={holder} onChange={e => setHolder(e.target.value)}
          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none text-slate-600">
          {holders.map(h => <option key={h.val} value={h.val}>{h.label}</option>)}
        </select>
      )}
      <select value={subject} onChange={e => { setSubject(e.target.value); if (e.target.value) onSet(e.target.value, holder) }}
        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none" autoFocus>
        <option value="">— Избери предмет —</option>
        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {current && <button onClick={onClear} className="text-xs text-rose-500 hover:text-rose-700">Изчисти този час</button>}
    </div>
  )
}
