'use client'
import { useState, useMemo } from 'react'
import { Loader2, Check, Save, Users, GraduationCap, X, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getTeacherSchedule, saveLecturerSlots, clearLecturerSlots } from './actions'

type Teacher = { id: string; name: string }
type Marked = { id: string; staffId: string; staffName: string; day: number; period: number; subject: string; holderLabel: string; dateFrom: string; dateTo: string; orderNumber: string }
type SchedSlot = { day: number; period: number; subjectId: string | null; subject: string; holderType: string; holderLabel: string }

const DAYS = [{ n: 1, l: 'Пон' }, { n: 2, l: 'Вт' }, { n: 3, l: 'Ср' }, { n: 4, l: 'Чет' }, { n: 5, l: 'Пет' }]
const PERIODS = [1, 2, 3, 4, 5, 6, 7]
function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '' }
const todayStr = () => new Date().toISOString().split('T')[0]
function weeksBetween(from: string, to: string): number {
  if (!from || !to) return 0
  const a = new Date(from + 'T00:00'), b = new Date(to + 'T00:00')
  if (b < a) return 0
  // брой понеделници (учебни седмици) в интервала
  let count = 0
  const d = new Date(a)
  while (d <= b) { if (d.getDay() === 1) count++; d.setDate(d.getDate() + 1) }
  // ако периодът започва след понеделник, добавяме първата непълна седмица
  return count > 0 ? count : 1
}

export default function LecturerClient({ academicYearId, teachers, marked: initialMarked }: {
  academicYearId: string; teachers: Teacher[]; marked: Marked[]
}) {
  const { toast } = useToast()
  const [marked, setMarked] = useState<Marked[]>(initialMarked)

  const [teacherId, setTeacherId] = useState('')
  const [tSearch, setTSearch] = useState('')
  const [tOpen, setTOpen] = useState(false)
  const [schedule, setSchedule] = useState<SchedSlot[]>([])
  const [loadingSched, setLoadingSched] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())  // "ден-час"
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [saving, setSaving] = useState(false)

  const teacherName = teachers.find(t => t.id === teacherId)?.name || ''
  const filtered = teachers.filter(t => t.name.toLowerCase().includes(tSearch.toLowerCase())).slice(0, 40)

  async function selectTeacher(id: string) {
    setTeacherId(id); setTOpen(false); setTSearch('')
    setLoadingSched(true); setSchedule([]); setPicked(new Set())
    const res: any = await getTeacherSchedule(id)
    setSchedule(res.slots || [])
    // предзареждаме вече маркираните за този учител
    const his = marked.filter(m => m.staffId === id)
    if (his.length > 0) {
      setPicked(new Set(his.map(m => `${m.day}-${m.period}`)))
      setFrom(his[0].dateFrom); setTo(his[0].dateTo)
    }
    setLoadingSched(false)
  }

  const slotAt = (day: number, period: number) => schedule.find(s => s.day === day && s.period === period)
  function togglePick(day: number, period: number) {
    const key = `${day}-${period}`
    if (!slotAt(day, period)) return // само реални часове
    setPicked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  const pickedCount = picked.size

  async function save() {
    if (!teacherId) { toast('Изберете учител', 'error'); return }
    if (!from || !to) { toast('Задайте период', 'error'); return }
    if (picked.size === 0) { toast('Маркирайте поне един час', 'error'); return }
    setSaving(true)
    const slots = Array.from(picked).map(key => {
      const [day, period] = key.split('-').map(Number)
      const sl = slotAt(day, period)!
      return { day, period, subjectId: sl.subjectId, holderType: sl.holderType, holderLabel: sl.holderLabel }
    })
    const res: any = await saveLecturerSlots(teacherId, from, to, slots)
    if (res.error) { toast(res.error, 'error'); setSaving(false); return }
    // обновяваме списъка локално
    const others = marked.filter(m => m.staffId !== teacherId)
    const mine: Marked[] = slots.map((s, i) => ({
      id: `tmp-${i}`, staffId: teacherId, staffName: teacherName, day: s.day, period: s.period,
      subject: slotAt(s.day, s.period)?.subject || '', holderLabel: s.holderLabel, dateFrom: from, dateTo: to, orderNumber: '',
    }))
    setMarked([...mine, ...others])
    toast('Записано')
    setSaving(false)
  }

  async function removeTeacher(id: string) {
    if (!confirm('Изтрий лекторските на този учител?')) return
    await clearLecturerSlots(id)
    setMarked(prev => prev.filter(m => m.staffId !== id))
    if (id === teacherId) setPicked(new Set())
    toast('Изтрито')
  }

  // групиране на маркираните по учител (за списъка долу)
  const byTeacher = useMemo(() => {
    const m: Record<string, { name: string; count: number; from: string; to: string; classes: Set<string> }> = {}
    marked.forEach(x => {
      if (!m[x.staffId]) m[x.staffId] = { name: x.staffName, count: 0, from: x.dateFrom, to: x.dateTo, classes: new Set() }
      m[x.staffId].count++
      if (x.holderLabel) m[x.staffId].classes.add(x.holderLabel)
    })
    return Object.entries(m).map(([id, v]) => {
      const weeks = weeksBetween(v.from, v.to)
      return { id, name: v.name, count: v.count, from: v.from, to: v.to, weeks, total: v.count * weeks, classes: [...v.classes] }
    })
  }, [marked])
  const grandTotal = byTeacher.reduce((a, t) => a + t.total, 0)

  return (
    <div className="space-y-5">
      {/* Избор учител */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="relative max-w-sm">
          <label className="block text-xs text-slate-500 mb-1">Учител</label>
          <input type="text" value={teacherId ? teacherName : tSearch}
            onChange={e => { setTSearch(e.target.value); setTeacherId(''); setTOpen(true) }}
            onFocus={() => setTOpen(true)} onBlur={() => setTimeout(() => setTOpen(false), 150)}
            placeholder="Търси учител…"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
          {teacherId && <button onMouseDown={e => e.preventDefault()} onClick={() => { setTeacherId(''); setSchedule([]); setPicked(new Set()) }} className="absolute right-2 top-8 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
          {tOpen && !teacherId && (
            <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
              {filtered.map(t => (
                <button key={t.id} onMouseDown={e => e.preventDefault()} onClick={() => selectTeacher(t.id)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700">{t.name}</button>
              ))}
            </div>
          )}
        </div>

        {teacherId && (
          <>
            {loadingSched ? (
              <div className="py-8 text-center text-slate-400"><Loader2 size={20} className="animate-spin inline" /></div>
            ) : schedule.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">Този учител няма въведено разписание.</div>
            ) : (
              <>
                <p className="text-xs text-slate-500">Кликнете часовете, които са над норматива:</p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr><th className="w-12 px-1 py-1.5 text-[10px] text-slate-400">Час</th>
                        {DAYS.map(d => <th key={d.n} className="px-1 py-1.5 text-xs font-semibold text-slate-600">{d.l}</th>)}</tr>
                    </thead>
                    <tbody>
                      {PERIODS.map(period => (
                        <tr key={period}>
                          <td className="text-center text-sm font-semibold text-slate-600 py-1">{period}.</td>
                          {DAYS.map(d => {
                            const sl = slotAt(d.n, period)
                            const key = `${d.n}-${period}`
                            const on = picked.has(key)
                            return (
                              <td key={d.n} className="p-1">
                                {sl ? (
                                  <button onClick={() => togglePick(d.n, period)}
                                    className={`w-full min-h-[42px] rounded-lg border px-1.5 py-1 text-left transition-all ${
                                      on ? 'border-[#0f2240] bg-[#0f2240] text-white' : 'border-slate-200 bg-slate-50 hover:border-slate-400'
                                    }`}>
                                    <div className="text-[10px] opacity-80">{sl.holderLabel}</div>
                                    <div className="text-[11px] truncate">{sl.subject}</div>
                                  </button>
                                ) : <div className="min-h-[42px]" />}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-end gap-3 flex-wrap pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">От</label>
                    <input type="date" value={from} min={todayStr()} onChange={e => { setFrom(e.target.value); if (to && e.target.value > to) setTo('') }}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">До</label>
                    <input type="date" value={to} min={from || todayStr()} onChange={e => setTo(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
                  </div>
                  <div className="text-sm text-slate-600 ml-auto">Маркирани: <span className="font-semibold text-slate-800">{pickedCount}</span> ч./седмица</div>
                  <button onClick={save} disabled={saving || pickedCount === 0 || !from || !to}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Запази
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Списък на определените */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <h3 className="text-sm font-semibold text-slate-800">Определени лекторски</h3>
          <span className="text-xs text-slate-500">Предв. общо: <span className="font-semibold text-slate-800">{grandTotal}</span> ч.</span>
        </div>
        {byTeacher.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">Още няма определени лекторски.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {byTeacher.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group">
                <Users size={15} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800">{t.name} {t.classes.length > 0 && <span className="text-xs text-slate-400 font-normal">· {t.classes.join(', ')}</span>}</div>
                  <div className="text-xs text-slate-500">{t.count} ч./седмица × {t.weeks} седмици ≈ <span className="font-medium text-slate-700">{t.total} ч.</span> · {fmt(t.from)} – {fmt(t.to)}</div>
                </div>
                <button onClick={() => selectTeacher(t.id)} className="text-xs text-[#0f2240] hover:underline shrink-0">Редакция</button>
                <button onClick={() => removeTeacher(t.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
