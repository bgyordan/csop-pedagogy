'use client'
import { useState } from 'react'
import { Loader2, FileDown, Check, CalendarClock, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getMyLecturerDates, submitLecturerDeclaration, deleteMyDeclaration } from './actions'
import { generateLecturerDeclaration } from '@/lib/docx-substitution'
import { declarationPeriods, defaultPeriod } from '@/lib/declaration-periods'

type Slot = { id: string; day: number; period: number; subject: string; holderLabel: string; dateFrom: string; dateTo: string; orderNumber: string }
type Decl = { id: string; periodFrom: string; periodTo: string; totalHours: number; status: string }
const DAY_L = ['', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък']
function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '' }
const STATUS: Record<string, { l: string; c: string }> = {
  submitted: { l: 'Подадена', c: 'bg-blue-50 text-blue-600' },
  verified: { l: 'Проверена', c: 'bg-emerald-50 text-emerald-600' },
  paid: { l: 'Изплатена', c: 'bg-slate-100 text-slate-500' },
}

export default function MyLecturerClient({ teacherName, position, slots, declarations: initialDecls, suggestFrom = '' }: {
  teacherName: string; position: string; slots: Slot[]; declarations: Decl[]; suggestFrom?: string
}) {
  const { toast } = useToast()
  const [declarations, setDeclarations] = useState<Decl[]>(initialDecls)
  // само приключили периоди: септември–октомври (от 01.11), после по месеци
  const periods = declarationPeriods()
  const declared = (p: { from: string; to: string }) => initialDecls.some(d => d.periodFrom <= p.to && d.periodTo >= p.from)
  const [periodKey, setPeriodKey] = useState(() => {
    const open = periods.filter(p => p.open)
    return (open.find(p => !declared(p)) || defaultPeriod(periods)).key
  })
  const period = periods.find(p => p.key === periodKey) || periods[0]
  const from = period.from
  const to = period.to
  const [expanded, setExpanded] = useState<{ slotId: string; day: number; period: number; subject: string; holderLabel: string; dates: string[]; absent?: string[] }[] | null>(null)
  const [checked, setChecked] = useState<Record<string, Set<string>>>({}) // slotId -> Set(dates)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadDates() {
    if (!period.open) { toast(`Периодът още не е приключил — декларацията се подава от ${fmt(period.opensOn)}`, 'error'); return }
    setLoading(true)
    const res: any = await getMyLecturerDates(from, to)
    setExpanded(res.rows || [])
    // по подразбиране всички дати отметнати — без дните, в които учителят е отсъствал (отпуск/болничен)
    const init: Record<string, Set<string>> = {}
    ;(res.rows || []).forEach((r: any) => { const ab = new Set(r.absent || []); init[r.slotId] = new Set(r.dates.filter((d: string) => !ab.has(d))) })
    setChecked(init)
    setLoading(false)
  }

  function toggleDate(slotId: string, date: string) {
    setChecked(prev => {
      const n = { ...prev }
      const s = new Set(n[slotId] || [])
      s.has(date) ? s.delete(date) : s.add(date)
      n[slotId] = s
      return n
    })
  }

  const totalChecked = Object.values(checked).reduce((a, s) => a + s.size, 0)

  async function submit() {
    if (totalChecked === 0) { toast('Отметнете поне един час', 'error'); return }
    setSaving(true)
    const entries = Object.entries(checked).map(([slotId, dates]) => ({ slotId, dates: Array.from(dates) })).filter(e => e.dates.length > 0)
    const res: any = await submitLecturerDeclaration(from, to, entries)
    if (res.error) { toast(res.error, 'error'); setSaving(false); return }

    // генерираме Word
    const rows: { date: string; group: string; subject: string; hours: number }[] = []
    ;(expanded || []).forEach(sl => {
      const dates = Array.from(checked[sl.slotId] || []).sort()
      dates.forEach(dt => rows.push({ date: fmt(dt), group: sl.holderLabel, subject: sl.subject, hours: 1 }))
    })
    rows.sort((a, b) => a.date.split('.').reverse().join('').localeCompare(b.date.split('.').reverse().join('')))
    try {
      await generateLecturerDeclaration({
        teacherName, position,
        periodLabel: `${period.label} (${fmt(from)} – ${fmt(to)})`,
        orderRef: slots[0]?.orderNumber ? `Заповед № ${slots[0].orderNumber}` : 'Заповед № …',
        rows, totalHours: rows.length,
      })
    } catch (e) { /* noop */ }
            toast('Декларацията е подадена и изтеглена')
    setDeclarations(prev => [{ id: res.id || `tmp-${Date.now()}`, periodFrom: from, periodTo: to, totalHours: rows.length, status: 'submitted' }, ...prev.filter(d => !(d.status === 'submitted' && from <= d.periodTo && to >= d.periodFrom))])
    setSaving(false)
    setExpanded(null); setChecked({})
  }

  if (slots.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center">
        <CalendarClock size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">Нямате определени лекторски часове над норматива.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Моите слотове (рамка от заповедта) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Определени лекторски (по заповед)</div>
        <div className="flex flex-wrap gap-2">
          {slots.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm">
              {DAY_L[s.day]} {s.period}. час · {s.subject} {s.holderLabel && <span className="text-slate-400">· {s.holderLabel}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Период на декларацията */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="text-sm font-semibold text-slate-800">Изтегли декларация за период</div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Период</label>
            <select value={periodKey} onChange={e => { setPeriodKey(e.target.value); setExpanded(null) }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400 cursor-pointer">
              {periods.map(p => (
                <option key={p.key} value={p.key} disabled={!p.open}>
                  {p.label}{!p.open ? ` — от ${fmt(p.opensOn)}` : declared(p) ? ' — подадена' : ''}
                </option>
              ))}
            </select>
          </div>
          <button onClick={loadDates} disabled={loading || !period.open}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />} Покажи дните
          </button>
        </div>
        {!period.open && (
          <p className="text-xs text-amber-700">Декларира се само приключил период. „{period.label}“ — от {fmt(period.opensOn)}.</p>
        )}
        <p className="text-[11px] text-slate-400">Септември и октомври се декларират заедно (от 01.11), после всеки месец след края му. Невзетите часове не се прехвърлят към друг период.</p>

        {expanded && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">Отметнете реално взетите часове (махнете неучебните дни). Дните, в които сте били в отпуск или болничен, са в жълто и не могат да се включат.</p>
            {expanded.map(sl => (
              <div key={sl.slotId}>
                <div className="text-sm font-medium text-slate-700 mb-1">{DAY_L[sl.day]} {sl.period}. час · {sl.subject} {sl.holderLabel && <span className="text-slate-400 font-normal">· {sl.holderLabel}</span>}</div>
                <div className="flex flex-wrap gap-1.5">
                  {sl.dates.map(dt => {
                    const on = checked[sl.slotId]?.has(dt)
                    const wasAbsent = (sl.absent || []).includes(dt)
                    return (
                      <button key={dt} onClick={() => !wasAbsent && toggleDate(sl.slotId, dt)} disabled={wasAbsent}
                        title={wasAbsent ? 'В този ден сте били в отпуск/болничен — не може да се декларира' : undefined}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-all disabled:cursor-not-allowed ${
                          on ? 'border-[#0f2240] bg-[#0f2240] text-white'
                            : wasAbsent ? 'border-amber-200 bg-amber-50 text-amber-700 line-through'
                            : 'border-slate-200 bg-slate-50 text-slate-400 line-through'
                        }`}>
                        {fmt(dt)}
                      </button>
                    )
                  })}
                  {sl.dates.length === 0 && <span className="text-xs text-slate-400">няма дати в периода</span>}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-sm text-slate-600">Общо: <span className="font-semibold text-slate-800">{totalChecked}</span> ч.</div>
              <button onClick={submit} disabled={saving || totalChecked === 0}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} Подай и изтегли
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Предишни декларации */}
      {declarations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 text-sm font-semibold text-slate-800">Подадени декларации</div>
          <div className="divide-y divide-slate-100">
            {declarations.map(d => {
              const st = STATUS[d.status] || STATUS.submitted
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 group">
                  <div className="flex-1 text-sm text-slate-700">{fmt(d.periodFrom)} – {fmt(d.periodTo)} · <span className="font-medium">{d.totalHours} ч.</span></div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.c}`}>{st.l}</span>
                  {d.status === 'submitted' && (
                    <button onClick={async () => {
                      if (!confirm('Изтрий тази декларация?')) return
                      const r: any = await deleteMyDeclaration(d.id)
                      if (r.error) { toast(r.error, 'error'); return }
                      setDeclarations(prev => prev.filter(x => x.id !== d.id))
                      toast('Изтрито')
                    }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100" title="Изтрий"><Trash2 size={14} /></button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
