'use client'
// Картички с имената на децата → докосване отваря „днес“ на детето: къде е сега, какво следва, целият ден.
// С търсене (помощници): търси сред всички деца; без търсене показва подадения списък по подразбиране.
import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { TodayKid, TodayRow } from '@/lib/children-today'

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

function status(k: TodayKid, nowMin: number): { text: string; tone: 'now' | 'next' | 'muted' | 'warn' } {
  if (k.absent) return { text: 'отсъства днес', tone: 'warn' }
  const cur = k.rows.find(r => nowMin >= r.start && nowMin < r.end)
  if (cur) return { text: `сега: ${cur.what}`, tone: 'now' }
  const next = k.rows.find(r => nowMin < r.start)
  if (next) return { text: `следва ${next.time.split('–')[0]} · ${next.what}`, tone: 'next' }
  return { text: k.rows.length ? 'приключи за днес' : 'няма часове днес', tone: 'muted' }
}

export default function ChildrenTodayClient({ kids, defaultIds, nowMin, search = false, emptyText = 'Няма деца.' }: {
  kids: TodayKid[]; defaultIds?: string[]; nowMin: number; search?: boolean; emptyText?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<TodayKid | null>(null)

  const shown = useMemo(() => {
    const t = norm(q)
    if (search && t.length >= 2) return kids.filter(k => norm(k.name).split(' ').some(w => w.startsWith(t)) || norm(k.name).includes(t)).slice(0, 30)
    if (defaultIds) { const set = new Set(defaultIds); return kids.filter(k => set.has(k.id)) }
    return kids
  }, [q, kids, defaultIds, search])

  // присъстващите напред, отсъстващите накрая
  const sorted = [...shown].sort((a, b) => (a.absent === b.absent ? 0 : a.absent ? 1 : -1))
  const searching = search && norm(q).length >= 2

  return (
    <div className="p-3 sm:p-4 space-y-3">
      {search && (
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси дете…" inputMode="search" enterKeyHint="search"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 pl-11 pr-10 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:bg-white" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Изчисти" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
        </div>
      )}
      {search && (
        <div className="text-[12px] text-slate-400 px-1">{searching ? `Намерени: ${sorted.length}` : 'Деца в ИФО днес'}</div>
      )}

      {sorted.length === 0 ? (
        <p className="px-1 py-3 text-sm text-slate-400">{searching ? 'Няма дете с такова име.' : emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {sorted.map(k => {
            const st = status(k, nowMin)
            const warn = !k.absent && k.rows.some(r => r.note)
            return (
              <button key={k.id} type="button" onClick={() => setOpen(k)}
                className={`relative text-left rounded-xl border px-3 py-2.5 min-h-[4.25rem] transition hover:shadow-sm hover:-translate-y-px ${k.absent ? 'border-slate-100 bg-slate-50/70' : 'border-slate-200/80 bg-white'}`}>
                {warn && <span title="промяна за деня" className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400" />}
                <span className={`block text-[14px] leading-snug pr-3 ${k.absent ? 'text-slate-500' : 'text-[#0f2240]'}`}>{k.name}</span>
                <span className="block text-[11.5px] text-slate-400">{k.cls}{k.ifo ? ' · ИФО' : ''}</span>
                <span className={`block mt-1 text-[12px] truncate ${st.tone === 'now' ? 'text-teal-700' : st.tone === 'warn' ? 'text-amber-700' : 'text-slate-500'}`}>{st.text}</span>
              </button>
            )
          })}
        </div>
      )}

      {open && <KidSheet kid={open} nowMin={nowMin} onClose={() => setOpen(null)} />}
    </div>
  )
}

function KidSheet({ kid, nowMin, onClose }: { kid: TodayKid; nowMin: number; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [onClose])

  const cur = kid.rows.find(r => nowMin >= r.start && nowMin < r.end)
  const next = kid.rows.find(r => nowMin < r.start)
  const Big = ({ label, r }: { label: string; r: TodayRow }) => (
    <div className={`rounded-xl px-4 py-3 ${label === 'Сега' ? 'bg-teal-50' : 'bg-slate-50'}`}>
      <div className={`text-[11px] uppercase tracking-wider ${label === 'Сега' ? 'text-teal-700' : 'text-slate-400'}`}>{label} · {r.time}</div>
      <div className="text-[15px] text-[#0f2240] mt-0.5">{r.what}</div>
      {r.who && <div className="text-sm text-slate-600">{r.who}</div>}
      {r.note && <div className="text-xs text-amber-700 mt-0.5">{r.note}</div>}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/30" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-[0_8px_32px_rgba(15,34,64,0.2)] p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="text-lg text-[#0f2240] leading-snug">{kid.name}</div>
            <div className="text-sm text-slate-400">{kid.cls}{kid.ifo ? ' · ИФО' : ''}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Затвори" className="ml-auto p-2 -m-1 rounded-full text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {kid.absent ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">Отсъства днес</div>
        ) : kid.rows.length === 0 ? (
          <div className="text-sm text-slate-400">Няма часове днес.</div>
        ) : (
          <>
            {cur ? <Big label="Сега" r={cur} /> : !next && <div className="text-sm text-slate-500">Приключи за днес.</div>}
            {next && <Big label="Следва" r={next} />}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1 mt-1">Целият ден</div>
              <ul className="divide-y divide-slate-100">
                {kid.rows.map((r, i) => {
                  const nowHere = nowMin >= r.start && nowMin < r.end
                  const past = nowMin >= r.end
                  return (
                    <li key={i} className={`flex gap-3 py-1.5 text-sm ${past ? 'opacity-45' : ''} ${nowHere ? 'text-teal-800' : ''}`}>
                      <span className="w-[5.5rem] shrink-0 tabular-nums text-slate-500">{r.time}</span>
                      <span className="min-w-0">
                        <span className="text-slate-700">{r.what}</span>
                        {r.who && <span className="text-slate-500"> · {r.who}</span>}
                        {r.note && <span className="block text-xs text-amber-700">{r.note}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
