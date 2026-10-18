'use client'

// ABC картон: бърз запис (предистория → поведение → последствие + интензитет) и анализ само за това дете.
// Тежките случаи (нараняване, тормоз) се вписват и в „Дневник на случаите“ — оттам тръгват мерките.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, X, Loader2, Check, Trash2, Lightbulb, Info, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  ANTECEDENTS, BEHAVIORS, CONSEQUENCES, ABC_PLACES, INTENSITY, abcAnalysis, todaySofia, nowSofia, fmtDate, fmtShort,
} from '@/lib/aba'
import type { AbcRecord } from '@/lib/aba'

const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm'
const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'

export default function AbcSection({ studentId, firstName, meId, isManager, records, names, reload }: {
  studentId: string; firstName: string; meId: string; isManager: boolean
  records: AbcRecord[]; names: Record<string, string>; reload: () => Promise<void>
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<'30' | '90' | 'all'>('90')
  const [showAll, setShowAll] = useState(false)

  const shown = useMemo(() => {
    if (range === 'all') return records
    const from = new Date(Date.now() - Number(range) * 864e5).toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
    return records.filter(r => r.occurred_on >= from)
  }, [records, range])
  const a = useMemo(() => abcAnalysis(shown), [shown])

  async function remove(r: AbcRecord) {
    if (!confirm(`Да се изтрие ли записът от ${fmtDate(r.occurred_on)}?`)) return
    const { error } = await supabase.from('abc_records').delete().eq('id', r.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Записът е изтрит')
    await reload()
  }

  const Bars = ({ title, rows, color }: { title: string; rows: [string, number][]; color: string }) => {
    const top = Math.max(1, ...rows.map(r => r[1]))
    return (
      <div className={`${card} p-4`}>
        <h4 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest mb-3">{title}</h4>
        {!rows.length ? <p className="text-[12.5px] text-slate-400">—</p> : (
          <div className="space-y-1.5">
            {rows.slice(0, 6).map(([k, n]) => (
              <div key={k} className="flex items-center gap-2 text-[12.5px]">
                <span className="w-40 shrink-0 truncate text-slate-700" title={k}>{k}</span>
                <span className="flex-1 h-3.5 rounded bg-slate-100 overflow-hidden"><span className="block h-full rounded" style={{ width: `${(n / top) * 100}%`, background: color }} /></span>
                <span className="w-14 text-right tabular-nums text-slate-500">{n} · {a.pct(n)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const wMax = Math.max(1, ...a.weeks.map(w => w.n))
  const hMax = Math.max(1, ...Object.values(a.hours))
  const list = showAll ? records : records.slice(0, 15)

  return (
    <div className="space-y-4">
      {/* горна лента */}
      <div className={`${card} px-4 py-3 flex flex-wrap items-center gap-2`}>
        <div className="flex-1 min-w-[220px]">
          <div className="text-[15px] text-slate-800">ABC картон</div>
          <div className="text-[12px] text-slate-500">Какво предшества → какво прави {firstName || 'детето'} → какво последва. Запис за минута.</div>
        </div>
        <select value={range} onChange={e => setRange(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
          <option value="30">последните 30 дни</option>
          <option value="90">последните 90 дни</option>
          <option value="all">всички записи</option>
        </select>
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Plus size={15} /> Запис
        </button>
      </div>

      {records.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <p className="text-sm text-slate-600">Още няма записи.</p>
          <p className="text-[12.5px] text-slate-500 mt-1 max-w-lg mx-auto">След всяко проблемно поведение — „Запис“ и три избора. След няколко записа системата сама показва кога и при какво се случва.</p>
        </div>
      ) : (
        <>
          {/* извод */}
          {(a.headline || a.fnHint) && (
            <div className="grid md:grid-cols-2 gap-2.5">
              {a.headline && (
                <div className="rounded-2xl border px-4 py-3 flex gap-3 bg-sky-50 border-sky-200 text-sky-900">
                  <Lightbulb size={17} className="shrink-0 mt-0.5" />
                  <div className="text-[13.5px]">{a.headline}</div>
                </div>
              )}
              {a.fnHint && (
                <div className="rounded-2xl border px-4 py-3 flex gap-3 bg-amber-50 border-amber-200 text-amber-900">
                  <Info size={17} className="shrink-0 mt-0.5" />
                  <div className="text-[13px]">{a.fnHint}</div>
                </div>
              )}
            </div>
          )}

          {/* цифри */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              ['записа', String(a.n)],
              ['среден интензитет', a.n ? a.avg.toFixed(1).replace('.', ',') : '—'],
              ['опасни (5)', String(shown.filter(r => r.intensity === 5).length)],
            ].map(([l, v]) => (
              <div key={l} className={`${card} px-4 py-3`}>
                <div className="text-xl text-[#0f2240] tabular-nums font-light">{v}</div>
                <div className="text-[11.5px] text-slate-500">{l}</div>
              </div>
            ))}
          </div>

          {a.n > 0 && (
            <div className="grid md:grid-cols-3 gap-3 items-start">
              <Bars title="A · Предистория" rows={a.ants} color="#7c3aed" />
              <Bars title="B · Поведение" rows={a.behs} color="#e11d48" />
              <Bars title="C · Последствие" rows={a.cons} color="#0891b2" />
            </div>
          )}

          {a.n > 0 && (
            <div className="grid md:grid-cols-2 gap-3 items-start">
              <div className={`${card} p-4`}>
                <h4 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest mb-3">По седмици <span className="normal-case tracking-normal font-normal text-slate-400">— брой, цвят = среден интензитет</span></h4>
                <div className="flex items-end gap-1.5 h-28">
                  {a.weeks.map(w => {
                    const it = INTENSITY[Math.min(4, Math.max(0, Math.round(w.avg) - 1))]
                    return (
                      <div key={w.w} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`седмица от ${fmtDate(w.w)}: ${w.n} записа, ср. интензитет ${w.avg.toFixed(1)}`}>
                        <span className="text-[10.5px] text-slate-500 tabular-nums">{w.n}</span>
                        <div className="w-full rounded-t border" style={{ height: `${(w.n / wMax) * 80}px`, background: it.bg, borderColor: it.color }} />
                        <span className="text-[10px] text-slate-400 tabular-nums">{fmtShort(w.w)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className={`${card} p-4`}>
                <h4 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest mb-3">По час от деня</h4>
                {Object.keys(a.hours).length === 0 ? <p className="text-[12.5px] text-slate-400">Без въведен час.</p> : (
                  <div className="flex items-end gap-1.5 h-28">
                    {Array.from({ length: 10 }, (_, i) => i + 8).map(h => {
                      const n = a.hours[h] || 0
                      return (
                        <div key={h} className="flex-1 flex flex-col items-center gap-1" title={`${h}:00–${h}:59 — ${n}`}>
                          <span className="text-[10.5px] text-slate-500 tabular-nums">{n || ''}</span>
                          <div className="w-full rounded-t" style={{ height: `${(n / hMax) * 80}px`, background: n ? '#c7d2fe' : 'transparent' }} />
                          <span className="text-[10px] text-slate-400 tabular-nums">{h}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* списък */}
          <section className={card}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <h3 className="text-[14px] font-medium text-slate-800 flex-1">Записи</h3>
              <span className="text-[12px] text-slate-400">{records.length}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {list.map((r, i) => {
                const it = INTENSITY[r.intensity - 1]
                return (
                  <div key={r.id} className={`px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                    <span className="w-24 text-[12.5px] text-slate-600 tabular-nums">{fmtDate(r.occurred_on)}{r.occurred_time ? ` ${r.occurred_time.slice(0, 5)}` : ''}</span>
                    <span className="flex-1 min-w-[240px] text-[13px] text-slate-700">
                      <span className="text-violet-700">{r.antecedent}</span>
                      <span className="text-slate-300 mx-1.5">→</span>
                      <span className="text-rose-700">{r.behavior}</span>
                      <span className="text-slate-300 mx-1.5">→</span>
                      <span className="text-cyan-700">{r.consequence}</span>
                      {r.note && <span className="block text-[12px] text-slate-500 whitespace-pre-wrap">{r.note}</span>}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full border" style={{ background: it.bg, color: it.color, borderColor: it.color + '40' }}>{r.intensity} · {it.label}</span>
                    <span className="text-[11.5px] text-slate-400 w-32 truncate">{[r.place, r.staff_id ? names[r.staff_id] : ''].filter(Boolean).join(' · ')}</span>
                    {(r.staff_id === meId || isManager) && (
                      <button type="button" onClick={() => remove(r)} title="Изтрий" className="p-1.5 rounded-lg text-slate-300 hover:text-rose-700 hover:bg-rose-50"><Trash2 size={14} /></button>
                    )}
                  </div>
                )
              })}
            </div>
            {records.length > 15 && (
              <button type="button" onClick={() => setShowAll(!showAll)} className="block w-full px-4 py-2 text-[12px] text-slate-500 hover:text-slate-800 border-t border-slate-100">
                {showAll ? 'По-малко' : `Всички ${records.length} записа`}
              </button>
            )}
          </section>
        </>
      )}

      <p className="text-[11.5px] text-slate-500 flex items-start gap-1.5">
        <ShieldAlert size={13} className="shrink-0 mt-0.5 text-rose-500" />
        <span>Нараняване, тормоз или нещо, което изисква мерки — впишете го и в <Link href="/incidents" className="underline hover:text-slate-800">Дневник на случаите</Link>. ABC картонът е за ежедневното наблюдение на екипа.</span>
      </p>

      {open && <AbcForm studentId={studentId} meId={meId} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await reload() }} />}
    </div>
  )
}

function AbcForm({ studentId, meId, onClose, onSaved }: { studentId: string; meId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [date, setDate] = useState(todaySofia())
  const [time, setTime] = useState(nowSofia())
  const [place, setPlace] = useState('')
  const [ant, setAnt] = useState('')
  const [beh, setBeh] = useState('')
  const [con, setCon] = useState('')
  const [intensity, setIntensity] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const ready = !!(ant && beh && con && intensity)

  async function save() {
    if (!ready) return
    setBusy(true)
    const { error } = await supabase.from('abc_records').insert({
      student_id: studentId, occurred_on: date, occurred_time: time || null, place: place || null,
      antecedent: ant, behavior: beh, consequence: con, intensity, note: note.trim() || null, staff_id: meId || null,
    })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Записът е добавен')
    await onSaved()
  }

  const Chips = ({ letter, title, opts, value, set, color }: { letter: string; title: string; opts: string[]; value: string; set: (v: string) => void; color: string }) => (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-6 h-6 rounded-lg text-[12px] font-semibold flex items-center justify-center border" style={{ color, borderColor: color + '55', background: color + '0d' }}>{letter}</span>
        <span className="text-[13px] text-slate-700">{title}</span>
        {value && <Check size={14} className="text-emerald-600" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {opts.map(o => (
          <button key={o} type="button" onClick={() => set(value === o ? '' : o)}
            className={`px-2.5 py-1 rounded-lg text-[12.5px] border transition-colors ${value === o ? 'font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'}`}
            style={value === o ? { color, borderColor: color, background: color + '12' } : undefined}>{o}</button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-2xl mx-auto my-0 md:my-8 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex-1"><h2 className="text-base text-[#0f2240]">ABC запис</h2>
            <p className="text-[12px] text-slate-500">Три избора и интензитет — това е.</p></div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm" />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm" />
            <select value={place} onChange={e => setPlace(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white">
              <option value="">място…</option>
              {ABC_PLACES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <Chips letter="A" title="Какво се случи преди това?" opts={ANTECEDENTS} value={ant} set={setAnt} color="#7c3aed" />
          <Chips letter="B" title="Какво направи детето?" opts={BEHAVIORS} value={beh} set={setBeh} color="#e11d48" />
          <Chips letter="C" title="Какво последва?" opts={CONSEQUENCES} value={con} set={setCon} color="#0891b2" />
          <div>
            <div className="text-[13px] text-slate-700 mb-1.5">Интензитет</div>
            <div className="flex gap-1.5">
              {INTENSITY.map(it => (
                <button key={it.n} type="button" onClick={() => setIntensity(it.n)}
                  className={`flex-1 px-2 py-2 rounded-xl border text-[12.5px] transition-all ${intensity === it.n ? 'font-medium' : 'opacity-60 hover:opacity-100'}`}
                  style={{ background: it.bg, color: it.color, borderColor: intensity === it.n ? it.color : 'transparent' }}>
                  <span className="block text-base tabular-nums">{it.n}</span>{it.label}
                </button>
              ))}
            </div>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Бележка (по желание) — колко продължи, кой беше наблизо…"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className={btn}>Отказ</button>
          <button type="button" onClick={save} disabled={busy || !ready}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази
          </button>
        </div>
      </div>
    </div>
  )
}
