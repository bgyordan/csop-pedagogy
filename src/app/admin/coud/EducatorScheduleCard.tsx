'use client'
import { useState, useTransition } from 'react'
import { Loader2, Check, Wand2, Trash2, CalendarClock } from 'lucide-react'
import { applyStandardEducatorSchedule, clearEducatorSchedule } from './educator-schedule-actions'

interface Ed { id: string; name: string }
const ACCENT = '#0f2240'

export default function EducatorScheduleCard({ educators, seeded, academicYearId }: { educators: Ed[]; seeded: string[]; academicYearId: string }) {
  const [pending, start] = useTransition()
  const [busyId, setBusyId] = useState<string>('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set(seeded))

  function applyOne(id: string) {
    setBusyId(id); setMsg(null)
    start(async () => {
      const r = await applyStandardEducatorSchedule([id], academicYearId)
      setBusyId('')
      if ('error' in r && r.error) { setMsg({ type: 'err', text: r.error }); return }
      setDone(prev => new Set(prev).add(id))
    })
  }
  function applyAll() {
    setBusyId('all'); setMsg(null)
    start(async () => {
      const r = await applyStandardEducatorSchedule(educators.map(e => e.id), academicYearId)
      setBusyId('')
      if ('error' in r && r.error) { setMsg({ type: 'err', text: r.error }); return }
      setDone(new Set(educators.map(e => e.id)))
      setMsg({ type: 'ok', text: 'Стандартният блок е приложен на всички възпитатели.' })
    })
  }
  function clearOne(id: string) {
    if (!confirm('Изчисти ЦОУД разписанието на този възпитател?')) return
    setBusyId(id); setMsg(null)
    start(async () => {
      const r = await clearEducatorSchedule(id, academicYearId)
      setBusyId('')
      if ('error' in r && r.error) { setMsg({ type: 'err', text: r.error }); return }
      setDone(prev => { const n = new Set(prev); n.delete(id); return n })
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock size={18} className="text-blue-500" />
        <h3 className="text-base font-semibold text-slate-800">Стандартно ЦОУД разписание</h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Наливане на фиксирания следобеден блок (отдих · самоподготовка · занимания, 6 часа/ден) на възпитателите. Нужно е, за да се остойностяват коректно заместванията им.
      </p>

      {msg && (
        <div className={`px-3.5 py-2.5 rounded-xl text-sm mb-4 ${
          msg.type === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>{msg.text}</div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-400">{educators.length} възпитатели · {done.size} с въведено разписание</span>
        <button onClick={applyAll} disabled={pending || educators.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: ACCENT }}>
          {busyId === 'all' ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
          Приложи на всички
        </button>
      </div>

      <div className="space-y-1.5">
        {educators.map(e => {
          const isDone = done.has(e.id)
          const busy = busyId === e.id
          return (
            <div key={e.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors">
              <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{e.name}</span>
              {isDone && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-600 border-emerald-100">
                  <Check size={11} /> въведено
                </span>
              )}
              <button onClick={() => applyOne(e.id)} disabled={pending}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                {busy && busyId === e.id ? <Loader2 size={13} className="animate-spin" /> : isDone ? 'Презапиши' : 'Приложи'}
              </button>
              {isDone && (
                <button onClick={() => clearOne(e.id)} disabled={pending} title="Изчисти"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}
        {educators.length === 0 && <div className="py-6 text-center text-sm text-slate-400">Няма активни възпитатели.</div>}
      </div>
    </div>
  )
}
