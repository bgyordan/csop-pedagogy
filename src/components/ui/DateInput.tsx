'use client'
// Поле за дата „дд.мм.гггг“ — пише се направо с цифри (точките се слагат сами), а иконката отваря календара.
// Заменя вградения <input type="date">, който в различните браузъри се държи странно
// (сегменти, които прескачат, година с 6 цифри, американски формат). Стойността навън е ISO „гггг-мм-дд“ или ''.

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, X } from 'lucide-react'

const toBg = (iso: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('.') : '')

/** „12.9.26“, „12092026“, „12.09.2026“ → ISO или null */
export function parseBgDate(s: string): string | null {
  const t = s.trim()
  if (!t) return ''
  let d: number, m: number, y: number
  const parts = t.split(/[.\-/\s]+/).filter(Boolean)
  if (parts.length === 3) { [d, m, y] = parts.map(Number) }
  else if (/^\d{8}$/.test(t)) { d = +t.slice(0, 2); m = +t.slice(2, 4); y = +t.slice(4) }
  else if (/^\d{6}$/.test(t)) { d = +t.slice(0, 2); m = +t.slice(2, 4); y = +t.slice(4) }
  else return null
  if (y < 100) y += 2000
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (!y || y < 1900 || y > 2100 || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function DateInput({ value, onChange, disabled, min, max, className = '', placeholder = 'дд.мм.гггг' }: {
  value: string; onChange: (iso: string) => void; disabled?: boolean; min?: string; max?: string; className?: string; placeholder?: string
}) {
  const [text, setText] = useState(toBg(value))
  const [bad, setBad] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  // външна промяна (напр. бутон „+1 година“) → обновяваме текста
  useEffect(() => { if (parseBgDate(text) !== value) { setText(toBg(value)); setBad(false) } }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function type(raw: string) {
    // само цифри и точки; точките след деня и месеца се слагат сами
    let s = raw.replace(/[^\d.]/g, '')
    if (/^\d{3}$/.test(s)) s = `${s.slice(0, 2)}.${s.slice(2)}`
    if (/^\d{1,2}\.\d{3}$/.test(s)) { const [a, b] = s.split('.'); s = `${a}.${b.slice(0, 2)}.${b.slice(2)}` }
    s = s.slice(0, 10)
    setText(s)
    const iso = parseBgDate(s)
    if (iso !== null && (iso === '' || /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s))) { setBad(false); onChange(iso) }
  }
  function commit() {
    const iso = parseBgDate(text)
    if (iso === null || (iso && ((min && iso < min) || (max && iso > max)))) { setBad(!!text.trim()); return }
    setBad(false); setText(toBg(iso)); onChange(iso)
  }

  return (
    <div className={`relative flex items-center ${className}`}>
      <input type="text" inputMode="numeric" value={text} disabled={disabled} placeholder={placeholder}
        onChange={e => type(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        className={`w-full text-sm rounded-lg border px-2.5 py-1.5 pr-14 bg-white focus:outline-none tabular-nums disabled:bg-slate-100 disabled:text-slate-400 ${bad ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-slate-400'}`} />
      {!disabled && text && (
        <button type="button" tabIndex={-1} onClick={() => { setText(''); setBad(false); onChange('') }} title="Изчисти"
          className="absolute right-7 p-1 text-slate-300 hover:text-slate-600"><X size={13} /></button>
      )}
      <button type="button" tabIndex={-1} disabled={disabled} title="Календар"
        onClick={() => { const el = picker.current; if (!el) return; try { el.showPicker() } catch { el.focus(); el.click() } }}
        className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-700 disabled:opacity-40"><CalendarDays size={15} /></button>
      {/* скрит календар — само за избор с мишката */}
      <input ref={picker} type="date" tabIndex={-1} aria-hidden value={value || ''} min={min} max={max}
        onChange={e => { setText(toBg(e.target.value)); setBad(false); onChange(e.target.value) }}
        className="absolute right-0 bottom-0 w-0 h-0 opacity-0 pointer-events-none" />
      {bad && <span className="absolute -bottom-4 left-0 text-[10.5px] text-rose-600">невалидна дата</span>}
    </div>
  )
}
