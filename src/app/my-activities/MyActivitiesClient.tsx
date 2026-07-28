'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, X, Loader2, Lock, HeartPulse, ChevronRight, ArrowUpDown, CalendarClock } from 'lucide-react'
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
  const [sortBy, setSortBy] = useState<'name' | 'class'>('name')
  const [showAvailable, setShowAvailable] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const mine = useMemo(() => rows.filter(r => r.mine), [rows])

  const others = useMemo(() => {
    let list = rows.filter(r => !r.mine)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => r.name.toLowerCase().includes(q) || r.className.toLowerCase().includes(q))
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'class') {
        const c = a.className.localeCompare(b.className, 'bg', { numeric: true })
        if (c !== 0) return c
      }
      return a.name.localeCompare(b.name, 'bg')
    })
    return list
  }, [rows, search, sortBy])

  function doAssign(id: string) {
    setBusy(id); setMsg(null)
    startTransition(async () => {
      const res = await assignToMe(id)
      setBusy(null)
      if (res.error) { setMsg(res.error); return }
      router.refresh()
    })
  }

  function doRemove(id: string) {
    if (!confirm('Да премахна това дете от моите?')) return
    setBusy(id); setMsg(null)
    startTransition(async () => {
      const res = await removeFromMe(id)
      setBusy(null)
      if (res.error) { setMsg(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
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

      {msg && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {msg}
        </div>
      )}

      {/* МОИТЕ ДЕЦА */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
          <HeartPulse size={15} className="text-teal-500" />
          <span className="text-sm font-medium text-slate-700">Мои деца за терапия</span>
          <span className="ml-auto text-xs text-slate-400">{mine.length}</span>
        </div>

        {mine.length === 0 ? (
          <p className="text-sm text-slate-400 px-5 py-6 text-center">
            Още нямате зачислени деца. Добавете от списъка долу.
          </p>
        ) : (
          <div className="divide-y divide-slate-50">
            {mine.sort((a, b) => a.name.localeCompare(b.name, 'bg')).map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-5 py-2.5 hover:bg-slate-50/50 transition-colors">
                <Link href={`/students/${r.id}`} className="flex items-center gap-2 group min-w-0">
                  <span className="text-sm text-slate-700 group-hover:text-[#0f2240]">{r.name}</span>
                  <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                </Link>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {r.className && <span className="text-[11px] text-slate-400">{r.className}</span>}
                  <button onClick={() => doRemove(r.id)} disabled={busy === r.id}
                    className="text-slate-300 hover:text-red-500 transition-colors" title="Премахни">
                    {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <X size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ДОБАВЯНЕ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowAvailable(v => !v)}
          className="w-full flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
          <Plus size={15} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Добави дете</span>
          <span className="ml-auto text-xs text-slate-400">{showAvailable ? 'скрий' : 'покажи'}</span>
        </button>

        {showAvailable && (
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Търси по име или паралелка..."
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>
              <button
                onClick={() => setSortBy(s => s === 'name' ? 'class' : 'name')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <ArrowUpDown size={13} />
                {sortBy === 'name' ? 'По име' : 'По паралелка'}
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl">
              {others.length === 0 ? (
                <p className="text-sm text-slate-400 px-4 py-6 text-center">Няма намерени деца</p>
              ) : (
                others.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-slate-50/50 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-700">{r.name}</div>
                      {r.className && <div className="text-[11px] text-slate-400">{r.className}</div>}
                    </div>
                    {r.takenBy ? (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400 flex-shrink-0">
                        <Lock size={11} /> {r.takenBy}
                      </span>
                    ) : (
                      <button onClick={() => doAssign(r.id)} disabled={busy === r.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90 flex-shrink-0"
                        style={{ backgroundColor: '#0f2240' }}>
                        {busy === r.id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                        Зачисли
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
