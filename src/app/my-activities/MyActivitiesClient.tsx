'use client'
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus, X, Loader2, Lock, HeartPulse, ChevronRight, CalendarClock, Check, Users } from 'lucide-react'
import { assignToMe, removeFromMe } from './actions'
interface Row {
  id: string
  name: string
  className: string
  externalClass: string
  mine: boolean
  takenBy: string | null
}
type Tab = 'mine' | 'free' | 'taken'

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0] || ''
  const b = parts[parts.length - 1]?.[0] || ''
  return (a + b).toUpperCase()
}
// Стабилен цвят по име (за аватара)
function avatarColor(name: string) {
  const colors = [
    'bg-teal-100 text-teal-700', 'bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700',
    'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-emerald-100 text-emerald-700',
    'bg-cyan-100 text-cyan-700', 'bg-indigo-100 text-indigo-700',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function MyActivitiesClient({ rows, roleLabel }: { rows: Row[]; roleLabel: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('mine')
  const [flash, setFlash] = useState<{ id: string; type: 'added' | 'removed' | 'error'; text: string } | null>(null)

  const mineCount = useMemo(() => rows.filter(r => r.mine).length, [rows])
  const freeCount = useMemo(() => rows.filter(r => !r.mine && !r.takenBy).length, [rows])
  const takenCount = useMemo(() => rows.filter(r => !r.mine && r.takenBy).length, [rows])

  const list = useMemo(() => {
    let l = rows.filter(r => {
      if (tab === 'mine') return r.mine
      if (tab === 'free') return !r.mine && !r.takenBy
      return !r.mine && r.takenBy
    })
    if (search.trim()) {
      const q = search.toLowerCase()
      l = l.filter(r => r.name.toLowerCase().includes(q) || r.className.toLowerCase().includes(q))
    }
    return l.sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  }, [rows, search, tab])

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

  const tabs: { id: Tab; label: string; count: number; activeColor: string }[] = [
    { id: 'mine', label: 'В моя график', count: mineCount, activeColor: 'bg-teal-600 text-white' },
    { id: 'free', label: 'Неразпределени', count: freeCount, activeColor: 'bg-[#0f2240] text-white' },
    { id: 'taken', label: 'При колеги', count: takenCount, activeColor: 'bg-slate-600 text-white' },
  ]

  return (
    <div className="space-y-4">
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

      {/* Табове по статус */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-white border border-slate-200 rounded-xl w-fit shadow-sm">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id ? `${t.activeColor} shadow-sm` : 'text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              tab === t.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
          </button>
        ))}
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

      {/* Списък */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
          {list.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Users size={32} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">
                {tab === 'mine' ? 'Още нямаш зачислени деца' : tab === 'free' ? 'Няма неразпределени деца' : 'Няма деца при колеги'}
              </p>
              {tab === 'mine' && freeCount > 0 && (
                <button onClick={() => setTab('free')} className="mt-2 text-xs font-bold text-teal-600 hover:underline">
                  Виж {freeCount} неразпределени →
                </button>
              )}
            </div>
          ) : (
            list.map((r, idx) => {
              const isBusy = busy === r.id
              const f = flash?.id === r.id ? flash : null
              return (
                <div key={r.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50/60 ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}>
                  {/* Ляво: аватар + име */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(r.name)}`}>
                      {initials(r.name)}
                    </div>
                    <Link href={`/students/${r.id}`} className="min-w-0 group">
                      <div className={`text-sm truncate group-hover:underline ${r.mine ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                        {r.name}
                      </div>
                      {r.className && <div className="text-[11px] text-slate-400">{r.className}</div>}
                    </Link>
                  </div>
                  {/* Дясно: действие */}
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
                        <span className="group-hover/btn:hidden">Добавен</span>
                        <span className="hidden group-hover/btn:inline">Премахни</span>
                      </button>
                    ) : r.takenBy ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-slate-500 bg-slate-100">
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
    </div>
  )
}
