'use client'
import { useState } from 'react'
import { Loader2, Check, Plus, X, Save, AlertTriangle, Copy } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { saveMySchedule, checkClassCollision, addSubjectQuick, type MyCell } from './actions'

type Cls = { id: string; name: string }
type Stud = { id: string; name: string }
type Subj = { id: string; name: string; allows_pullout?: boolean }
type Slot = { day: number; period: number; holderType: 'class' | 'ifo'; holderId: string; subjectId: string }

const DAYS = [
  { n: 1, label: 'Понеделник' }, { n: 2, label: 'Вторник' }, { n: 3, label: 'Сряда' },
  { n: 4, label: 'Четвъртък' }, { n: 5, label: 'Петък' },
]


export default function MyScheduleEditor({ academicYearId, term, classes, students, subjects, initialSlots, myClassTeacherIds = [], targetStaffId }: {
  academicYearId: string; term: number; classes: Cls[]; students: Stud[]; subjects: Subj[]; initialSlots: Slot[]; myClassTeacherIds?: string[]; targetStaffId?: string
}) {
  const { toast } = useToast()
  const [subjectList, setSubjectList] = useState<Subj[]>(subjects)
  const [show7, setShow7] = useState<boolean>(() => initialSlots.some(s => s.period === 7))
  const PERIODS = show7 ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6]
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
    if (myClassTeacherIds.length > 0) return `class:${myClassTeacherIds[0]}`
    return ''
  })
  const [grid, setGrid] = useState<Record<string, { holderType: 'class' | 'ifo'; holderId: string; subjectId: string }>>(() => {
    const g: Record<string, any> = {}
    initialSlots.forEach(s => { g[`${s.day}-${s.period}`] = { holderType: s.holderType, holderId: s.holderId, subjectId: s.subjectId } })
    return g
  })
  const [editCell, setEditCell] = useState<string | null>(null)
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
      const res: any = await checkClassCollision(holderId, academicYearId, term, day, period)
      if (res.busy) { setCollisions(prev => ({ ...prev, [key]: `${clsName(holderId)}: заета от ${res.by}${res.subject ? ' (' + res.subject + ')' : ''}` })); return }
    }
    setCollisions(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  // бърз режим: клик на клетка → ако има активен носител, отваряме само избор на предмет
  async function onCellClick(day: number, period: number) {
    const key = `${day}-${period}`
    setEditCell(editCell === key ? null : key)
  }

  async function setSubjectForCell(day: number, period: number, subjectId: string, holderOverride?: string) {
    const key = `${day}-${period}`
    const holderVal = holderOverride || active
    if (!subjectId || !holderVal) return
    const [ht, hid] = holderVal.split(':')
    setGrid(prev => ({ ...prev, [key]: { holderType: ht as 'class' | 'ifo', holderId: hid, subjectId } }))
    setEditCell(null)
    await checkCollisionFor(day, period, ht as 'class' | 'ifo', hid)
  }

  function clearCell(day: number, period: number) {
    const key = `${day}-${period}`
    setGrid(prev => { const n = { ...prev }; delete n[key]; return n })
    setCollisions(prev => { const n = { ...prev }; delete n[key]; return n })
    setEditCell(null)
  }

  async function save() {
    setSaving(true)
    const cells: MyCell[] = Object.entries(grid).map(([key, v]) => {
      const [day, period] = key.split('-').map(Number)
      return { day, period, holderType: v.holderType, holderId: v.holderId, subjectId: v.subjectId }
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

  const hasHolders = myClasses.length > 0 || myStudents.length > 0

  return (
    <div className="space-y-5">
      {/* Срок */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href="?term=1" className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href="?term=2" className={`px-3 py-1.5 rounded-lg text-xs font-medium ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`} style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>
      </div>
      {/* Моите паралелки / ученици */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Работя с — избери активен (в него нареждаш)</div>
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
        {hasHolders && !active && <div className="text-xs text-amber-600 mt-2">Избери активна паралелка/ученик, за да нареждаш.</div>}
      </div>

      {Object.keys(collisions).length > 0 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold mb-0.5">Внимание — застъпване на цяла паралелка:</div>
            {Object.entries(collisions).map(([k, txt]) => <div key={k} className="text-xs">{DAYS.find(d => d.n === Number(k.split('-')[0]))?.label}, {k.split('-')[1]}. час — {txt}</div>)}
          </div>
        </div>
      )}

      {!hasHolders ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-400 text-sm">
          Първо добавете паралелка или ИФО ученик, с които работите.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-14 px-2 py-3 text-[11px] font-semibold text-slate-400 uppercase">Час</th>
                {DAYS.map(d => (
                  <th key={d.n} className="px-2 py-3 text-xs font-semibold text-slate-600 min-w-[155px]">{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(period => (
                <tr key={period} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-2 text-center align-top"><div className="font-semibold text-slate-700 text-sm pt-3">{period}.</div></td>
                  {DAYS.map(d => {
                    const key = `${d.n}-${period}`
                    const cell = grid[key]
                    const collided = collisions[key]
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
                              <div className={`text-[11px] font-medium ${cell.holderType === 'ifo' ? 'text-violet-600' : 'text-blue-600'}`}>
                                {cell.holderType === 'class' ? clsName(cell.holderId) : 'ИФО ' + studName(cell.holderId)}
                              </div>
                              <div className="text-xs text-slate-700 truncate">{subjName(cell.subjectId)}</div>
                            </>
                          ) : (
                            <div className="text-sm text-slate-300 pt-1.5 text-center">+</div>
                          )}
                        </button>
                        {editCell === key && (
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

function CellPicker({ holders, subjects, active, current, onSet, onClear, onClose }: {
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
        <span className="text-[11px] font-semibold text-slate-500 uppercase">Предмет</span>
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
