'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Plus, Loader2, Copy, X, Check } from 'lucide-react'
import { saveIfoSchedule, copyIfoFromTerm1 } from './actions'
import { addSubject } from '../../../classes/[id]/schedule/actions'

interface Subject { id: string; name: string; allows_pullout: boolean }
interface SlotData { day: number; period: number; subject_id: string | null }

interface Props {
  studentId: string
  academicYearId: string
  term: number
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

const PERIOD_TIMES: Record<number, string> = {
  1: '8:30–9:05', 2: '9:15–9:50', 3: '10:20–10:55',
  4: '11:05–11:40', 5: '11:50–12:25', 6: '12:35–13:05', 7: '13:15–13:50',
}

export function IfoScheduleGrid({ studentId, academicYearId, term, subjects: initialSubjects, existingSlots }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [subjects, setSubjects] = useState(initialSubjects)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Показвани часове: по подразбиране 1–6; 7-ми се добавя
  const has7 = existingSlots.some(s => s.period === 7)
  const [show7, setShow7] = useState(has7)
  const periods = show7 ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6]

  // Състояние: ключ "ден-час" → subject_id
  const [grid, setGrid] = useState<Record<string, string>>(() => {
    const g: Record<string, string> = {}
    existingSlots.forEach(s => { if (s.subject_id) g[`${s.day}-${s.period}`] = s.subject_id })
    return g
  })

  // Добавяне на предмет
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPullout, setNewPullout] = useState(false)

  function setCell(day: number, period: number, subjectId: string) {
    setGrid(prev => {
      const next = { ...prev }
      if (subjectId) next[`${day}-${period}`] = subjectId
      else delete next[`${day}-${period}`]
      return next
    })
  }

  const filledCount = Object.keys(grid).length

  async function handleSave() {
    setSaving(true); setMsg(null)
    const slots = Object.entries(grid).map(([key, subjectId]) => {
      const [day, period] = key.split('-').map(Number)
      return { day, period, subjectId }
    })
    const res = await saveIfoSchedule(studentId, academicYearId, term, slots)
    setSaving(false)
    if (res.error) { setMsg({ type: 'err', text: res.error }); return }
    setMsg({ type: 'ok', text: 'Разписанието е запазено.' })
  }

  async function handleAddSubject() {
    if (!newName.trim()) return
    const res = await addSubject(newName, newPullout)
    if (res.error) { setMsg({ type: 'err', text: res.error }); return }
    if (res.subject) {
      setSubjects(prev => [...prev, res.subject].sort((a, b) =>
        (b.allows_pullout ? 1 : 0) - (a.allows_pullout ? 1 : 0) || a.name.localeCompare(b.name, 'bg')))
      setNewName(''); setNewPullout(false); setShowAdd(false)
    }
  }

  function handleCopyTerm1() {
    startTransition(async () => {
      const res = await copyIfoFromTerm1(studentId, academicYearId)
      if (res.error) { setMsg({ type: 'err', text: res.error }); return }
      if (res.slots) {
        const g: Record<string, string> = {}
        res.slots.forEach((s: any) => { if (s.subject_id) g[`${s.day}-${s.period}`] = s.subject_id })
        setGrid(g)
        if (res.slots.some((s: any) => s.period === 7)) setShow7(true)
        setMsg({ type: 'ok', text: 'Копирано от I срок. Не забравяй да запазиш.' })
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Ленти: срок + копиране */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl">
          <a href={`?term=1`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 1 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 1 ? { backgroundColor: '#0f2240' } : {}}>I срок</a>
          <a href={`?term=2`}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${term === 2 ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            style={term === 2 ? { backgroundColor: '#0f2240' } : {}}>II срок</a>
        </div>

        {term === 2 && (
          <button onClick={handleCopyTerm1} disabled={pending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
            Копирай от I срок
          </button>
        )}

        <span className="ml-auto text-xs text-slate-500">
          Запълнени часове: <span className="font-semibold text-slate-700">{filledCount}</span>
        </span>
      </div>

      {msg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm ${
          msg.type === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      {/* Решетка */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">Час</th>
              {DAYS.map(d => (
                <th key={d.n} className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="hidden sm:inline">{d.label}</span>
                  <span className="sm:hidden">{d.short}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(period => (
              <tr key={period} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-1.5 align-top">
                  <div className="font-bold text-slate-700 text-sm">{period}.</div>
                  <div className="text-[10px] text-slate-400">{PERIOD_TIMES[period]}</div>
                </td>
                {DAYS.map(d => {
                  const val = grid[`${d.n}-${period}`] || ''
                  const subj = subjects.find(s => s.id === val)
                  return (
                    <td key={d.n} className="px-1.5 py-1.5">
                      <select
                        value={val}
                        onChange={e => setCell(d.n, period, e.target.value)}
                        className={`w-full text-xs py-1.5 px-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                          subj?.allows_pullout ? 'bg-teal-50 border-teal-200 text-teal-800' : 'border-slate-200 text-slate-700'
                        }`}>
                        <option value="">—</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.allows_pullout ? '◆ ' : ''}{s.name}</option>
                        ))}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Долни бутони */}
      <div className="flex flex-wrap items-center gap-2">
        {!show7 ? (
          <button onClick={() => setShow7(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Plus size={13} /> Добави 7-ми час
          </button>
        ) : (
          <button onClick={() => {
              setShow7(false)
              setGrid(prev => { const n = { ...prev }; DAYS.forEach(d => delete n[`${d.n}-7`]); return n })
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">
            <X size={13} /> Премахни 7-ми час
          </button>
        )}

        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
          <Plus size={13} /> Нов предмет
        </button>

        <button onClick={handleSave} disabled={saving}
          className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: '#0f2240' }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Запазване...' : 'Запази разписанието'}
        </button>
      </div>

      {/* Добавяне на предмет */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
              placeholder="Име на предмета (може съставно: БЕЛ/История/География)"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300" />
            <label className="flex items-center gap-2 text-xs text-slate-600 px-2 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={newPullout} onChange={e => setNewPullout(e.target.checked)} className="rounded" />
              позволява вземане
            </label>
            <button onClick={handleAddSubject}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium"
              style={{ backgroundColor: '#0f2240' }}>
              <Check size={14} /> Добави
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            ◆ маркира предметите, които позволяват вземане на дете от терапевт
          </p>
        </div>
      )}
    </div>
  )
}
