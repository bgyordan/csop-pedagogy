'use client'
// Генератор на заповеди — общи части: избор на хора, поле от шаблона, хартиеният преглед.
import { useState, useRef, useEffect, useMemo } from 'react'
import { X, ChevronDown, Check } from 'lucide-react'
import { smartMatch } from '@/lib/search'
import { CENTER_NAME, CENTER_CITY, runs, dmy, type Field, type Data, type OrderBody, type StaffLite } from '@/lib/order-generator'

// ─── избор на хора (един или няколко) ─────────────────────────────────────
export type Opt = { id: string; name: string; sub?: string }

export function PersonPicker({ options, value, multi, onChange, placeholder, invalid }: {
  options: Opt[]; value: string | string[] | undefined; multi?: boolean
  onChange: (v: any) => void; placeholder?: string; invalid?: boolean
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const selected: string[] = multi ? (Array.isArray(value) ? value : []) : value ? [value as string] : []
  const byId = useMemo(() => Object.fromEntries(options.map(o => [o.id, o])), [options])
  const list = useMemo(() => options.filter(o => smartMatch(`${o.name} ${o.sub || ''}`, q)).slice(0, 60), [options, q])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  useEffect(() => setHi(0), [q])

  function pick(id: string) {
    if (multi) {
      onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
      setQ(''); inputRef.current?.focus()
    } else {
      onChange(id); setQ(''); setOpen(false)
    }
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, list.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { if (open && list[hi]) { e.preventDefault(); pick(list[hi].id) } }
    else if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'Backspace' && !q && multi && selected.length) onChange(selected.slice(0, -1))
  }

  return (
    <div ref={boxRef} className="relative">
      <div onClick={() => { setOpen(true); inputRef.current?.focus() }}
        className={`min-h-[40px] w-full flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-xl border bg-white cursor-text transition-colors ${
          open ? 'border-[#0f2240] ring-2 ring-[#0f2240]/10' : invalid ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 hover:border-slate-300'}`}>
        {multi && selected.map(id => (
          <span key={id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg bg-[#0f2240]/[0.06] text-[#0f2240] text-xs">
            {byId[id]?.name || '—'}
            <button type="button" onClick={e => { e.stopPropagation(); onChange(selected.filter(x => x !== id)) }}
              className="p-0.5 rounded hover:bg-[#0f2240]/10" aria-label="Махни"><X size={11} /></button>
          </span>
        ))}
        {!multi && selected[0] && !q && (
          <span className="absolute left-3 right-9 truncate text-sm text-slate-800 pointer-events-none">
            {byId[selected[0]]?.name}{byId[selected[0]]?.sub && <span className="text-slate-400"> · {byId[selected[0]]?.sub}</span>}
          </span>
        )}
        <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder={selected.length ? (multi ? 'добави…' : '') : (placeholder || 'Търсене по име или длъжност…')}
          className="flex-1 min-w-[90px] px-1 py-0.5 text-sm bg-transparent outline-none placeholder:text-slate-400" />
        {!multi && selected[0] ? (
          <button type="button" onClick={e => { e.stopPropagation(); onChange('') }} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Изчисти"><X size={13} /></button>
        ) : <ChevronDown size={14} className="text-slate-300 mr-1" />}
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,34,64,0.16)] py-1">
          {list.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">Няма съвпадения</div>}
          {list.map((o, i) => {
            const on = selected.includes(o.id)
            return (
              <button type="button" key={o.id} onMouseEnter={() => setHi(i)} onClick={() => pick(o.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${i === hi ? 'bg-slate-50' : ''}`}>
                <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${on ? 'bg-[#0f2240] text-white' : 'border border-slate-200'}`}>{on && <Check size={11} />}</span>
                <span className="truncate text-slate-800">{o.name}</span>
                {o.sub && <span className="ml-auto pl-2 text-[11px] text-slate-400 truncate max-w-[45%]">{o.sub}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── поле от шаблона ──────────────────────────────────────────────────────
export function FieldInput({ f, d, set, staffOpts, studentOpts, showInvalid }: {
  f: Field; d: Data; set: (k: string, v: any) => void; staffOpts: Opt[]; studentOpts: Opt[]; showInvalid: boolean
}) {
  const v = d[f.key]
  const empty = v === undefined || v === null || (Array.isArray(v) ? !v.length : String(v).trim() === '')
  const invalid = showInvalid && !!f.required && empty
  const base = `w-full px-3 py-2 rounded-xl border bg-white text-sm outline-none transition-colors focus:border-[#0f2240] focus:ring-2 focus:ring-[#0f2240]/10 ${invalid ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 hover:border-slate-300'}`
  let input: React.ReactNode
  switch (f.kind) {
    case 'staff': input = <PersonPicker options={staffOpts} value={v} onChange={x => set(f.key, x)} invalid={invalid} />; break
    case 'staffs': input = <PersonPicker options={staffOpts} value={v} multi onChange={x => set(f.key, x)} invalid={invalid} />; break
    case 'student': input = <PersonPicker options={studentOpts} value={v} onChange={x => set(f.key, x)} invalid={invalid} placeholder="Търсене на дете…" />; break
    case 'date': input = <input type="date" value={v || ''} onChange={e => set(f.key, e.target.value)} className={base} />; break
    case 'number': input = <input type="number" min={0} value={v ?? ''} onChange={e => set(f.key, e.target.value)} className={base} />; break
    case 'select':
      input = f.options!.length <= 3 && f.options!.every(o => o.label.length < 18) ? (
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100/80">
          {f.options!.map(o => (
            <button key={o.value} type="button" onClick={() => set(f.key, o.value)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${v === o.value ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{o.label}</button>
          ))}
        </div>
      ) : (
        <select value={v || ''} onChange={e => set(f.key, e.target.value)} className={base}>
          {!f.required && <option value="">—</option>}
          {f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
      break
    case 'textarea':
    case 'lines':
      input = <AutoText value={v || ''} onChange={x => set(f.key, x)} placeholder={f.placeholder} className={base} minRows={f.kind === 'lines' ? 3 : 2} />
      break
    default: input = <input value={v || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} className={base} />
  }
  return (
    <div className={f.half ? '' : 'col-span-2'}>
      <span className="flex items-baseline gap-1.5 mb-1.5">
        <span className="text-[12px] font-medium text-slate-600">{f.label}</span>
        {f.required && <span className={`text-[10px] ${invalid ? 'text-amber-600' : 'text-slate-300'}`}>●</span>}
        {f.hint && <span className="text-[11px] text-slate-400 truncate">{f.hint}</span>}
      </span>
      {input}
    </div>
  )
}

export function AutoText({ value, onChange, className, placeholder, minRows = 2 }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])
  return <textarea ref={ref} rows={minRows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    className={`${className || ''} resize-none overflow-hidden leading-relaxed`} />
}

// ─── хартията ─────────────────────────────────────────────────────────────
function Rich({ s, onMissing }: { s: string; onMissing?: () => void }) {
  return <>{runs(s).map((r, i) => r.missing
    ? <button key={i} type="button" onClick={onMissing}
        className="inline px-1 mx-px rounded bg-amber-100 text-amber-800 font-sans text-[0.8em] align-baseline hover:bg-amber-200 print:bg-transparent print:text-black">{r.text}</button>
    : r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>)}</>
}

export function Paper({ body, number, date, director, people, draft, onMissing }: {
  body: OrderBody; number?: string | null; date: string; director: string; people: StaffLite[]; draft: boolean; onMissing?: () => void
}) {
  const all = [...body.points, ...body.closing].filter(x => x.trim())
  return (
    <div className="order-print relative mx-auto bg-white w-full max-w-[794px] min-h-[1060px] shadow-[0_1px_3px_rgba(15,34,64,0.08),0_20px_48px_-12px_rgba(15,34,64,0.22)] rounded-sm px-[9%] pt-[6%] pb-[8%] text-[15px] leading-[1.6] text-slate-900"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}>
      {draft && (
        <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden print:hidden" aria-hidden>
          <span className="text-[110px] font-bold tracking-[0.2em] text-slate-900/[0.035] -rotate-[28deg]">ЧЕРНОВА</span>
        </div>
      )}
      {/* бланка */}
      <div className="flex items-center gap-4 pb-3 border-b-2 border-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/csop-varna-logo.jpg" alt="" className="w-14 h-14 object-contain" />
        <div className="flex-1 text-center">
          <div className="font-bold text-[15px]">{CENTER_NAME}</div>
          <div className="italic text-[12.5px] text-slate-600">ул. „Петко Стайнов“ №7, гр. Варна</div>
          <div className="italic text-[12.5px] text-slate-600">e-mail: info-400052@edu.mon.bg · тел. 052 619 456</div>
        </div>
      </div>

      <div className="text-center mt-8">
        <div className="text-[22px] font-bold tracking-[0.3em] pl-[0.3em]">ЗАПОВЕД</div>
        <div className="mt-1">{number ? `№ ${number}` : <span className="text-slate-400">№ ………/{dmy(date) || '……'} г.</span>}</div>
        <div>{CENTER_CITY}</div>
      </div>

      <p className="mt-7 text-justify indent-10">На основание <Rich s={body.basis} onMissing={onMissing} /></p>
      <div className="text-center font-bold tracking-[0.25em] my-5">{body.verb}:</div>

      <div className="space-y-2.5">
        {all.map((pt, i) => {
          const [first, ...rest] = pt.split('\n')
          return (
            <div key={i}>
              <p className="text-justify indent-10">{i + 1}. <Rich s={first} onMissing={onMissing} /></p>
              {rest.length > 0 && <div className="pl-20 mt-0.5 space-y-0.5">{rest.map((ln, j) => <p key={j}><Rich s={ln} onMissing={onMissing} /></p>)}</div>}
            </div>
          )
        })}
      </div>

      <div className="mt-14 grid grid-cols-[1fr_auto] gap-x-6">
        <div className="font-bold">ДИРЕКТОР:</div>
        <div className="text-right">
          <div className="text-slate-400">………………………………</div>
          <div className="text-[14px]">/ {director || '…………'} /</div>
        </div>
      </div>

      {people.length > 0 && (
        <div className="mt-10 text-[14px]">
          <div className="font-bold mb-1.5">Запознати със заповедта:</div>
          {people.map((p, i) => (
            <div key={p.id} className="flex items-baseline gap-2">
              <span className="shrink-0">{i + 1}. {p.name}{p.position && ` – ${p.position}`}</span>
              <span className="flex-1 border-b border-dotted border-slate-400 translate-y-[-3px]" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
