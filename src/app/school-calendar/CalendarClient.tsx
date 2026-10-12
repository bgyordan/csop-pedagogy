'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CalendarOff, RotateCcw, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { sofiaTodayIso } from '@/lib/declaration-periods'
import { setSpontaneousDay } from './actions'

export type CalDay = { date: string; school: boolean; spontaneous: boolean; notes: string; term: number | null }

const MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември']
const DOW = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота']
const fmt = (iso: string) => iso.split('-').reverse().join('.')
const dowOf = (iso: string) => new Date(iso + 'T00:00').getDay()

export default function CalendarClient({ days, readOnly }: { days: CalDay[]; readOnly: boolean }) {
  const { toast } = useToast()
  const router = useRouter()
  const today = sofiaTodayIso()
  const [sel, setSel] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const byDate = useMemo(() => Object.fromEntries(days.map(d => [d.date, d])), [days])
  // месеците — само делничните дни, подредени в седмици (пон–пет)
  const months = useMemo(() => {
    const map: Record<string, CalDay[]> = {}
    days.forEach(d => { const w = dowOf(d.date); if (w >= 1 && w <= 5) (map[d.date.slice(0, 7)] ||= []).push(d) })
    return Object.entries(map).map(([ym, list]) => {
      const weeks: (CalDay | null)[][] = []
      let cur: (CalDay | null)[] = [null, null, null, null, null]
      list.forEach((d, i) => {
        const w = dowOf(d.date)
        if (i > 0 && w <= dowOf(list[i - 1].date)) { weeks.push(cur); cur = [null, null, null, null, null] }
        cur[w - 1] = d
      })
      weeks.push(cur)
      const [y, m] = ym.split('-').map(Number)
      return { key: ym, label: `${MONTHS[m - 1]} ${y}`, weeks }
    })
  }, [days])
  const spontaneous = days.filter(d => d.spontaneous)
  const selDay = sel ? byDate[sel] : null

  async function save(mark: boolean) {
    if (!sel) return
    setBusy(true)
    const res: any = await setSpontaneousDay(sel, mark ? reason : null)
    setBusy(false)
    if (res?.error) { toast(res.error, 'error'); return }
    toast(mark ? `${fmt(sel)} е неучебен ден` : `${fmt(sel)} отново е учебен ден`)
    setSel(null); setReason('')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* легенда + избран ден */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-slate-500 font-light">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-slate-300" /> учебен</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> неучебен по МОН (ваканция, празник)</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> спонтанен неучебен</span>
        </div>

        {selDay ? (
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <div className="text-sm text-slate-800 mr-1">{fmt(selDay.date)} · {DOW[dowOf(selDay.date)]}</div>
            {selDay.spontaneous ? (
              <>
                <span className="text-[13px] text-amber-800">неучебен — {selDay.notes}</span>
                <button onClick={() => save(false)} disabled={busy || readOnly}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-[#0f2240] disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Върни като учебен
                </button>
              </>
            ) : (
              <>
                <input value={reason} onChange={e => setReason(e.target.value)} autoFocus placeholder="Причина, напр. Заповед на кмета № …"
                  onKeyDown={e => { if (e.key === 'Enter') save(true) }}
                  className="flex-1 min-w-[240px] px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-100" />
                <button onClick={() => save(true)} disabled={busy || readOnly}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-800 hover:bg-amber-100 disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarOff size={14} />} Маркирай неучебен
                </button>
              </>
            )}
            <button onClick={() => { setSel(null); setReason('') }} className="p-1.5 text-slate-400 hover:text-slate-700"><X size={15} /></button>
          </div>
        ) : (
          <p className="mt-3 pt-3 border-t border-slate-100 text-[12px] text-slate-400 font-light">
            Неучебният ден изпада от декларациите за заместване и над норматив, от МОН отчета и от „Днес отсъстват“.
            Седмиците в заповедта за лекторски не се променят — неизработеният час просто не се изплаща.
          </p>
        )}

        {spontaneous.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {spontaneous.map(d => (
              <button key={d.date} onClick={() => setSel(d.date)}
                className="text-[12px] px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100">
                {fmt(d.date)} · {d.notes}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* месеците */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {months.map(m => (
          <div key={m.key} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className="text-sm text-slate-700 mb-2 px-1 capitalize">{m.label}</div>
            <div className="grid grid-cols-5 gap-1 text-[10px] text-slate-400 mb-1 px-0.5">
              {['пон', 'вт', 'ср', 'чет', 'пет'].map(x => <div key={x} className="text-center">{x}</div>)}
            </div>
            <div className="space-y-1">
              {m.weeks.map((w, i) => (
                <div key={i} className="grid grid-cols-5 gap-1">
                  {w.map((d, j) => {
                    if (!d) return <div key={j} />
                    const cls = d.spontaneous ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : d.school ? 'bg-white border-slate-200 text-slate-700 hover:border-[#0f2240]'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                    const clickable = d.school || d.spontaneous
                    return (
                      <button key={j} disabled={!clickable} onClick={() => { setSel(d.date); setReason('') }}
                        title={d.notes || (d.school ? 'учебен ден' : 'неучебен')}
                        className={`h-9 rounded-lg border text-[12px] tabular-nums transition ${cls} ${sel === d.date ? 'ring-2 ring-[#0f2240]/40' : ''} ${d.date === today ? 'font-semibold underline underline-offset-2' : ''} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}>
                        {Number(d.date.slice(8))}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
