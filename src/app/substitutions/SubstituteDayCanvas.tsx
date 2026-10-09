'use client'
import { useMemo, useState } from 'react'

// Свеж, самостоятелен канвас за „няколко заместника".
// Модел: карта ISO-дата → id на заместник; за ден, разделен ПО ЧАСОВЕ — ключове „ISO|час“ → id
// (напр. всеки ИЧ в ИФО от различен колега). Родителят я свива до редове при запис (mapToRows).

type Staff = { id: string; first_name: string; last_name: string }

interface Props {
  schoolDays: string[]                    // само учебни дни от периода, сортирани
  staff: Staff[]                          // кандидат-заместници (без отсъстващия)
  value: Record<string, string>           // iso → id на заместник
  onChange?: (next: Record<string, string>) => void
  readOnly?: boolean                      // само преглед (в списъка) — без избор и цъкане
  hours?: Record<string, { period: number; label: string }[]>   // часовете на отсъстващия по дни (за разделяне по часове)
}
export const hourKey = (iso: string, period: number) => `${iso}|${period}`
const isSplit = (value: Record<string, string>, iso: string) => Object.keys(value).some(k => k.startsWith(iso + '|'))

// Меки фонове + четлив тъмен текст (без плътни тъмни запълвания)
export const PALETTE = [
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

export default function SubstituteDayCanvas({ schoolDays, staff, value, onChange = () => {}, readOnly = false, hours = {} }: Props) {
  const [activeId, setActiveId] = useState('')
  const [hourDay, setHourDay] = useState('')   // денят, отворен „по часове“

  const nameOf = useMemo(() => {
    const m: Record<string, string> = {}
    staff.forEach(s => { m[s.id] = `${s.first_name} ${s.last_name}` })
    return m
  }, [staff])
  const first = (id: string) => (nameOf[id] || '').trim().split(/\s+/)[0] || '?'

  const colorOf = useMemo(() => {
    const used: string[] = []
    schoolDays.forEach(iso => {
      const ids = isSplit(value, iso) ? Object.entries(value).filter(([k]) => k.startsWith(iso + '|')).sort().map(([, v]) => v) : [value[iso]]
      ids.forEach(id => { if (id && !used.includes(id)) used.push(id) })
    })
    if (activeId && !used.includes(activeId)) used.push(activeId)
    const m: Record<string, typeof PALETTE[number]> = {}
    used.forEach((id, i) => { m[id] = PALETTE[i % PALETTE.length] })
    return m
  }, [value, activeId, schoolDays])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}, h: Record<string, number> = {}
    schoolDays.forEach(iso => {
      if (isSplit(value, iso)) Object.entries(value).forEach(([k, id]) => { if (k.startsWith(iso + '|')) h[id] = (h[id] || 0) + 1 })
      else { const id = value[iso]; if (id) c[id] = (c[id] || 0) + 1 }
    })
    return { c, h }
  }, [value, schoolDays])
  const uncovered = schoolDays.filter(iso => !value[iso] && !isSplit(value, iso)).length
  // непокрити часове в разделените дни
  const uncoveredHours = schoolDays.filter(iso => isSplit(value, iso))
    .reduce((a, iso) => a + (hours[iso] || []).filter(h => !value[hourKey(iso, h.period)]).length, 0)

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

  const usedIds = Array.from(new Set([...Object.keys(counts.c), ...Object.keys(counts.h)]))
  const sortedStaff = useMemo(
    () => [...staff].sort((a, b) => a.first_name.localeCompare(b.first_name, 'bg')),
    [staff]
  )

  function paint(iso: string) {
    if (isSplit(value, iso)) { setHourDay(hourDay === iso ? '' : iso); return }
    if (readOnly || !activeId) return
    const next = { ...value }
    if (next[iso] === activeId) delete next[iso]
    else next[iso] = activeId
    onChange(next)
  }
  function fillRest() {
    if (!activeId) return
    const next = { ...value }
    schoolDays.forEach(iso => {
      if (isSplit(next, iso)) (hours[iso] || []).forEach(h => { const k = hourKey(iso, h.period); if (!next[k]) next[k] = activeId })
      else if (!next[iso]) next[iso] = activeId
    })
    onChange(next)
  }
  function clearAll() { onChange({}); setHourDay('') }
  // ден → по часове: досегашният заместник за деня поема всички часове, после се пребоядисват
  function splitDay(iso: string) {
    const owner = value[iso] || activeId
    if (!owner) return
    const next = { ...value }
    delete next[iso]
    ;(hours[iso] || []).forEach(h => { next[hourKey(iso, h.period)] = owner })
    onChange(next); setHourDay(iso)
  }
  function wholeDay(iso: string) {
    const next = Object.fromEntries(Object.entries(value).filter(([k]) => !k.startsWith(iso + '|')))
    if (activeId) next[iso] = activeId
    onChange(next); setHourDay('')
  }
  function paintHour(iso: string, period: number) {
    if (readOnly || !activeId) return
    const k = hourKey(iso, period), next = { ...value }
    if (next[k] === activeId) delete next[k]; else next[k] = activeId
    if (!Object.keys(next).some(x => x.startsWith(iso + '|'))) { onChange(next); setHourDay(''); return }
    onChange(next)
  }

  return (
    <div className="space-y-3.5">
      {/* Избор на активен заместник */}
      {!readOnly && <div className="flex items-center gap-2.5 flex-wrap">
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
      </div>}

      {!readOnly && !activeId && <p className="text-xs text-slate-500">Първо избери заместник, после цъкай дните, които той покрива. С „ч.“ в ъгъла денят се разделя по часове (напр. всеки ИЧ от различен колега).</p>}

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
              const split = isSplit(value, iso)
              const id = split ? '' : value[iso]
              const c = id ? colorOf[id] : null
              const splitIds = split ? Array.from(new Set(Object.entries(value).filter(([k]) => k.startsWith(iso + '|')).sort().map(([, v]) => v))) : []
              const canSplit = !readOnly && !split && (hours[iso]?.length || 0) > 1 && !!(value[iso] || activeId)
              return (
                <div key={dow} className="relative">
                <button type="button" onClick={() => paint(iso)} disabled={readOnly && !split}
                  title={iso.split('-').reverse().join('.')}
                  className={`w-full ${readOnly && !split ? 'min-h-[52px] cursor-default' : 'min-h-[62px] transition-all hover:-translate-y-0.5 hover:shadow-[0_3px_10px_rgba(15,34,64,0.10)]'} rounded-xl border flex flex-col items-center justify-center gap-0.5 py-1.5 ${split ? 'border-dashed' : ''} ${hourDay === iso ? 'ring-2 ring-[#0f2240]' : ''}`}
                  style={c ? { background: c.bg, borderColor: c.bd, color: c.tx } : { background: '#fff', borderColor: split ? '#94a3b8' : '#e2e8f0', color: '#334155' }}>
                  <span className="text-[11px] opacity-70">{WD[new Date(iso + 'T00:00').getDay()]}</span>
                  <span className="text-[15px] font-light">{dNum(iso)}.{String(mNum(iso)).padStart(2, '0')}</span>
                  {id && <span className="text-[11px] font-medium">{first(id)}</span>}
                  {split && (
                    <span className="flex flex-wrap justify-center gap-0.5 px-1" title="Разделен по часове — цъкни, за да видиш">
                      {splitIds.map(x => <span key={x} className="text-[10px] px-1 rounded" style={{ background: colorOf[x]?.bg, color: colorOf[x]?.tx }}>{first(x)}</span>)}
                    </span>
                  )}
                </button>
                {canSplit && (
                  <button type="button" onClick={() => splitDay(iso)} title="Раздели деня по часове (напр. всеки ИЧ от различен колега)"
                    className="absolute top-1 right-1 text-[10px] px-1 rounded bg-white/80 border border-slate-200 text-slate-500 hover:text-[#0f2240] hover:border-[#0f2240]">ч.</button>
                )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Ден по часове */}
      {hourDay && isSplit(value, hourDay) && (
        <div className="rounded-xl border border-slate-300 bg-slate-50/60 p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-700">{WD[new Date(hourDay + 'T00:00').getDay()]} {hourDay.split('-').reverse().join('.')} — по часове</span>
            {!readOnly && <span className="text-xs text-slate-500">{activeId ? `цъкни часовете на ${first(activeId)}` : 'избери заместник горе'}</span>}
            <div className="flex-1" />
            {!readOnly && <button type="button" onClick={() => wholeDay(hourDay)} className="px-2.5 py-1 rounded-lg text-xs border border-slate-200 bg-white text-slate-600 hover:border-[#0f2240]"
              title={activeId ? `Целият ден на ${first(activeId)}` : 'Махни разделянето'}>Цял ден{activeId ? ` на ${first(activeId)}` : ''}</button>}
            <button type="button" onClick={() => setHourDay('')} className="px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:bg-white">Затвори</button>
          </div>
          <div className="space-y-1">
            {(hours[hourDay] || []).map(h => {
              const who = value[hourKey(hourDay, h.period)]
              const c = who ? colorOf[who] : null
              return (
                <button key={h.period} type="button" onClick={() => paintHour(hourDay, h.period)} disabled={readOnly}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left text-[13px] ${readOnly ? 'cursor-default' : 'hover:shadow-sm'}`}
                  style={c ? { background: c.bg, borderColor: c.bd, color: c.tx } : { background: '#fff', borderColor: '#e2e8f0', color: '#334155' }}>
                  <span className="flex-1">{h.label}</span>
                  <span className="text-[12px] font-medium">{who ? (nameOf[who] || '—') : <span className="text-amber-600">непокрит</span>}</span>
                </button>
              )
            })}
            {!(hours[hourDay] || []).length && <div className="text-xs text-slate-400">Часовете на отсъстващия за деня не са заредени.</div>}
          </div>
        </div>
      )}

      {/* Легенда */}
      <div className="flex flex-wrap gap-2 items-center">
        {usedIds.map(id => (
          <button type="button" key={id} onClick={() => { if (!readOnly) setActiveId(id) }} disabled={readOnly}
            className={'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ' + (readOnly ? 'cursor-default ' : '') + (activeId === id ? 'ring-2 ring-[#0f2240]' : '')}
            style={{ background: colorOf[id]?.bg, borderColor: colorOf[id]?.bd, color: colorOf[id]?.tx }}>
            <span className="w-3 h-3 rounded" style={{ background: colorOf[id]?.bd }} />
            {nameOf[id] || '—'} · {[counts.c[id] ? `${counts.c[id]} ${counts.c[id] === 1 ? 'ден' : 'дни'}` : '', counts.h[id] ? `${counts.h[id]} ч.` : ''].filter(Boolean).join(', ')}
          </button>
        ))}
        <span className={'inline-flex items-center rounded-full border px-3 py-1 text-xs ' + (uncovered || uncoveredHours ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-500 bg-white')}>
          {uncovered || uncoveredHours ? `Непокрити: ${[uncovered ? `${uncovered} ${uncovered === 1 ? 'ден' : 'дни'}` : '', uncoveredHours ? `${uncoveredHours} ч.` : ''].filter(Boolean).join(', ')}` : 'Всички дни са покрити'}
        </span>
      </div>
    </div>
  )
}
