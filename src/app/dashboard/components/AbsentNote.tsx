'use client'
// Листчето „Днес заместват“ — като бележка, залепена с тиксо: ръкописен шрифт, редове от тетрадка.
// Показва САМО заместванията: „Иван Г. замества Петър П.“ — без отсъстващите, които не се заместват или още нямат заместник.
// • Изскача само когато има нещо НОВО за този колега: ново отсъствие или сменен/нов заместник.
// • „Видях“ го прибира; видяното се помни в браузъра (за днес и за тези отсъствия).
// • Остава малка бележка „Днес заместват · N“ — клик я отваря отново с всички.
// • compact — за картата на управата: само карфица в заглавието (картата си показва списъка).
import '@fontsource/caveat/500.css'
import '@fontsource/caveat/700.css'
import { useEffect, useState } from 'react'
import { Pin, Check, X } from 'lucide-react'
import type { TodayAbsence } from '@/lib/today-absences'

const KEY = 'eis-absent-seen'
const HAND = "'Caveat', cursive"
const short = (n: string) => { const [f, l] = n.trim().split(/\s+/); return l ? `${f} ${l[0]}.` : f }
const dm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.')
// ключ: отсъствието + кой го замества → нов заместник = ново за колегите
const keyOf = (r: TodayAbsence) => `${r.id}|${r.by}`

export default function AbsentNote({ rows: all, today, compact = false }: { rows: TodayAbsence[]; today: string; compact?: boolean }) {
  const rows = all.filter(r => !!r.by)
  const [seen, setSeen] = useState<Set<string> | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let s = new Set<string>()
    try { s = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch {}
    setSeen(s)
    if (rows.some(r => !s.has(keyOf(r)))) setOpen(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function ack() {
    const keys = rows.map(keyOf)   // пазим само текущите — старите отпадат сами
    try { localStorage.setItem(KEY, JSON.stringify(keys)) } catch {}
    setSeen(new Set(keys)); setOpen(false)
  }

  const isNew = (r: TodayAbsence) => !!seen && !seen.has(keyOf(r))
  const newCount = seen ? rows.filter(isNew).length : 0
  const startsToday = (r: TodayAbsence) => r.from === today
  const subs = (r: TodayAbsence) => r.by.split(', ').map(short)

  return (
    <>
      {/* малката бележка — винаги в таблото (при управата — само карфица в заглавието на картата) */}
      {compact ? (
        <button type="button" onClick={() => setOpen(true)} title="Покажи листчето"
          className="relative p-1 -m-1 rounded-lg text-rose-500 hover:bg-rose-50">
          <Pin size={14} className="rotate-[25deg]" />
          {newCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500" />}
        </button>
      ) : <button type="button" onClick={() => setOpen(true)} style={{ fontFamily: HAND }}
        className="relative w-full text-left px-5 pt-3 pb-2.5 rounded-2xl border border-amber-200/70 bg-[#fffbea] shadow-[0_1px_3px_rgba(120,90,20,0.12)] hover:shadow-md hover:-translate-y-0.5 transition-all">
        <Pin size={15} className="absolute top-2.5 right-3 text-rose-500 rotate-[25deg]" />
        <div className="flex items-baseline gap-2 pr-6">
          <span className="text-[24px] leading-none text-[#0f2240] font-bold">Днес заместват</span>
          {newCount > 0 && <span className="text-[18px] leading-none text-rose-600 -rotate-3">{newCount} ново!</span>}
        </div>
        <div className="mt-1.5 grid grid-cols-[auto_auto_1fr_auto] gap-x-2 items-baseline text-[19px] leading-[24px]">
          {rows.slice(0, 3).map(r => (
            <div key={r.id} className="contents">
              <span className="text-emerald-800 truncate">{subs(r).join(', ')}</span>
              <span className="text-slate-400">→</span>
              <span className="text-slate-800 truncate">{short(r.absent)}</span>
              <span className="text-slate-400 text-[17px] tabular-nums">до {dm(r.to)}</span>
            </div>
          ))}
        </div>
        {rows.length > 3 && <div className="text-[17px] text-slate-500">и още {rows.length - 3}…</div>}
      </button>}

      {/* листчето */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={ack}>
          <div onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg -rotate-[1.2deg] animate-in zoom-in-95 duration-300"
            style={{ filter: 'drop-shadow(0 18px 30px rgba(60,40,10,0.22))' }}>
            {/* тиксо */}
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-28 h-7 rotate-[2deg] rounded-sm z-10"
              style={{ background: 'rgba(255,255,255,0.55)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', backdropFilter: 'blur(1px)' }} />
            <div className="rounded-[3px] px-6 pt-8 pb-5"
              style={{
                background: '#fffdf3',
                // редове от тетрадка + червена линия на полето
                backgroundImage: 'linear-gradient(90deg, transparent 38px, rgba(239,68,68,0.35) 38px, rgba(239,68,68,0.35) 39.5px, transparent 39.5px), repeating-linear-gradient(transparent, transparent 33px, rgba(59,130,246,0.18) 33px, rgba(59,130,246,0.18) 34px)',
                backgroundPosition: '0 0, 0 18px',
              }}>
              <button type="button" onClick={ack} className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-700"><X size={16} /></button>
              <div className="pl-8">
                <h2 style={{ fontFamily: HAND }} className="text-[34px] leading-[34px] text-[#0f2240] font-bold">Днес заместват</h2>
                {/* всичко на ръка, подредено в колони по редовете на листа */}
                <div className="mt-[2px] grid grid-cols-[auto_auto_1fr_auto] gap-x-2.5 items-baseline" style={{ fontFamily: HAND }}>
                  {rows.map(r => (
                    <div key={r.id} className="contents">
                      <span className="leading-[34px] text-[25px] text-emerald-800">{subs(r).join(', ')}</span>
                      <span className="leading-[34px] text-[21px] text-slate-400">{subs(r).length > 1 ? 'заместват' : 'замества'}</span>
                      <span className="leading-[34px] text-[25px] text-slate-800">{r.absent}{isNew(r) && <span className="ml-1.5 text-[19px] text-rose-600 inline-block -rotate-6">ново!</span>}</span>
                      <span className="leading-[34px] text-[20px] text-slate-500 tabular-nums text-right whitespace-nowrap">{startsToday(r) ? 'от днес, ' : ''}до {dm(r.to)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={ack}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border-2 border-[#0f2240]/70 text-[#0f2240] hover:bg-[#0f2240] hover:text-white transition-colors -rotate-[1deg]"
                    style={{ fontFamily: HAND, fontSize: 22 }}>
                    <Check size={16} /> Видях
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
