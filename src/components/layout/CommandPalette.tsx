'use client'
// Бързо търсене в цялата система (Ctrl+K / ⌘K или „/“):
// страници от менюто, ученици, служители и последно отваряните страници.
// Звездичка до страница я добавя в „Любими“ — те стоят най-горе в менюто.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Search, CornerDownLeft, Star, Clock, Users, UserCircle, FileText, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, getFullName } from '@/lib/utils'
import { useFavorites, useRecent, rememberVisit, type NavEntry } from './nav-memory'

type Result = { key: string; kind: 'page' | 'recent' | 'student' | 'staff'; label: string; hint?: string; href: string }

// търсене без значение от главни букви и „й/и“, „ъ/а“ — колегите често пишат на бързо
function norm(s: string) {
  return s.toLocaleLowerCase('bg').replace(/й/g, 'и').replace(/ъ/g, 'а').replace(/ѝ/g, 'и').trim()
}

export default function CommandPalette({ pages, canSearchStaff, open, onClose }: {
  pages: NavEntry[]
  canSearchStaff: boolean
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [people, setPeople] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { favorites, toggle: toggleFav, isFav } = useFavorites()
  const { recent } = useRecent()

  useEffect(() => {
    if (open) { setQ(''); setSel(0); setPeople([]); setTimeout(() => inputRef.current?.focus(), 10) }
  }, [open])

  // хора — от базата (RLS решава кой какво вижда), с малко изчакване между буквите
  useEffect(() => {
    const term = q.trim()
    if (!open || term.length < 2) { setPeople([]); setLoading(false); return }
    setLoading(true)
    let off = false
    const t = setTimeout(async () => {
      const parts = term.split(/\s+/).slice(0, 3)
      const like = (col: string) => parts.map(p => `${col}.ilike.%${p.replace(/[%,()]/g, '')}%`)
      const studentsQ = supabase.from('students').select('id, first_name, middle_name, last_name, status')
        .or([...like('first_name'), ...like('last_name')].join(',')).limit(30)
      const staffQ = canSearchStaff
        ? supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, position, is_active')
            .eq('is_active', true).or([...like('first_name'), ...like('last_name')].join(',')).limit(30)
        : Promise.resolve({ data: [] as any[] })
      let st: any[] | null = null, sp: any[] | null = null
      try {
        const [a, b] = await Promise.all([studentsQ, staffQ])
        st = a.data; sp = b.data
      } catch { /* без връзка — показват се само страниците */ }
      if (off) return
      // всички думи трябва да се срещат в името (напр. „Иван Пет“)
      const ns = parts.map(norm)
      const match = (p: any) => { const n = norm(getFullName(p)); return ns.every(w => n.includes(w)) }
      const res: Result[] = [
        ...(st || []).filter(match).slice(0, 8).map((s: any) => ({
          key: 's' + s.id, kind: 'student' as const, label: getFullName(s),
          hint: s.status === 'active' ? 'Ученик' : 'Ученик · архив', href: `/students/${s.id}`,
        })),
        ...(sp || []).filter(match).slice(0, 6).map((s: any) => ({
          key: 'p' + s.id, kind: 'staff' as const, label: getFullName(s),
          hint: s.position || 'Служител', href: `/staff/${s.id}`,
        })),
      ]
      setPeople(res); setLoading(false)
    }, 180)
    return () => { off = true; clearTimeout(t) }
  }, [q, open, canSearchStaff, supabase])

  const results: Result[] = useMemo(() => {
    const term = norm(q)
    if (!term) {
      const favs = favorites.map(f => ({ key: 'f' + f.href, kind: 'page' as const, label: f.label, hint: 'Любими', href: f.href }))
      const rec = recent.filter(r => r.href !== pathname && !favorites.some(f => f.href === r.href)).slice(0, 6)
        .map(r => ({ key: 'r' + r.href, kind: 'recent' as const, label: r.label, hint: 'Наскоро', href: r.href }))
      return [...favs, ...rec]
    }
    const pg = pages
      .filter(p => norm(p.label).includes(term) || (p.group && norm(p.group).includes(term)))
      .sort((a, b) => Number(!norm(a.label).startsWith(term)) - Number(!norm(b.label).startsWith(term)))
      .slice(0, 8)
      .map(p => ({ key: 'g' + p.href, kind: 'page' as const, label: p.label, hint: p.group, href: p.href }))
    return [...pg, ...people]
  }, [q, pages, people, favorites, recent, pathname])

  useEffect(() => { setSel(0) }, [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  function go(r: Result) {
    // учениците и колегите също влизат в „Последно отваряни“ — с името им
    if (r.kind === 'student' || r.kind === 'staff') rememberVisit({ href: r.href, label: r.label })
    onClose()
    router.push(r.href)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); go(results[sel]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  if (!open) return null

  const icon = (k: Result['kind']) =>
    k === 'student' ? <Users size={15} /> : k === 'staff' ? <UserCircle size={15} /> : k === 'recent' ? <Clock size={15} /> : <FileText size={15} />

  // групи със заглавия
  let lastHead = ''
  const head = (r: Result) => r.kind === 'student' ? 'Ученици' : r.kind === 'staff' ? 'Служители'
    : !q.trim() ? (r.hint === 'Любими' ? 'Любими' : 'Последно отваряни') : 'Страници'

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Търсене">
      <div className="absolute inset-0 bg-[#0f2240]/30 backdrop-blur-[2px] animate-[fadeIn_.12s_ease-out]" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-[0_24px_60px_rgba(15,34,64,0.28)] ring-1 ring-[#0f2240]/10 overflow-hidden animate-[popIn_.14s_ease-out]">
        <div className="flex items-center gap-3 px-4 border-b border-slate-100">
          <Search size={18} className="text-[#4a7fa8] flex-shrink-0" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder={canSearchStaff ? 'Търси страница, ученик или служител…' : 'Търси страница или ученик…'}
            className="flex-1 py-4 text-[15px] bg-transparent outline-none placeholder:text-slate-400 text-slate-800" />
          {loading && <span className="w-4 h-4 rounded-full border-2 border-[#4a7fa8]/30 border-t-[#4a7fa8] animate-spin" />}
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Затвори"><X size={16} /></button>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-slate-500">
              {q.trim()
                ? (loading ? 'Търся…' : 'Няма намерено. Опитай с друга дума.')
                : 'Започни да пишеш. Страниците, които отваряш често, ще се появят тук, а със ☆ ги добавяш в „Любими“.'}
            </div>
          )}
          {results.map((r, i) => {
            const h = head(r)
            const showHead = h !== lastHead
            lastHead = h
            const canStar = r.kind === 'page' || r.kind === 'recent'
            return (
              <div key={r.key}>
                {showHead && <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#4a7fa8]">{h}</div>}
                <div data-idx={i} onMouseMove={() => setSel(i)} onClick={() => go(r)}
                  className={cn('group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer',
                    i === sel ? 'bg-[#eaf3fc] text-[#0f2240]' : 'text-slate-700')}>
                  <span className={cn('flex-shrink-0', i === sel ? 'text-[#0f2240]' : 'text-[#6b8db0]')}>{icon(r.kind)}</span>
                  <span className="flex-1 min-w-0 truncate text-sm font-medium">{r.label}</span>
                  {r.hint && r.hint !== 'Любими' && r.hint !== 'Наскоро' && <span className="text-xs text-slate-500 truncate max-w-[40%]">{r.hint}</span>}
                  {canStar && (
                    <button type="button" title={isFav(r.href) ? 'Махни от Любими' : 'Добави в Любими'}
                      onClick={e => { e.stopPropagation(); toggleFav({ href: r.href, label: r.label }) }}
                      className={cn('p-1 rounded-md hover:bg-white', isFav(r.href) ? 'text-amber-500' : 'text-slate-300 opacity-0 group-hover:opacity-100', i === sel && 'opacity-100')}>
                      <Star size={14} fill={isFav(r.href) ? 'currentColor' : 'none'} />
                    </button>
                  )}
                  {i === sel && <CornerDownLeft size={13} className="text-[#6b8db0]" />}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> избор</span>
          <span><Kbd>Enter</Kbd> отвори</span>
          <span><Kbd>Esc</Kbd> затвори</span>
          <span className="ml-auto hidden sm:inline"><Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> отвсякъде</span>
        </div>
      </div>
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex min-w-[18px] justify-center px-1 py-px rounded border border-slate-300 bg-white text-[10px] font-sans text-slate-600 shadow-[0_1px_0_rgba(15,34,64,0.12)]">{children}</kbd>
}
