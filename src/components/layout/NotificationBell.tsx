'use client'
// Камбанка с известия в менюто: какво чака човека (съгласуване, протоколи, срокове, замествания).
// „Видяно“ се помни в браузъра — броячът показва само новите; самите задачи стоят, докато не се свършат.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, CheckCheck, ChevronRight } from 'lucide-react'
import { getNotifications, type Notice } from '@/lib/notifications-actions'
import { cn } from '@/lib/utils'

const SEEN_KEY = 'eis-notices-seen'
const readSeen = (): string[] => { try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }

// Камбанката е на няколко места (менюто, горната лента на телефона) — всички ползват едно четене,
// най-много веднъж в минута.
const SEEN_EVT = 'eis-notices-seen'
let shared: { at: number; p: Promise<Notice[]> } | null = null
function fetchShared(): Promise<Notice[]> {
  if (!shared || Date.now() - shared.at > 60_000) {
    const p = getNotifications()
    shared = { at: Date.now(), p }
    p.catch(() => { if (shared?.p === p) shared = null })
  }
  return shared.p
}

export default function NotificationBell({ mini, variant = 'sidebar' }: { mini?: boolean; variant?: 'sidebar' | 'mobile' }) {
  const pathname = usePathname()
  const [items, setItems] = useState<Notice[]>([])
  const [seen, setSeen] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try { setItems(await fetchShared()) } catch { /* без връзка — остава старото */ }
  }, [])

  useEffect(() => {
    const sync = () => setSeen(readSeen())
    sync(); load()
    window.addEventListener(SEEN_EVT, sync)
    return () => window.removeEventListener(SEEN_EVT, sync)
  }, [load])
  // при смяна на страницата и при връщане в раздела — опресняване
  useEffect(() => { setOpen(false); load() }, [pathname, load])
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const fresh = items.filter(i => !seen.includes(i.key))
  function markSeen() {
    // пазим само ключовете на още активните известия — списъкът не расте безкрайно
    const next = items.map(i => i.key)
    setSeen(next)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)) } catch {}
    window.dispatchEvent(new Event(SEEN_EVT))
  }

  const dot = (t: Notice['tone']) => t === 'rose' ? 'bg-rose-500' : t === 'amber' ? 'bg-amber-500' : 'bg-sky-500'
  const badge = fresh.length > 0 && (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold leading-4 text-center tabular-nums ring-2 ring-[#f0f7ff]">
      {fresh.length > 9 ? '9+' : fresh.length}
    </span>
  )

  return (
    <div className={cn('relative', variant === 'sidebar' && !mini && 'flex-shrink-0')}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={`Известия${fresh.length ? ` — ${fresh.length} нови` : ''}`} title="Известия"
        className={cn('relative flex items-center justify-center rounded-full transition-colors text-[#4a7fa8] hover:text-[#0f2240]',
          variant === 'mobile' ? 'p-1.5' : 'w-8 h-8 border border-[rgba(15,34,64,0.18)] bg-white/80 hover:border-[rgba(15,34,64,0.40)] shadow-[0_1px_2px_rgba(15,34,64,0.06)]',
          open && 'text-[#0f2240] border-[rgba(15,34,64,0.40)]')}>
        <Bell size={variant === 'mobile' ? 20 : 15} />
        {badge}
      </button>
      {open && (<>
        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
        <div role="dialog" aria-label="Известия"
          className={cn('z-[61] w-[min(92vw,360px)] rounded-2xl bg-white ring-1 ring-[#0f2240]/10 shadow-[0_18px_48px_rgba(15,34,64,0.24)] overflow-hidden animate-[popIn_.14s_ease-out]',
            variant === 'mobile' ? 'fixed top-14 right-2' : 'fixed top-3 left-[232px]', variant === 'sidebar' && mini && 'left-[72px]')}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="text-sm font-semibold text-[#0f2240]">Известия</div>
            {fresh.length > 0 && (
              <button onClick={markSeen} className="inline-flex items-center gap-1 text-[11px] text-[#4a7fa8] hover:text-[#0f2240]">
                <CheckCheck size={13} /> Отбележи като видени
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {items.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-slate-500">Няма нищо, което да ви чака.</div>
            )}
            {items.map(i => {
              const isNew = !seen.includes(i.key)
              return (
                <Link key={i.key} href={i.href} onClick={() => setOpen(false)}
                  className="group flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-[#eaf3fc]">
                  <span className={cn('mt-1.5 w-2 h-2 rounded-full flex-shrink-0', dot(i.tone), !isNew && 'opacity-40')} />
                  <span className="flex-1 min-w-0">
                    <span className={cn('block text-[13px] leading-snug text-slate-800', isNew && 'font-semibold')}>{i.title}</span>
                    {i.hint && <span className="block text-xs text-slate-500 truncate">{i.hint}</span>}
                  </span>
                  <ChevronRight size={14} className="mt-1 text-slate-300 group-hover:text-[#0f2240] flex-shrink-0" />
                </Link>
              )
            })}
          </div>
          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500">
              Известието изчезва само, когато задачата е свършена.
            </div>
          )}
        </div>
      </>)}
    </div>
  )
}
