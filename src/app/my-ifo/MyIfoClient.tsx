'use client'
import { useState, useMemo, useTransition } from 'react'
import { Save, Plus, Loader2, Copy, Check, Trash2, GraduationCap } from 'lucide-react'
import { saveTeacherIfoSlots, copyTeacherIfoFromTerm1, addSubject } from './actions'

interface Subject { id: string; name: string; allows_pullout: boolean }
interface IfoStudent { id: string; name: string; className: string }
interface SlotData { student_id: string; day: number; period: number; subject_id: string | null }
interface Props {
  academicYearId: string
  term: number
  ifoStudents: IfoStudent[]
  subjects: Subject[]
  existingSlots: SlotData[]
}

const DAYS = [
  { n: 1, label: 'Понеделник', short: 'Пн' },
  { n: 2, label: 'Вторник', short: 'Вт' },
  { n: 3, label: 'Сряда', short: 'Ср' },
  { n: 4, label: 'Четвъртък', short: 'Чт' },
  { n: 5, label: 'Петък', short: 'Пт' },
]
// Готови следобедни ИФО слотове (по реалните времена от практиката)
const IFO_PERIOD_TIMES: Record<number, string> = {
  1: '12:00–12:35',
  2: '12:30–13:05',
  3: '13:10–13:45',
  4: '13:20–13:55',
  5: '13:40–14:15',
  6: '13:50–14:25',
  7: '14:30–15:05',
  8: '15:10–15:45',
}
const ALL_PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

type GridSlot = { day: number; period: number; subjectId: string }

export function MyIfoClient({ academicYearId, term, ifoStudents, subjects: initialSubjects, existingSlots }: Props) {
  const [pending, startTransition] = useTransition()
  const [subjects, setSubjects] = useState(initialSubjects)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [selectedStudent, setSelectedStudent] = useState<string>(ifoStudents[0]?.id || '')

  const [slotsByStudent, setSlotsByStudent] = useState<Record<string, GridSlot[]>>(() => {
    const m: Record<string, GridSlot[]> = {}
    existingSlots.forEach(s => {
      if (!m[s.student_id]) m[s.student_id] = []
      if (s.subject_id) m[s.student_id].push({ day: s.day, period: s.period, subjectId: s.subject_id })
    })
    return m
  })

  const [addDay, setAddDay] = useState<number>(1)
  const [addPeriod, setAddPeriod] = useState<number>(1)
  const [addSubjectId, setAddSubjectId] = useState<string>('')

  const [showAddSubj, setShowAddSubj] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPullout, setNewPullout] = useState(false)

  const currentSlots = slotsByStudent[selectedStudent] || []

  const takenForDay = useMemo(() => {
    const set = new Set<string>()
    currentSlots.forEach(s => set.add(`${s.day}-${s.period}`))
    return set
  }, [currentSlots])

  const freePeriods = useMemo(
    () => ALL_PERIODS.filter(p => !takenForDay.has(`${addDay}-${p}`)),
    [takenForDay, addDay]
  )

  const selectedStudentObj = ifoStudents.find(s => s.id === selectedStudent)

  function addSlot() {
    if (!addSubjectId) { setMsg({ type: 'err', text: 'Изберете предмет' }); return }
    if (takenForDay.has(`${addDay}-${addPeriod}`)) { setMsg({ type: 'err', text: 'Този слот вече е зает' }); return }
    setSlotsByStudent(prev => ({
      ...prev,
      [selectedStudent]: [...(prev[selectedStudent] || []), { day: addDay, period: addPeriod, subjectId: addSubjectId }],
    }))
    setMsg(null)
    const nextFree = ALL_PERIODS.find(p => p !== addPeriod && !takenForDay.has(`${addDay}-${p}`))
    if (nextFree) setAddPeriod(nextFree)
  }

  function removeSlot(day: number, period: number) {
    setSlotsByStudent(prev => ({
      ...prev,
      [selectedStudent]: (prev[selectedStudent] || []).filter(s => !(s.day === day && s.period === period)),
    }))
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    const slots = currentSlots.map(s => ({ day: s.day, period: s.period, subjectId: s.subjectId }))
    const res = await saveTeacherIfoSlots(selectedStudent, academicYearId, term, slots)
    setSaving(false)
    if (res.error) { setMsg({ type: 'err', text: res.error }); return }
    setMsg({ type: 'ok', text: 'Часовете са запазени.' })
  }

  async function handleAddSubject() {
    if (!newName.trim()) return
    const res = await addSubject(newName, newPullout)
    if (res.error) { setMsg({ type: 'err', text: res.error }); return }
    if (res.subject) {
      setSubjects(prev => [...prev, res.subject].sort((a, b) =>
        (b.allows_pullout ? 1 : 0) - (a.allows_pullout ? 1 : 0) || a.name.localeCompare(b.name, 'bg')))
      setAddSubjectId(res.subject.id)
      setNewName(''); setNewPullout(false); setShowAddSubj(false)
    }
  }

  function handleCopyTerm1() {
    startTransition(async () => {
      const res = await copyTeacherIfoFromTerm1(selectedStudent, academicYearId)
      if (res.error) { setMsg({ type: 'err', text: res.error }); return }
      if (res.slots) {
        setSlotsByStudent(prev => ({
          ...prev,
          [selectedStudent]: res.slots.filter((s: any) => s.subject_id)
            .map((s: any) => ({ day: s.day, period: s.period, subjectId: s.subject_id })),
        }))
        setMsg({ type: 'ok', text: 'Копирано от I срок. Не забравяй да запазиш.' })
      }
    })
  }

  const subjName = (id: string) => subjects.find(s => s.id === id)?.name || '—'

  if (ifoStudents.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <GraduationCap size={36} className="mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-medium text-slate-600">Няма деца на индивидуална форма на обучение</p>
        <p className="text-xs text-slate-400 mt-1">Когато дете бъде маркирано като ИФО, ще се появи тук.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Срок */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2`} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>
        {term === 2 && (
          <button onClick={handleCopyTerm1} disabled={pending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />} Копирай от I срок
          </button>
        )}
      </div>

      {/* Избор на ИФО дете — падащо меню */}
      <div>
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Изберете дете (ИФО)</label>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
              className="w-full text-sm font-medium py-2.5 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 appearance-none cursor-pointer">
              {ifoStudents.map(st => {
                const count = (slotsByStudent[st.id] || []).length
                return (
                  <option key={st.id} value={st.id}>
                    {st.name}{st.className ? ` · ${st.className}` : ''}{count > 0 ? `  (${count} ч.)` : ''}
                  </option>
                )
              })}
            </select>
          </div>
          {currentSlots.length > 0 && (
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {currentSlots.length} {currentSlots.length === 1 ? 'час' : 'часа'} зададени
            </span>
          )}
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm ${
          msg.type === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      {/* Добавяне на час */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">
          Добави индивидуален час{selectedStudentObj ? ` · ${selectedStudentObj.name}` : ''}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Ден</label>
            <select value={addDay} onChange={e => { setAddDay(Number(e.target.value)); }}
              className="w-full text-sm py-2 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300">
              {DAYS.map(d => <option key={d.n} value={d.n}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Час (слот)</label>
            <select value={addPeriod} onChange={e => setAddPeriod(Number(e.target.value))}
              className="w-full text-sm py-2 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300">
              {freePeriods.length === 0 && <option value="">няма свободни</option>}
              {freePeriods.map(p => <option key={p} value={p}>{IFO_PERIOD_TIMES[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Предмет</label>
            <select value={addSubjectId} onChange={e => setAddSubjectId(e.target.value)}
              className="w-full text-sm py-2 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300">
              <option value="">— избери —</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.allows_pullout ? '◆ ' : ''}{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={addSlot} disabled={freePeriods.length === 0 || !addSubjectId}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#0f2240' }}>
              <Plus size={15} /> Добави
            </button>
          </div>
        </div>
        <button onClick={() => setShowAddSubj(v => !v)} className="text-xs text-blue-600 hover:underline">
          + Нов предмет (ако липсва)
        </button>
        {showAddSubj && (
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
              placeholder="Име на предмета"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <label className="flex items-center gap-2 text-xs text-slate-600 px-2 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={newPullout} onChange={e => setNewPullout(e.target.checked)} className="rounded" />
              позволява вземане
            </label>
            <button onClick={handleAddSubject} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ backgroundColor: '#0f2240' }}>
              <Check size={14} /> Добави
            </button>
          </div>
        )}
      </div>

      {/* Списък с часовете на детето, по дни */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {currentSlots.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Още няма добавени часове за това дете</div>
        ) : (
          DAYS.map(d => {
            const daySlots = currentSlots.filter(s => s.day === d.n).sort((a, b) => a.period - b.period)
            if (daySlots.length === 0) return null
            return (
              <div key={d.n} className="border-b border-slate-100 last:border-0">
                <div className="px-4 py-2 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{d.label}</div>
                {daySlots.map(s => (
                  <div key={`${s.day}-${s.period}`}
                    className="group flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-blue-50/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-slate-400 w-24 flex-shrink-0">{IFO_PERIOD_TIMES[s.period]}</span>
                      <span className="text-sm font-medium text-slate-700 truncate">{subjName(s.subjectId)}</span>
                    </div>
                    <button onClick={() => removeSlot(s.day, s.period)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" title="Премахни">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* Запази */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: '#0f2240' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Запазване...' : 'Запази часовете'}
        </button>
      </div>
    </div>
  )
}
