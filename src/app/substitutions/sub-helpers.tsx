'use client'
// Помощни функции и малки компоненти за екрана „Отсъствия и замествания“ —
// изнесени от SubstitutionsClient.tsx, за да остане там само самият екран.
import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { smartMatch } from '@/lib/search'
import { hourKey } from './SubstituteDayCanvas'
import type { SubRow } from './page'
export type Staff = { id: string; first_name: string; last_name: string; role?: string | null; teaching?: boolean }
export const REASONS: Record<string, string> = { sick: 'Болничен', vacation: 'Отпуск', other: 'Друго' }
export function reasonFromKt(kt: string): string { return kt === '162' ? 'sick' : (kt === '160' || kt === '161' || kt === '176' ? 'other' : 'vacation') }
export const KT_ARTICLES: { v: string; l: string }[] = [
  { v: '155', l: 'чл. 155 и чл. 156 – платен годишен отпуск' },
  { v: '157', l: 'чл. 157 – отпуск при събития (брак, кръводаряване и др.)' },
  { v: '159', l: 'чл. 159 – отпуск за обучение' },
  { v: '160', l: 'чл. 160 – неплатен отпуск' },
  { v: '162', l: 'чл. 162 – отпуск при временна неработоспособност (болничен)' },
  { v: '168', l: 'чл. 168 – допълнителен отпуск за отглеждане на дете' },
  { v: '169', l: 'чл. 169 – отпуск при осиновяване' },
  { v: '170', l: 'чл. 170 – отпуск за изпълнение на граждански/обществени задължения' },
  { v: '176', l: 'чл. 176 – отпуск по други причини' },
]
export function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '—' }
// Номерът на заповедта за колоната: „041/12.10.2026г.“ → { n: '041', d: '12.10' }; ръчен номер → с неговата дата
export function orderRef(r: SubRow): { n: string; d: string; full: string } | null {
  const raw = (r.orderNumber || r.manualNumber || '').trim()
  if (!raw) return null
  const [n, rest] = raw.split('/')
  const dm = (rest || '').match(/(\d{2})\.(\d{2})/)
  const d = dm ? `${dm[1]}.${dm[2]}` : (r.manualDate ? r.manualDate.slice(5, 10).split('-').reverse().join('.') : '')
  return { n: n.trim(), d, full: raw }
}
export const MONTHS_BG = ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']
export function statusOf(r: SubRow): { label: string; cls: string } {
  if (r.hasOrder) return { label: 'Заповед издадена', cls: 'bg-emerald-50 text-emerald-600' }
  if (r.substituteId) return { label: 'Готово за заповед', cls: 'bg-blue-50 text-blue-600' }
  return { label: 'Чака заместник', cls: 'bg-amber-50 text-amber-600' }
}
export function isWeekend(d: string) { const day = new Date(d + 'T00:00').getDay(); return day === 0 || day === 6 }

// Ключовете „ISO|час“ — ден, разделен по часове (всеки час/ИЧ от различен заместник)
export const hourEntries = (map: Record<string, string>, d: string) => Object.entries(map).filter(([k]) => k.startsWith(d + '|'))
// Първият (по календарен ред) зает ден → неговият заместник (за представителен запис)
export function firstOwner(map: Record<string, string>, days: string[]) {
  for (const d of days) {
    if (map[d]) return map[d]
    const h = hourEntries(map, d).sort((a, b) => Number(a[0].split('|')[1]) - Number(b[0].split('|')[1]))[0]
    if (h) return h[1]
  }
  return ''
}
export type AssignRow = { substitute_staff_id: string; date_from: string; date_to: string; over_norm: boolean; periods?: number[] | null }
// Свива картата „ден → заместник" до непрекъснати периоди (по един ред на период).
// Ако заместник е накъсан от друг/непокрит ден → отделни редове (коректно за заповедта).
// Разделените по часове дни → по един ред на заместник за деня, с неговите часове.
export function mapToRows(map: Record<string, string>, days: string[]) {
  const rows: AssignRow[] = []
  let owner = '', start = '', end = ''
  const flush = () => { if (owner) rows.push({ substitute_staff_id: owner, date_from: start, date_to: end, over_norm: true }) }
  for (const d of days) {
    const hs = hourEntries(map, d)
    if (hs.length) {
      flush(); owner = ''
      const by: Record<string, number[]> = {}
      hs.forEach(([k, id]) => { (by[id] ||= []).push(Number(k.split('|')[1])) })
      Object.entries(by).forEach(([id, ps]) => rows.push({ substitute_staff_id: id, date_from: d, date_to: d, over_norm: true, periods: ps.sort((a, b) => a - b) }))
      continue
    }
    const o = map[d] || ''
    if (o && o === owner) { end = d }
    else { flush(); owner = o; start = d; end = d }
  }
  flush()
  return rows
}
// Редовете от базата → карта „ден → заместник“ (и „ден|час“ при разделяне по часове)
export function rowsToMap(rs: { staffId: string; from: string; to: string; periods?: number[] | null }[], days: string[]) {
  const m: Record<string, string> = {}
  rs.forEach(r => days.forEach(d => {
    if (d < r.from || d > r.to) return
    if (r.periods && r.periods.length) r.periods.forEach(p => { m[hourKey(d, p)] = r.staffId })
    else m[d] = r.staffId
  }))
  return m
}

// „Мария Иванова" → „Мария И." (за етикетите в реда)
export function shortName(n: string) {
  const [f, l] = n.trim().split(/\s+/)
  return l ? `${f} ${l[0]}.` : f
}
// Уникалните заместници по реда на първото им появяване (същият ред на цветовете като в календара)
export function uniqueSubs(a: SubRow['assigns']) {
  const seen: string[] = []; const out: { staffId: string; name: string }[] = []
  a.forEach(x => { if (!seen.includes(x.staffId)) { seen.push(x.staffId); out.push({ staffId: x.staffId, name: x.name }) } })
  return out
}

// Лекторски (над норматив, платено) / Вътрешно (в рамките на нормата, без заплащане)
export function OverNormPick({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const btn = (on: boolean) => on
    ? { backgroundColor: '#475569', color: '#fff', borderColor: '#475569' }
    : { backgroundColor: '#fff', color: '#475569', borderColor: '#e2e8f0' }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span>Вид заместване:</span>
      <button type="button" onClick={() => onChange(true)} className="px-2.5 py-1 rounded-lg border text-xs transition-all" style={btn(value)}>Лекторски (платено)</button>
      <button type="button" onClick={() => onChange(false)} className="px-2.5 py-1 rounded-lg border text-xs transition-all" style={btn(!value)}>Вътрешно (без заплащане)</button>
    </div>
  )
}

export function PersonCombo({ people, value, onChange, placeholder, excludeId }: {
  people: Staff[]; value: string; onChange: (id: string) => void; placeholder: string; excludeId?: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const selected = people.find(p => p.id === value)
  const list = people.filter(p => p.id !== excludeId)
    .filter(p => smartMatch(`${p.first_name} ${p.last_name}`, q))
    .sort((a, b) => a.first_name.localeCompare(b.first_name, 'bg')).slice(0, 40)
  return (
    <div className="relative">
      <input type="text" value={selected ? `${selected.first_name} ${selected.last_name}` : q}
        onChange={e => { setQ(e.target.value); onChange(''); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
      {selected && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onChange(''); setQ('') }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>}
      {open && !selected && (
        <div className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {list.map(p => (
            <button key={p.id} type="button" onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(p.id); setOpen(false); setQ('') }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 text-slate-700">{p.first_name} {p.last_name}</button>
          ))}
          {list.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Няма съвпадение</div>}
        </div>
      )}
    </div>
  )
}

export function DateField({ value, onChange, min, toast }: { value: string; onChange: (v: string) => void; min?: string; toast: (m: string, t?: any) => void }) {
  return (
    <input type="date" value={value} min={min}
      onChange={e => {
        const v = e.target.value
        if (v && isWeekend(v)) { toast('Събота и неделя не са работни дни', 'error'); return }
        onChange(v)
      }}
      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
  )
}

// Месеците на избраната учебна година (без избрана — на текущата по календар)
export const schoolMonths = (startYear: number | null) => {
  const now = new Date()
  const sy = startYear ?? ((now.getMonth() + 1) >= 9 ? now.getFullYear() : now.getFullYear() - 1)
  const MB = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември']
  return [9,10,11,12,1,2,3,4,5,6].map(m => {
    const y = m >= 9 ? sy : sy + 1
    const first = `${y}-${String(m).padStart(2,'0')}-01`
    const last = `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`
    return { label: `${MB[m-1]} ${y}`, first, last }
  })
}

// „+ Още период“ — допълнителните периоди на едно отсъствие (период 1 са полетата „От / До“ горе).
// Всеки период е свой ред в базата (за да се броят само реалните дни); заместникът, заповедта и т.н. са общи.
export function MorePeriods({ list, onChange, disabled, locked, note }: {
  list: { id?: string; from: string; to: string }[]
  onChange: (l: { id?: string; from: string; to: string }[]) => void
  disabled?: boolean; locked?: boolean; note?: string
}) {
  const set = (i: number, k: 'from' | 'to', v: string) => onChange(list.map((p, j) => j === i ? { ...p, [k]: v, ...(k === 'from' && p.to && v > p.to ? { to: '' } : {}) } : p))
  const inp = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500'
  return (
    <div className="md:col-span-2 space-y-2">
      {list.map((p, i) => (
        <div key={p.id || i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div><label className="block text-xs text-slate-500 mb-1">Период {i + 2} — от</label>
            <input type="date" value={p.from} disabled={locked} onChange={e => set(i, 'from', e.target.value)} className={inp} /></div>
          <div><label className="block text-xs text-slate-500 mb-1">до</label>
            <input type="date" value={p.to} min={p.from || undefined} disabled={locked} onChange={e => set(i, 'to', e.target.value)} className={inp} /></div>
          {!locked
            ? <button type="button" onClick={() => onChange(list.filter((_, j) => j !== i))} title="Махни периода" className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><X size={15} /></button>
            : <span className="w-[31px]" />}
        </div>
      ))}
      {!locked && (
        <button type="button" disabled={disabled} onClick={() => onChange([...list, { from: '', to: '' }])}
          className="inline-flex items-center gap-1 text-[12.5px] text-slate-600 hover:text-[#0f2240] disabled:opacity-40 disabled:hover:text-slate-600"
          title={disabled ? 'При „Няколко заместника“ — само един период' : 'Отпуск в няколко периода по едно заявление — един заместник, една заповед'}>
          <Plus size={13} /> Още период
        </button>
      )}
      {note && <p className="text-[11px] text-slate-400">{note}</p>}
    </div>
  )
}

