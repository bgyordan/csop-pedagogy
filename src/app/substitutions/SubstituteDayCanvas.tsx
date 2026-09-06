'use client'
import { useMemo, useState } from 'react'

// Свеж, самостоятелен канвас за „няколко заместника".
// Модел: карта ISO-дата → id на заместник. Родителят я пази и я свива до
// периоди при запис (mapToRows в SubstitutionsClient).

type Staff = { id: string; first_name: string; last_name: string }

interface Props {
  schoolDays: string[]                    // само учебни дни от периода, сортирани
  staff: Staff[]                          // кандидат-заместници (без отсъстващия)
  value: Record<string, string>           // iso → id на заместник
  onChange: (next: Record<string, string>) => void
}

// Меки фонове + четлив тъмен текст (без плътни тъмни запълвания)
const PALETTE = [
  { bg: '#e0edff', bd: '#93b4f5', tx: '#1e3a8a' },
  { bg: '#dcfce7', bd: '#86d5a3', tx: '#166534' },
  { bg: '#fef3c7', bd: '#e6c260', tx: '#92400e' },
  { bg: '#fae8ff', bd: '#d9a6e8', tx: '#86198f' },
  { bg: '#ccfbf1', bd: '#7fd9c9', tx: '#115e59' },
  { bg: '#ffe4e6', bd: '#f3a6b0', tx: '#9f1239' },
  { bg: '#ede9fe', bd: '#b9a7ef', tx: '#5b21b6' },
  { bg: '#e2e8f0', bd: '#aab6c6', tx: '#334155' },
]
const WD = ['Нед', 'Пон', 'Вто', 'Сря', 'Чет', 'Пет', 'Съб']

function mondayIso(iso: string): string {
  const d = new Date(iso + 'T00:00')
  const dow = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() - (dow - 1))
  return d.toISOString().split('T')[0]
}
const dNum = (iso: string) => new Date(iso + 'T00:00').getDate()
const mNum = (iso: string) => new Date(iso + 'T00:00').getMonth() + 1

export default function SubstituteDayCanvas({ schoolDays, staff, value, onChange }: Props) {
  const [activeId, setActiveId] = useState('')

  const nameOf = useMemo(() => {
    const m: Record<string, string> = {}
    staff.forEach(s => { m[s.id] = `${s.first_name} ${s.last_name}` })
    return m
  }, [staff])
  const first = (id: string) => (nameOf[id] || '').trim().split(/\s+/)[0] || '?'

  const colorOf = useMemo(() => {
    const used: string[] = []
    schoolDays.forEach(iso => { const id = value[iso]; if (id && !used.includes(id)) used.push(id) })
    if (activeId && !used.includes(activeId)) used.push(activeId)
    const m: Record<string, typeof PALETTE[number]> = {}
    used.forEach((id, i) => { m[id] = PALETTE[i % PALETTE.length] })
    return m
  }, [value, activeId, schoolDays])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    schoolDays.forEach(iso => { const id = value[iso]; if (id) c[id] = (c[id] || 0) + 1 })
    return c
  }, [value, schoolDays])
  const uncovered = schoolDays.filter(iso => !value[iso]).length

  const weeks = useMemo(() => {
    const byWeek: Record<string, Record<number, string>> = {}
    schoolDays.forEach(iso => {
      const wk = mondayIso(iso)
      const dow = new Date(iso + 'T00:00').getDay()
      if (!byWeek[wk]) byWeek[wk] = {}
      byWeek[wk][dow] = iso
    })
    return Object.keys(byWeek).sort().map(wk => ({ wk, cols: byWeek[wk] }))
  }, [schoolDays])

  const usedIds = Object.keys(counts)
  const sortedStaff = useMemo(
    () => [...staff].sort((a, b) => a.first_name.localeCompare(b.first_name, 'bg')),
    [staff]
  )

  function paint(iso: string) {
    if (!activeId) return
    const next = { ...value }
    if (next[iso] === activeId) delete next[iso]
    else next[iso] = activeId
    onChange(next)
  }
  function fillRest() {
    if (!activeId) return
    const next = { ...value }
    schoolDays.forEach(iso => { if (!next[iso]) next[iso] = activeId })
    onChange(next)
  }
  function clearAll() { onChange({}) }

  return (
    <div className="space-y-3.5">
      {/* Избор на активен заместник */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-sm text-slate-600">Активен заместник</span>
        <select value={activeId} onChange={e => setActiveId(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400 min-w-[220px]">
          <option value="">— избери заместник —</option>
          {sortedStaff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
        </select>
        {activeId && (
          <span className="text-xs px-2.5 py-1 rounded-full border"
            style={{ background: colorOf[activeId]?.bg, borderColor: colorOf[activeId]?.bd, color: colorOf[activeId]?.tx }}>
            цъкаш дните на {first(activeId)}
          </span>
        )}
        <div className="flex-1" />
        <button type="button" onClick={fillRest} disabled={!activeId}
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-[#0f2240] bg-white hover:shadow-sm disabled:opacity-40 disabled:cursor-default">
          Останалите на него
        </button>
        <button type="button" onClick={clearAll}
          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 text-slate-500 bg-white hover:shadow-sm">
          Изчисти
        </button>
      </div>

      {!activeId && <p className="text-xs text-slate-500">Първо избери заместник, после цъкай дните, които той покрива.</p>}

      {/* Календар */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-5 gap-1.5">
          {['Пон', 'Вто', 'Сря', 'Чет', 'Пет'].map(d => <div key={d} className="text-center text-[11px] text-slate-400">{d}</div>)}
        </div>
        {weeks.map(({ wk, cols }) => (
          <div key={wk} className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map(dow => {
              const iso = cols[dow]
              if (!iso) return <div key={dow} className="min-h-[62px] rounded-xl border border-dashed border-slate-100 text-slate-300 flex items-center justify-center text-lg">·</div>
              const id = value[iso]
              const c = id ? colorOf[id] : null
              return (
                <button type="button" key={dow} onClick={() => paint(iso)}
                  title={iso.split('-').reverse().join('.')}
                  className="min-h-[62px] rounded-xl border flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all hover:-translate-y-0.5 hover:shadow-[0_3px_10px_rgba(15,34,64,0.10)]"
                  style={c ? { background: c.bg, borderColor: c.bd, color: c.tx } : { background: '#fff', borderColor: '#e2e8f0', color: '#334155' }}>
                  <span className="text-[11px] opacity-70">{WD[new Date(iso + 'T00:00').getDay()]}</span>
                  <span className="text-[15px] font-light">{dNum(iso)}.{String(mNum(iso)).padStart(2, '0')}</span>
                  {id && <span className="text-[11px] font-medium">{first(id)}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Легенда */}
      <div className="flex flex-wrap gap-2 items-center">
        {usedIds.map(id => (
          <button type="button" key={id} onClick={() => setActiveId(id)}
            className={'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ' + (activeId === id ? 'ring-2 ring-[#0f2240]' : '')}
            style={{ background: colorOf[id]?.bg, borderColor: colorOf[id]?.bd, color: colorOf[id]?.tx }}>
            <span className="w-3 h-3 rounded" style={{ background: colorOf[id]?.bd }} />
            {nameOf[id] || '—'} · {counts[id]} дни
          </button>
        ))}
        <span className={'inline-flex items-center rounded-full border px-3 py-1 text-xs ' + (uncovered ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-500 bg-white')}>
          {uncovered ? `Непокрити: ${uncovered}` : 'Всички дни са покрити'}
        </span>
      </div>
    </div>
  )
}
