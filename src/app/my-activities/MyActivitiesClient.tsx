'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, X, Loader2, Lock, HeartPulse, ChevronRight, CalendarClock, Check } from 'lucide-react'
import { assignToMe, removeFromMe } from './actions'

interface Row {
  id: string
  name: string
  className: string
  externalClass: string
  mine: boolean
  takenBy: string | null
}

export default function MyActivitiesClient({ rows, roleLabel }: { rows: Row[]; roleLabel: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [flash, setFlash] = useState<{ id: string; type: 'added' | 'removed' | 'error'; text: string } | null>(null)

  const mineCount = useMemo(() => rows.filter(r => r.mine).length, [rows])
  const freeCount = useMemo(() => rows.filter(r => !r.mine && !r.takenBy).length, [rows])
  const takenCount = useMemo(() => rows.filter(r => !r.mine && r.takenBy).length, [rows])

  const list = useMemo(() => {
    let l = [...rows]
    if (search.trim()) {
      const q = search.toLowerCase()
      l = l.filter(r => r.name.toLowerCase().includes(q) || r.className.toLowerCase().includes(q))
    }
    // Подредба: моите първо, после свободни, после заети — всяка група по име
    return l.sort((a, b) => {
      const rank = (r: Row) => r.mine ? 0 : !r.takenBy ? 1 : 2
      const ra = rank(a), rb = rank(b)
      if (ra !== rb) return ra - rb
      return a.name.localeCompare(b.name, 'bg')
    })
  }, [rows, search])

  function showFlash(id: string, type: 'added' | 'removed' | 'error', text: string) {
    setFlash({ id, type, text })
    setTimeout(() => setFlash(f => (f?.id === id ? null : f)), 2500)
  }

  function doAssign(r: Row) {
    setBusy(r.id)
    startTransition(async () => {
      const res = await assignToMe(r.id)
      setBusy(null)
      if (res.error) { showFlash(r.id, 'error', res.error); return }
      showFlash(r.id, 'added', `${r.name.split(' ')[0]} е зачислен`)
      router.refresh()
    })
  }

  function doRemove(r: Row) {
    setBusy(r.id)
    startTransition(async () => {
      const res = await removeFromMe(r.id)
      setBusy(null)
      if (res.error) { showFlash(r.id, 'error', res.error); return }
      showFlash(r.id, 'removed', `${r.name.split(' ')[0]} е премахнат`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* Връзка към графика */}
      <Link href="/my-activities/schedule"
        className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border border-teal-200 bg-teal-50/50 hover:bg-teal-50 transition-colors group">
        <div className="flex items-center gap-2.5">
          <CalendarClock size={18} className="text-teal-600" />
          <div>
            <div className="text-sm font-semibold text-slate-800">Моят седмичен график</div>
            <div className="text-xs text-slate-500">Разпредели децата си по дни и часове</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-teal-400 group-hover:text-teal-600" />
      </Link>

      {/* Чипове за бърз поглед */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-50 border border-teal-200">
          <HeartPulse size={15} className="text-teal-600" />
          <span className="text-sm font-semibold text-teal-800">{mineCount}</span>
          <span className="text-xs text-teal-600">мои деца</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-sm font-semibold text-slate-700">{freeCount}</span>
          <span className="text-xs text-slate-500">свободни</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
          <Lock size={13} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{takenCount}</span>
          <span className="text-xs text-slate-500">при други</span>
        </div>
      </div>

      {/* Търсене */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Търси дете по име или паралелка..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300"
        />
      </div>

      {/* Списъкът — всички деца, цветови статус на реда */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
          {list.length === 0 ? (
            <p className="text-sm text-slate-400 px-5 py-10 text-center">Няма намерени деца</p>
          ) : (
            list.map(r => {
              const isBusy = busy === r.id
              const f = flash?.id === r.id ? flash : null

              // Цвят на реда според статус
              const rowClass = r.mine
                ? 'bg-teal-50/40 hover:bg-teal-50/70'
                : r.takenBy
                  ? 'bg-slate-50/30'
                  : 'hover:bg-slate-50/50'

              return (
                <div key={r.id} className={`flex items-center justify-between gap-3 px-5 py-2.5 transition-colors ${rowClass}`}>
                  {/* Ляво: индикатор + име */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-1.5 h-8 rounded-full flex-shrink-0 ${
                      r.mine ? 'bg-teal-400' : r.takenBy ? 'bg-slate-200' : 'bg-emerald-300'
                    }`} />
                    <Link href={`/students/${r.id}`} className="min-w-0 group">
                      <div className={`text-sm truncate group-hover:underline ${r.mine ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                        {r.name}
                      </div>
                      {r.className && <div className="text-[11px] text-slate-400">{r.className}</div>}
                    </Link>
                  </div>

                  {/* Дясно: действие според статус */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {f && (
                      <span className={`text-[11px] font-medium ${
                        f.type === 'error' ? 'text-red-600' : f.type === 'removed' ? 'text-slate-500' : 'text-teal-600'
                      }`}>
                        {f.text}
                      </span>
                    )}

                    {r.mine ? (
                      <button onClick={() => doRemove(r)} disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-100 text-teal-700 hover:bg-red-100 hover:text-red-600 transition-colors group/btn">
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : (
                          <>
                            <Check size={12} className="group-hover/btn:hidden" />
                            <X size={12} className="hidden group-hover/btn:block" />
                          </>
                        )}
                        <span className="group-hover/btn:hidden">Мое</span>
                        <span className="hidden group-hover/btn:inline">Премахни</span>
                      </button>
                    ) : r.takenBy ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-slate-400">
                        <Lock size={11} /> {r.takenBy}
                      </span>
                    ) : (
                      <button onClick={() => doAssign(r)} disabled={isBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#0f2240' }}>
                        {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        Зачисли
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Зелена лента — свободно дете · Тюркоазена — твое · Сива — при друг специалист
      </p>
    </div>
  )
}
