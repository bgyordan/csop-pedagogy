'use client'
// Листчето „Днес отсъстват“ — като бележка, залепена с тиксо: ръкописен шрифт, редове от тетрадка.
// Две части: „заместват ги“ (Петър П. ← Иван Г.) и „отсъстват“ (помощници, специалисти и др., които не се заместват —
// за да не ги търсят колегите). Показват се през целия период на отсъствието.
// • Изскача само когато има нещо НОВО за този колега: ново отсъствие или сменен/нов заместник.
// • „Видях“ го прибира; видяното се помни в браузъра.
// • Остава малка бележка в таблото — клик я отваря отново.
// • compact — за картата на управата: само карфица в заглавието (картата си показва списъка).
// Стил: едно мастило (тъмносиньо), датите в сиво, „ново“ — единственият червен акцент; всеки колега на два реда
// (име · до кога / под него „замества: …“); бледи редове на тетрадката, без червено поле.
import { isOpenEnd, OPEN_END_TEXT } from '@/lib/open-end'
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

export default function AbsentNote({ rows, today, compact = false }: { rows: TodayAbsence[]; today: string; compact?: boolean }) {
  const [seen, setSeen] = useState<Set<string> | null>(null)
  const [open, setOpen] = useState(false)
  const subRows = rows.filter(r => !!r.by)
  const awayRows = rows.filter(r => !r.by)

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
  const subs = (r: TodayAbsence) => r.by.split(', ').map(short)
  const until = (r: TodayAbsence) => `${r.from === today ? 'от днес, ' : ''}${isOpenEnd(r.to) ? OPEN_END_TEXT : `до ${dm(r.to)}`}`

  // малката бележка: най-много 4 реда — първо заместванията, после отсъстващите
  const preview = [...subRows, ...awayRows].slice(0, 4)

  return (
    <>
      {compact ? (
        <button type="button" onClick={() => setOpen(true)} title="Покажи листчето"
          className="relative p-1 -m-1 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-50">
          <Pin size={14} className="rotate-[25deg]" />
          {newCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500" />}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} style={{ fontFamily: HAND }}
          className="relative w-full text-left px-5 pt-3 pb-2.5 rounded-2xl border border-slate-200 bg-[#fffdf6] shadow-[0_1px_3px_rgba(15,34,64,0.08)] hover:shadow-md hover:-translate-y-0.5 transition-all">
          <Pin size={15} className="absolute top-2.5 right-3 text-slate-400 rotate-[25deg]" />
          <div className="flex items-baseline gap-2 pr-6">
            <span className="text-[24px] leading-none text-[#0f2240] font-bold">Днес отсъстват</span>
            <span className="text-[18px] leading-none text-slate-400">{rows.length}</span>
            {newCount > 0 && <span className="text-[17px] leading-none text-rose-600">· {newCount} ново</span>}
          </div>
          <div className="mt-1.5 space-y-0.5">
            {preview.map(r => (
              <div key={r.id} className="flex items-baseline gap-3 text-[19px] leading-[24px]">
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-[#0f2240]">{short(r.absent)}</span>
                  {r.by && <span className="text-slate-400 text-[17px]"> · замества {subs(r).join(', ')}</span>}
                </span>
                <span className="text-slate-400 text-[17px] tabular-nums shrink-0">{isOpenEnd(r.to) ? OPEN_END_TEXT : `до ${dm(r.to)}`}</span>
              </div>
            ))}
          </div>
          {rows.length > preview.length && <div className="text-[17px] text-slate-500">и още {rows.length - preview.length}…</div>}
        </button>
      )}

      {/* листчето */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-slate-900/20 backdrop-blur-[2px] animate-in fade-in duration-300" onClick={ack}>
          <div onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg -rotate-[1.2deg] animate-in zoom-in-95 duration-300"
            style={{ filter: 'drop-shadow(0 18px 30px rgba(60,40,10,0.22))' }}>
            {/* тиксо */}
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-28 h-7 rotate-[2deg] rounded-sm z-10"
              style={{ background: 'rgba(255,255,255,0.55)', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', backdropFilter: 'blur(1px)' }} />
            <div className="rounded-[3px] px-6 pt-8 pb-5 max-h-[85vh] overflow-y-auto"
              style={{
                background: '#fffdf3',
                // редове от тетрадка + червена линия на полето
                backgroundImage: 'repeating-linear-gradient(transparent, transparent 33px, rgba(15,34,64,0.08) 33px, rgba(15,34,64,0.08) 34px)',
                backgroundPosition: '0 18px',
              }}>
              <button type="button" onClick={ack} className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-700"><X size={16} /></button>
              <div className="pl-2" style={{ fontFamily: HAND }}>
                <h2 className="text-[34px] leading-[34px] text-[#0f2240] font-bold">Днес отсъстват</h2>

                {subRows.length > 0 && (
                  <>
                    <div className="leading-[34px] text-[21px] text-slate-400">— заместват се</div>
                    {subRows.map(r => (
                      <div key={r.id}>
                        <div className="flex items-baseline gap-3">
                          <span className="leading-[34px] text-[25px] text-[#0f2240] min-w-0 flex-1 truncate">
                            {r.absent}{isNew(r) && <span className="ml-2 text-[18px] text-rose-600">ново</span>}
                          </span>
                          <span className="leading-[34px] text-[20px] text-slate-400 tabular-nums whitespace-nowrap">{until(r)}</span>
                        </div>
                        <div className="leading-[34px] text-[20px] text-slate-500 pl-5 truncate">замества: {subs(r).join(', ')}</div>
                      </div>
                    ))}
                  </>
                )}

                {awayRows.length > 0 && (
                  <>
                    <div className="leading-[34px] text-[21px] text-slate-400">— отсъстват</div>
                    {awayRows.map(r => (
                      <div key={r.id} className="flex items-baseline gap-3">
                        <span className="leading-[34px] text-[25px] text-[#0f2240] min-w-0 flex-1 truncate">
                          {r.absent}{isNew(r) && <span className="ml-2 text-[18px] text-rose-600">ново</span>}
                        </span>
                        <span className="leading-[34px] text-[20px] text-slate-400 tabular-nums whitespace-nowrap">{until(r)}</span>
                      </div>
                    ))}
                  </>
                )}

                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={ack}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border-2 border-[#0f2240]/70 text-[#0f2240] hover:bg-[#0f2240] hover:text-white transition-colors -rotate-[1deg]"
                    style={{ fontSize: 22 }}>
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
