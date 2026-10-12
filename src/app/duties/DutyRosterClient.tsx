'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { smartMatch } from '@/lib/search'
import { useToast } from '@/components/ui/Toast'
import { Plus, X, Search, Loader2, FileText, Wand2, Users, ChevronDown, Settings2, Plane } from 'lucide-react'
import { generateDutyRoster } from '@/lib/docx-generator'
import { mondayOf, isoOf, type DutyWeek } from '@/lib/duty-weeks'

export interface DutyStaff {
  id: string; name: string; role: string; label: string
  inPool: boolean
  absences: { from: string; to: string }[]
}
interface Duty { id: string; staff_id: string; start_date: string; end_date: string }

const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']
const short = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : n }

export default function DutyRosterClient({ staff, duties: initial, weeks, canManage, academicYearId, yearName }: {
  staff: DutyStaff[]; duties: Duty[]; weeks: DutyWeek[]; canManage: boolean; academicYearId: string; yearName?: string
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [duties, setDuties] = useState<Duty[]>(initial)
  const [pool, setPool] = useState<Record<string, boolean>>(() => Object.fromEntries(staff.map(s => [s.id, s.inPool])))
  const [picker, setPicker] = useState<string | null>(null)       // седмица с отворен избор
  const [pickQ, setPickQ] = useState('')
  const [pickAll, setPickAll] = useState(false)
  const [sel, setSel] = useState<string | null>(null)             // избран колега → оцветени седмиците му
  const [q, setQ] = useState('')
  const [manage, setManage] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [perWeek, setPerWeek] = useState(2)
  const [busy, setBusy] = useState(false)
  const [word, setWord] = useState(false)

  // днешната седмица (в събота/неделя — следващата)
  const today = isoOf(new Date())
  const dow = new Date().getDay()
  const nowKey = (() => { const m = mondayOf(today); if (dow !== 0 && dow !== 6) return m; const d = new Date(m + 'T00:00'); d.setDate(d.getDate() + 7); return isoOf(d) })()

  const byId = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s])), [staff])
  const byWeek = useMemo(() => {
    const m: Record<string, Duty[]> = {}
    duties.forEach(d => { (m[mondayOf(d.start_date)] ||= []).push(d) })
    return m
  }, [duties])
  const count = useMemo(() => {
    const c: Record<string, number> = {}
    duties.forEach(d => { c[d.staff_id] = (c[d.staff_id] || 0) + 1 })
    return c
  }, [duties])
  const poolStaff = staff.filter(s => pool[s.id])
  const absentIn = (s: DutyStaff, w: DutyWeek) => s.absences.some(a => a.from <= w.end && a.to >= w.start)
  const weekIdx = Object.fromEntries(weeks.map((w, i) => [w.key, i]))
  const neighbours = (staffId: string, w: DutyWeek) => {
    const i = weekIdx[w.key]
    return [weeks[i - 1], weeks[i + 1]].some(n => n && (byWeek[n.key] || []).some(d => d.staff_id === staffId))
  }

  const past = weeks.filter(w => w.key < nowKey)
  const shown = showPast ? weeks : weeks.filter(w => w.key >= nowKey)
  const emptyAhead = weeks.filter(w => w.key >= nowKey && !(byWeek[w.key] || []).length).length
  const groups = useMemo(() => {
    const g: { month: string; list: DutyWeek[] }[] = []
    shown.forEach(w => {
      const d = new Date(w.start + 'T00:00'), m = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
      if (!g.length || g[g.length - 1].month !== m) g.push({ month: m, list: [] })
      g[g.length - 1].list.push(w)
    })
    return g
  }, [shown])

  async function add(staffId: string, w: DutyWeek) {
    if ((byWeek[w.key] || []).some(d => d.staff_id === staffId)) return
    setBusy(true)
    const { data, error } = await supabase.from('duty_slots')
      .insert({ staff_id: staffId, start_date: w.start, end_date: w.end, academic_year_id: academicYearId }).select().single()
    setBusy(false)
    if (error || !data) { toast(error?.message || 'Грешка', 'error'); return }
    setDuties(p => [...p, data as Duty]); setPickQ('')
  }
  async function remove(d: Duty) {
    setBusy(true)
    const { error } = await supabase.from('duty_slots').delete().eq('id', d.id)
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    setDuties(p => p.filter(x => x.id !== d.id))
  }
  async function togglePool(s: DutyStaff) {
    const next = !pool[s.id]
    setPool(p => ({ ...p, [s.id]: next }))
    const { error } = await supabase.from('duty_pool').upsert({ academic_year_id: academicYearId, staff_id: s.id, included: next, updated_at: new Date().toISOString() })
    if (error) { setPool(p => ({ ...p, [s.id]: !next })); toast(/duty_pool/.test(error.message) ? 'Пуснете SQL файла 2026-10-12_duty_pool.sql' : error.message, 'error') }
  }

  // Поравно: всяка бъдеща седмица до N души; първо тези с най-малко дежурства, без две поредни седмици и без отпуск
  async function autoFill() {
    if (!poolStaff.length) { toast('Няма колеги в графика', 'error'); return }
    const c = { ...count }
    const wk: Record<string, string[]> = Object.fromEntries(weeks.map(w => [w.key, (byWeek[w.key] || []).map(d => d.staff_id)]))
    const rows: { staff_id: string; start_date: string; end_date: string; academic_year_id: string }[] = []
    weeks.filter(w => w.key >= nowKey).forEach(w => {
      const i = weekIdx[w.key]
      const near = new Set([...(wk[weeks[i - 1]?.key] || []), ...(wk[weeks[i + 1]?.key] || [])])
      const ok = (s: DutyStaff, strict: boolean) => !wk[w.key].includes(s.id) && !absentIn(s, w) && (!strict || !near.has(s.id))
      while (wk[w.key].length < perWeek) {
        const cand = poolStaff.filter(s => ok(s, true)).length ? poolStaff.filter(s => ok(s, true)) : poolStaff.filter(s => ok(s, false))
        if (!cand.length) break
        cand.sort((a, b) => (c[a.id] || 0) - (c[b.id] || 0) || Math.random() - 0.5)
        const s = cand[0]
        wk[w.key].push(s.id); c[s.id] = (c[s.id] || 0) + 1
        rows.push({ staff_id: s.id, start_date: w.start, end_date: w.end, academic_year_id: academicYearId })
      }
    })
    if (!rows.length) { toast(`Всички седмици напред вече имат по ${perWeek}`); return }
    if (!confirm(`Ще се добавят ${rows.length} дежурства в ${new Set(rows.map(r => r.start_date)).size} седмици (до ${perWeek} души на седмица). Продължаваме ли?`)) return
    setBusy(true)
    const { data, error } = await supabase.from('duty_slots').insert(rows).select()
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    setDuties(p => [...p, ...((data || []) as Duty[])])
    toast(`Добавени ${rows.length} дежурства`)
  }

  async function handleWord() {
    setWord(true)
    try {
      const wl = (d: Duty) => weeks.find(w => w.key === mondayOf(d.start_date))?.label || d.start_date
      const rows = staff.filter(s => count[s.id]).map(s => ({
        name: s.name, roleLabel: s.label,
        weeks: duties.filter(d => d.staff_id === s.id).sort((a, b) => a.start_date.localeCompare(b.start_date)).map(wl),
      }))
      await generateDutyRoster(`${yearName || ''} учебна година`, rows)
    } finally { setWord(false) }
  }

  const panelList = (manage ? staff : poolStaff)
    .filter(s => !q || smartMatch(s.name, q))
    .sort((a, b) => manage ? a.name.localeCompare(b.name, 'bg') : (count[a.id] || 0) - (count[b.id] || 0) || a.name.localeCompare(b.name, 'bg'))
  const selWeeks = sel ? duties.filter(d => d.staff_id === sel).map(d => mondayOf(d.start_date)) : []

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
      {/* ── седмиците ── */}
      <div className="space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-[12px] px-2.5 py-1 rounded-full border ${emptyAhead ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {emptyAhead ? `${emptyAhead} седмици напред без дежурен` : 'Всички седмици напред имат дежурни'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canManage && (
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
                <span className="pl-3 text-[12px] text-slate-500">по</span>
                <input type="number" min={1} max={6} value={perWeek} onChange={e => setPerWeek(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
                  className="w-10 px-1 py-1.5 text-sm text-center focus:outline-none" title="Колко души на седмица" />
                <span className="pr-2 text-[12px] text-slate-500">на седмица</span>
                <button onClick={autoFill} disabled={busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-l border-slate-200 text-sm text-[#0f2240] hover:bg-slate-50 disabled:opacity-50">
                  <Wand2 size={14} /> Разпредели автоматично
                </button>
              </div>
            )}
            <button onClick={handleWord} disabled={word || !duties.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:border-[#0f2240] disabled:opacity-40">
              {word ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Word
            </button>
          </div>
        </div>

        {past.length > 0 && (
          <button onClick={() => setShowPast(v => !v)} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800">
            <ChevronDown size={14} className={`transition-transform ${showPast ? 'rotate-180' : ''}`} /> {showPast ? 'Скрий минали седмици' : `Покажи минали седмици (${past.length})`}
          </button>
        )}

        {groups.map(g => (
          <section key={g.month} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 text-[12px] font-medium uppercase tracking-wider text-slate-500">{g.month}</div>
            <div className="divide-y divide-slate-100">
              {g.list.map(w => {
                const list = byWeek[w.key] || []
                const isNow = w.key === nowKey, isPast = w.key < nowKey
                const hl = sel && selWeeks.includes(w.key)
                return (
                  <div key={w.key} className={`px-4 py-2.5 ${isNow ? 'bg-amber-50/50' : ''} ${hl ? 'bg-sky-50' : ''} ${isPast ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-36 shrink-0">
                        <div className="text-sm text-slate-700 tabular-nums">{w.label}</div>
                        {(isNow || w.days < 5) && (
                          <div className="text-[10px] text-slate-400">{isNow ? 'тази седмица' : ''}{isNow && w.days < 5 ? ' · ' : ''}{w.days < 5 ? `${w.days} учебни дни` : ''}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                        {list.length === 0 && !isPast && <span className="text-[12px] text-amber-700/80 font-light">няма дежурен</span>}
                        {list.map(d => {
                          const s = byId[d.staff_id]
                          return (
                            <span key={d.id} className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg text-[12px] border ${sel === d.staff_id ? 'bg-sky-100 border-sky-300 text-sky-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                              <button onClick={() => setSel(sel === d.staff_id ? null : d.staff_id)}>{s ? short(s.name) : '—'}</button>
                              {canManage && <button onClick={() => remove(d)} disabled={busy} title="Махни" className="p-0.5 text-slate-400 hover:text-rose-600"><X size={12} /></button>}
                            </span>
                          )
                        })}
                      </div>
                      {canManage && (
                        <button onClick={() => { setPicker(picker === w.key ? null : w.key); setPickQ(''); setPickAll(false) }}
                          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[12px] ${picker === w.key ? 'border-[#0f2240] text-[#0f2240] bg-white' : 'border-slate-200 text-slate-600 hover:border-[#0f2240]'}`}>
                          <Plus size={13} /> добави
                        </button>
                      )}
                    </div>

                    {picker === w.key && canManage && (
                      <div className="mt-2.5 ml-0 sm:ml-36 p-2.5 rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="relative flex-1">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={pickQ} onChange={e => setPickQ(e.target.value)} autoFocus placeholder="Търси колега…"
                              className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0f2240]" />
                          </div>
                          <label className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 cursor-pointer">
                            <input type="checkbox" checked={pickAll} onChange={e => setPickAll(e.target.checked)} className="accent-[#0f2240]" /> и извън графика
                          </label>
                        </div>
                        <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                          {(pickAll ? staff : poolStaff)
                            .filter(s => !list.some(d => d.staff_id === s.id) && (!pickQ || smartMatch(s.name, pickQ)))
                            .sort((a, b) => Number(absentIn(a, w)) - Number(absentIn(b, w)) || (count[a.id] || 0) - (count[b.id] || 0) || a.name.localeCompare(b.name, 'bg'))
                            .map(s => {
                              const away = absentIn(s, w), near = neighbours(s.id, w)
                              return (
                                <button key={s.id} onClick={() => add(s.id, w)} disabled={busy}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-lg hover:bg-slate-50 disabled:opacity-50">
                                  <span className="flex-1 min-w-0">
                                    <span className={`block text-sm truncate ${away ? 'text-slate-400' : 'text-slate-800'}`}>{s.name}</span>
                                    <span className="block text-[11px] text-slate-400 truncate">{s.label}</span>
                                  </span>
                                  {away && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700"><Plane size={10} /> в отпуск</span>}
                                  {near && !away && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">съседна седмица</span>}
                                  <span className={`text-[11px] tabular-nums w-7 text-right ${count[s.id] ? 'text-slate-500' : 'text-emerald-600'}`}>{count[s.id] || 0}</span>
                                </button>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        {weeks.length === 0 && <div className="py-10 text-center text-sm text-slate-400">Учебният календар за годината не е зареден.</div>}
      </div>

      {/* ── колегите ── */}
      <aside className="lg:sticky lg:top-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <Users size={15} className="text-slate-500" />
          <span className="text-sm text-slate-800">{manage ? 'Кой е в графика' : 'Колеги в графика'}</span>
          <span className="text-[12px] text-slate-400">{poolStaff.length}</span>
          {canManage && (
            <button onClick={() => setManage(v => !v)} title="Добави / извади колеги от графика"
              className={`ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] border ${manage ? 'border-[#0f2240] text-[#0f2240]' : 'border-slate-200 text-slate-500 hover:border-[#0f2240]'}`}>
              <Settings2 size={13} /> {manage ? 'Готово' : 'Списък'}
            </button>
          )}
        </div>
        <div className="px-3 pt-3">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси…"
              className="w-full pl-8 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0f2240]" />
          </div>
          {!manage && <p className="mt-2 text-[11px] text-slate-400 font-light">Подредени по брой дежурства. Щракни име — седмиците му се оцветяват.</p>}
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-2">
          {panelList.map(s => manage ? (
            <div key={s.id} role="switch" aria-checked={!!pool[s.id]} onClick={() => togglePool(s)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-slate-800 truncate">{s.name}</span>
                <span className="block text-[11px] text-slate-400 truncate">{s.label}</span>
              </span>
              <span className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${pool[s.id] ? 'bg-[#0f2240]' : 'bg-slate-200'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${pool[s.id] ? 'left-[18px]' : 'left-0.5'}`} />
              </span>
            </div>
          ) : (
            <button key={s.id} onClick={() => setSel(sel === s.id ? null : s.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left ${sel === s.id ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-slate-800 truncate">{s.name}</span>
                <span className="block text-[11px] text-slate-400 truncate">{s.label}</span>
              </span>
              <span className={`text-[12px] tabular-nums px-2 py-0.5 rounded-full ${count[s.id] ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{count[s.id] || 0}</span>
            </button>
          ))}
          {panelList.length === 0 && <p className="px-2 py-6 text-center text-sm text-slate-400">{manage ? 'Няма колеги' : 'Никой не е в графика — „Списък“ горе.'}</p>}
        </div>
      </aside>
    </div>
  )
}
