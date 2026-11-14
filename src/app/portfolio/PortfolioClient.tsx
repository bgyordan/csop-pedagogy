'use client'

// „Кабинети и дейности“ — колегите показват накратко кабинета си и споделят проекти, събития и материали.
// Подредба на екрана:
//   1) раздели по съдържание (Всичко · Кабинети · Проекти · Събития · Материали · Файлове);
//   2) един ред филтри: „Всички колеги / Моите“, „Предстоящи“, „За сайта“ (деловодство и управа), колега, търсене;
//   3) във всеки раздел — ред „+ Нов …“ и подредба според смисъла (кабинетите по азбучен ред,
//      събитията — предстоящи/минали, проектите — по етап).
// Няма връзка с професионалното портфолио и атестирането (/pro-portfolio).

import { useEffect, useMemo, useRef, useState } from 'react'
import { smartMatch } from '@/lib/search'
import { useRouter } from 'next/navigation'
import { Plus, Search, LayoutGrid, Globe, Share2, FileDown, Loader2, Sparkles, X, CalendarClock, ArrowRight, ChevronDown, Check } from 'lucide-react'
import PostCard, { Avatar } from './PostCard'
import PostReader from './PostReader'
import PostEditor from './PostEditor'
import SharedFilesTab, { loadSharedFiles } from './SharedFilesTab'
import type { FileRow } from './SharedFilesTab'
import { KINDS, MANAGERS, isDraft, isDrive, trashVideos, keyDates, nextKeyDate, todayYmd, relDays, dateTone, kindMeta } from './lib'
import { createClient } from '@/lib/supabase/client'
import type { Post, Person, Cls, Kind, KeyDate } from './lib'
import { confirmDialog } from '@/components/ui/Toast'

type Section = 'all' | Kind | 'files'
type Scope = 'all' | 'mine'
type Group = { key: string; label: string; items: Post[] }

const plusDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const PER_PAGE = 24
const isKind = (s: Section): s is Kind => s !== 'all' && s !== 'files'
// Етапите на проектите — в реда, в който са интересни: текущите първи
const PROJECT_GROUPS: { key: string; label: string }[] = [
  { key: 'in_progress', label: 'В ход' }, { key: 'idea', label: 'Идеи' }, { key: 'done', label: 'Завършени' },
]

export default function PortfolioClient({ meId, role, posts, thumbs, people, classes, myClassIds, academicYearId, datesReady }: {
  meId: string; role: string; posts: Post[]; thumbs: Record<string, string>; people: Person[]
  classes: Cls[]; myClassIds: string[]; academicYearId: string | null
  /** Има ли таблица за датите (миграция 2026-11-03_portfolio_dates.sql) */
  datesReady: boolean
}) {
  const router = useRouter()
  const isManager = MANAGERS.includes(role)
  // „За сайта“ — опашката на деловодството и управата
  const siteDesk = isManager || role === 'secretary'

  const [section, setSection] = useState<Section>('all')
  const [scope, setScope] = useState<Scope>('all')
  const [siteOnly, setSiteOnly] = useState(false)
  const [upcoming, setUpcoming] = useState(false)
  const [author, setAuthor] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PER_PAGE)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ post: Post | null; kind?: Kind } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)
  const [toast, setToast] = useState('')
  const [exporting, setExporting] = useState(false)
  const [files, setFiles] = useState<FileRow[] | null>(null)
  const [filesErr, setFilesErr] = useState('')
  useEffect(() => { loadSharedFiles().then(r => { setFiles(r.rows); setFilesErr(r.err) }) }, [])

  // Адреси от таблото, календара и старите страници: ?kind=project · ?tab=files|mine|site · ?upcoming=1 · ?open=<id> · ?new=1
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const k = sp.get('kind') as Kind | null
    const hasKind = !!k && KINDS.some(x => x.key === k)
    if (hasKind) setSection(k as Kind)
    const t = sp.get('tab')
    if (t === 'files') setSection('files')
    if (t === 'mine') setScope('mine')
    if (t === 'site' && siteDesk) setSiteOnly(true)
    if (sp.get('upcoming')) setUpcoming(true)
    if (sp.get('open')) setOpenId(sp.get('open'))
    if (sp.get('new')) setEditor({ post: null, kind: hasKind ? (k as Kind) : undefined })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Менюто „Добави“ се затваря при клик встрани и с Esc
  useEffect(() => {
    if (!addOpen) return
    const onDown = (e: MouseEvent) => { if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAddOpen(false) }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [addOpen])

  const personBy = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])
  const classNames = useMemo(() => Object.fromEntries(classes.map(c => [c.id, c.name])), [classes])
  const me = personBy[meId]

  const mine = posts.filter(p => p.author_id === meId)
  // Общата стена: споделеното от всички + моите „само за мен“ (със знак на картата), за да не се „губят“ след запис
  const wall = posts.filter(p => !isDraft(p) || p.author_id === meId)
  const siteQueue = posts.filter(p => p.site_status === 'requested' && !isDraft(p))
  // Откъде се чете: чакащите за сайта → моите → всичко споделено
  const pool = siteOnly ? siteQueue : scope === 'mine' ? mine : wall

  const authors = useMemo(() => {
    const ids = new Set(wall.map(p => p.author_id).filter(Boolean) as string[])
    return people.filter(p => ids.has(p.id)).sort((a, b) => a.short.localeCompare(b.short, 'bg'))
  }, [wall, people])

  const today = todayYmd()
  const nextOf = useMemo(() => Object.fromEntries(posts.map(p => [p.id, nextKeyDate(p, today)])), [posts, today])
  const needle = q.trim().toLowerCase()
  const kind: Kind | null = isKind(section) ? section : null
  // броят е за текущия раздел — за да не води филтърът към празен списък
  const upcomingCount = pool.filter(p => (!kind || p.kind === kind) && nextOf[p.id]).length
  const byAuthor = scope === 'all' && !siteOnly ? author : ''
  const filtered = pool
    .filter(p => !kind || p.kind === kind)
    .filter(p => !byAuthor || p.author_id === byAuthor)
    .filter(p => !upcoming || nextOf[p.id])
    .filter(p => !needle || smartMatch([p.title, p.body, p.ideas, p.activities, p.goals, personBy[p.author_id || '']?.name, ...(p.dates || []).map(d => d.title)].join(' '), needle))

  // Подредба според раздела
  const byNext = (a: Post, b: Post) => nextOf[a.id]!.date.localeCompare(nextOf[b.id]!.date)
  const groups: Group[] = (() => {
    if (!filtered.length) return []
    // „Предстоящи“ — най-близките първи
    if (upcoming) return [{ key: 'up', label: '', items: [...filtered].sort(byNext) }]
    if (section === 'event') {
      const when = (p: Post) => p.event_date || p.created_at.slice(0, 10)
      return [
        { key: 'next', label: 'Предстоящи', items: filtered.filter(p => nextOf[p.id]).sort(byNext) },
        { key: 'past', label: 'Минали', items: filtered.filter(p => !nextOf[p.id]).sort((a, b) => when(b).localeCompare(when(a))) },
      ].filter(g => g.items.length)
    }
    if (section === 'project') {
      const known = new Set(PROJECT_GROUPS.map(g => g.key))
      return [
        ...PROJECT_GROUPS.map(g => ({ ...g, items: filtered.filter(p => p.status === g.key) })),
        { key: 'other', label: 'Без посочен етап', items: filtered.filter(p => !p.status || !known.has(p.status)) },
      ].filter(g => g.items.length)
    }
    // Кабинетите са „указател“, не новини — по азбучен ред
    if (section === 'cabinet') return [{ key: 'az', label: '', items: [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'bg')) }]
    return [{ key: 'new', label: '', items: filtered }]
  })()
  // „Покажи още“ важи общо за всички групи
  let room = limit
  const shownGroups = groups.map(g => { const items = g.items.slice(0, Math.max(0, room)); room -= items.length; return { ...g, total: g.items.length, items } }).filter(g => g.items.length)
  const total = filtered.length

  // Лентата „Предстоящи събития“ — следващите 60 дни (само в „Всичко“)
  const agenda: (KeyDate & { post: Post })[] = (section === 'all' && !siteOnly && !upcoming && !needle ? pool : [])
    .flatMap(p => keyDates(p).filter(d => d.highlight && d.date >= today && d.date <= plusDays(today, 60)).map(d => ({ ...d, post: p })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  const open = posts.find(p => p.id === openId) || null
  const canEdit = (p: Post) => p.author_id === meId || isManager || (p.kind === 'project' && p.classIds.some(c => myClassIds.includes(c)))
  const canDelete = (p: Post) => p.author_id === meId || isManager

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }
  function refresh(msg: string) { flash(msg); router.refresh() }
  function go(s: Section) { setSection(s); setLimit(PER_PAGE) }
  function startNew(k?: Kind) { setAddOpen(false); setEditor({ post: null, kind: k }) }
  const filtersOn = !!needle || !!byAuthor || upcoming || siteOnly
  function clearFilters() { setQ(''); setAuthor(''); setUpcoming(false); setSiteOnly(false) }

  // Изтриване направо от картата (с потвърждение) — заедно със снимките и файловете
  async function removePost(p: Post) {
    if (!await confirmDialog(`Да изтрия ли „${p.title}“ заедно със снимките?`)) return
    const supabase = createClient()
    const paths = p.media.flatMap(m => [m.path, m.thumb_path].filter(x => x && !isDrive(x)) as string[])
    if (paths.length) await supabase.storage.from('portfolio').remove(paths)
    await trashVideos(p.media.map(m => m.path))
    const { error } = await supabase.from('portfolio_posts').delete().eq('id', p.id)
    if (error) { flash(error.message); return }
    refresh('Публикацията е изтрита.')
  }

  // „Само за мен“ / „С колегите“ — като при файловете
  async function toggleShare(p: Post) {
    const share = isDraft(p)
    const patch: Record<string, unknown> = { is_shared: share }
    if (!share && p.site_status === 'requested') patch.site_status = 'none'
    const { error } = await createClient().from('portfolio_posts').update(patch).eq('id', p.id)
    if (error) { flash(error.message); return }
    refresh(share ? 'Споделено с колегите.' : 'Вече го виждаш само ти.')
  }

  async function exportWord() {
    setExporting(true)
    try {
      const { exportPortfolio } = await import('./exportDocx')
      await exportPortfolio({ name: me?.name || '', label: me?.label || '', posts: mine, thumbs, classNames })
    } finally { setExporting(false) }
  }

  const sections: { key: Section; label: string; icon: typeof LayoutGrid; tone: string; count: number | null }[] = [
    { key: 'all', label: 'Всичко', icon: LayoutGrid, tone: 'text-[#0f2240]', count: pool.length },
    ...KINDS.map(x => ({ key: x.key as Section, label: x.plural, icon: x.icon, tone: x.tone, count: pool.filter(p => p.kind === x.key).length })),
    { key: 'files', label: 'Файлове', icon: Share2, tone: 'text-[#0f2240]', count: files ? files.length : null },
  ]
  const km = kind ? kindMeta(kind) : null
  const myDrafts = mine.filter(isDraft).length
  // Ред „+ Нов …“ в раздела — когато се разглежда, а не се търси
  const showAddRow = !!km && !filtersOn
  const hasOwnCabinet = mine.some(p => p.kind === 'cabinet')
  // Покана с четирите вида — докато е още празно
  const showInvite = section === 'all' && !filtersOn && (scope === 'mine' ? mine.length === 0 : wall.length < 4)
  const chip = (on: boolean, tone: 'rose' | 'sky') => `inline-flex items-center gap-1.5 px-3 py-[7px] rounded-full text-[13px] whitespace-nowrap border transition-colors ${on
    ? (tone === 'rose' ? 'bg-rose-50 border-rose-400 text-rose-800 font-medium' : 'bg-sky-50 border-sky-400 text-sky-800 font-medium')
    : (tone === 'rose' ? 'bg-white border-slate-300 text-slate-700 hover:border-rose-300' : 'bg-white border-slate-300 text-slate-700 hover:border-sky-300')}`

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Заглавие + „Добави“ */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Кабинети и дейности</h1>
          <p className="text-sm text-slate-600 mt-1">Покажи кабинета си и сподели проект, събитие или материал — няколко снимки и няколко изречения стигат.</p>
        </div>
        <div ref={addRef} className="relative ml-auto">
          <button type="button" onClick={() => setAddOpen(o => !o)} aria-haspopup="menu" aria-expanded={addOpen}
            className="inline-flex items-center gap-2 pl-4 pr-3.5 py-2.5 rounded-xl bg-[#0f2240] text-white text-sm font-medium shadow-sm hover:bg-[#1a3560] hover:shadow-md transition-all">
            <Plus size={17} /> Добави <ChevronDown size={15} className={`opacity-80 transition-transform ${addOpen ? 'rotate-180' : ''}`} />
          </button>
          {addOpen && (
            <div role="menu" className="absolute right-0 top-full mt-2 z-30 w-[19rem] max-w-[calc(100vw-2rem)] p-1.5 rounded-2xl bg-white border border-slate-200 shadow-xl">
              <div className="px-3 pt-2 pb-1.5 text-[11px] uppercase tracking-widest text-slate-500">Какво споделяш?</div>
              {KINDS.map(x => {
                const I = x.icon
                return (
                  <button key={x.key} type="button" role="menuitem" onClick={() => startNew(x.key)}
                    className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <span className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${x.soft}`}><I size={18} /></span>
                    <span className="min-w-0">
                      <span className="block text-[14px] text-slate-900">{x.label}</span>
                      <span className="block text-[12px] text-slate-600 leading-snug">{x.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Раздели по съдържание */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto mb-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-slate-100">
          {sections.map(s => {
            const on = section === s.key; const I = s.icon
            return (
              <button key={s.key} type="button" onClick={() => go(s.key)} aria-pressed={on}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${on ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900'}`}>
                <I size={15} className={on ? s.tone : 'text-slate-500'} /> {s.label}
                {s.count !== null && <span className={`text-[11px] min-w-5 px-1.5 py-0.5 rounded-full text-center tabular-nums ${on ? 'bg-slate-100 text-slate-700' : 'bg-white/70 text-slate-500'}`}>{s.count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {section === 'files' && <SharedFilesTab canShare rows={files} err={filesErr} />}

      {section !== 'files' && (<>
      {/* Филтри: чии · предстоящи · за сайта · колега · търсене */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div role="group" aria-label="Чии публикации" className="inline-flex p-0.5 rounded-full bg-slate-100 text-[13px]">
          {([['all', 'Всички колеги', null], ['mine', 'Моите', mine.length]] as const).map(([k, l, n]) => {
            const on = scope === k && !siteOnly
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => { setScope(k); setSiteOnly(false); setLimit(PER_PAGE) }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-full whitespace-nowrap transition-all ${on ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900'}`}>
                {l}{n !== null && <span className="text-[11px] text-slate-500 tabular-nums">{n}</span>}
              </button>
            )
          })}
        </div>
        {(upcomingCount > 0 || upcoming) && (
          <button type="button" aria-pressed={upcoming} onClick={() => { setUpcoming(u => !u); setLimit(PER_PAGE) }}
            title="Само публикациите с предстояща дата — най-близките първи" className={chip(upcoming, 'rose')}>
            {upcoming ? <Check size={14} /> : <CalendarClock size={14} className="text-rose-600" />} Предстоящи <span className="text-[11px] opacity-70 tabular-nums">{upcomingCount}</span>
          </button>
        )}
        {siteDesk && (
          <button type="button" aria-pressed={siteOnly} onClick={() => { setSiteOnly(v => !v); setLimit(PER_PAGE) }}
            title="Публикациите, които колегите са предложили за сайта на ЦСОП" className={chip(siteOnly, 'sky')}>
            {siteOnly ? <Check size={14} /> : <Globe size={14} className="text-sky-600" />} Чакат за сайта
            <span className={`text-[11px] min-w-5 px-1.5 py-0.5 rounded-full text-center tabular-nums ${siteQueue.length ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{siteQueue.length}</span>
          </button>
        )}
        <div className="sm:ml-auto flex flex-wrap items-center gap-2">
          {scope === 'all' && !siteOnly && authors.length > 1 && (
            <select value={author} onChange={e => { setAuthor(e.target.value); setLimit(PER_PAGE) }} aria-label="Колега"
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700 focus:outline-none focus:border-[#0f2240]">
              <option value="">Всички колеги</option>
              {authors.map(a => <option key={a.id} value={a.id}>{a.short}</option>)}
            </select>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => { setQ(e.target.value); setLimit(PER_PAGE) }} placeholder="Търси…" aria-label="Търсене"
              className="pl-8 pr-7 py-2 w-48 rounded-xl border border-slate-300 bg-white text-[13px] focus:outline-none focus:border-[#0f2240] focus:w-60 transition-all" />
            {q && <button type="button" onClick={() => setQ('')} title="Изчисти" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X size={13} /></button>}
          </div>
        </div>
      </div>

      {/* „Моите“ — кратка лента: колко са споделени, колко виждам само аз */}
      {scope === 'mine' && !siteOnly && me && mine.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 mb-5 flex flex-wrap items-center gap-3">
          <Avatar name={me.name} size={36} />
          <div className="min-w-0">
            <div className="text-[14.5px] text-slate-900 truncate">{me.name}</div>
            <div className="text-[12.5px] text-slate-600">
              {mine.length - myDrafts} споделени с колегите{myDrafts > 0 && <> · <span className="text-slate-900">{myDrafts} само за теб</span> — сподели ги от плъзгача под картата</>}
            </div>
          </div>
          <button type="button" onClick={exportWord} disabled={exporting} title="Word документ с всички твои публикации"
            className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700 hover:border-[#0f2240] hover:text-[#0f2240] disabled:opacity-50 transition-colors">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Изтегли в Word
          </button>
        </div>
      )}

      {/* Предстоящи събития от проектите, кабинетите и т.н. */}
      {agenda.length > 0 && (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <CalendarClock size={18} className="text-rose-600" />
            <span className="font-medium text-slate-900">Предстоящи събития</span>
            <span className="text-[12px] text-slate-600">следващите 60 дни · {agenda.length}</span>
            <a href="/calendar?view=agenda" className="ml-auto inline-flex items-center gap-1 text-[13px] text-rose-700 hover:underline">
              В календара <ArrowRight size={14} />
            </a>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {agenda.slice(0, 12).map(d => {
              const t = dateTone(d.date, today); const k = kindMeta(d.post.kind); const I = k.icon
              const dt = new Date(d.date + 'T00:00')
              return (
                <button key={d.id} type="button" onClick={() => setOpenId(d.post.id)}
                  className="snap-start shrink-0 w-64 text-left flex gap-3 p-3 rounded-2xl bg-white border border-slate-200 hover:border-rose-300 hover:shadow-md transition-all">
                  <div className={`shrink-0 w-12 h-14 rounded-xl flex flex-col items-center justify-center leading-none ${t.tile}`}>
                    <span className="text-[18px] font-semibold">{dt.getDate()}</span>
                    <span className="text-[10px] uppercase mt-1">{dt.toLocaleDateString('bg-BG', { month: 'short' }).replace('.', '')}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium text-slate-900 leading-snug line-clamp-2">{d.title}</div>
                    {!d.main && <div className={`mt-0.5 flex items-center gap-1 text-[11.5px] truncate ${k.tone}`}><I size={11} className="shrink-0" /><span className="truncate">{d.post.title}</span></div>}
                    <div className="mt-0.5 text-[11.5px] text-slate-600 truncate">{relDays(d.date, today)}{d.time ? ` · ${d.time}` : ''}{d.place ? ` · ${d.place}` : ''}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Покана — докато е още празно: четирите вида, с по едно изречение */}
      {showInvite && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-5 md:p-7 mb-6">
          <div className="flex items-center gap-2 text-slate-900 font-medium"><Sparkles size={18} className="text-amber-500" /> {scope === 'mine' ? 'Още нямаш публикации' : 'Сподели с колегите'}</div>
          <p className="text-sm text-slate-600 mt-1 mb-4">Избери с какво да започнеш — после можеш да допълваш и да добавяш снимки.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {KINDS.map(x => {
              const I = x.icon
              return (
                <button key={x.key} type="button" onClick={() => startNew(x.key)}
                  className="text-left rounded-2xl p-4 bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-400 transition-all">
                  <span className={`inline-flex w-10 h-10 rounded-xl border items-center justify-center ${x.soft}`}><I size={20} /></span>
                  <div className="mt-2.5 text-sm font-medium text-slate-900">{x.label}</div>
                  <div className="text-[12px] text-slate-600 leading-snug mt-0.5">{x.hint}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Ред „+ Нов …“ за избрания раздел */}
      {showAddRow && km && (
        <button type="button" onClick={() => startNew(km.key)}
          className="group w-full text-left flex items-center gap-3 px-4 py-3 mb-5 rounded-2xl border border-dashed border-slate-300 bg-white hover:border-[#0f2240] hover:shadow-sm transition-all">
          <span className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${km.soft}`}><km.icon size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] text-slate-900">{km.key === 'cabinet' && !hasOwnCabinet ? 'Представи своя кабинет' : km.add}</span>
            <span className="block text-[12.5px] text-slate-600 leading-snug">{km.hint}</span>
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 text-[13px] text-[#0f2240] opacity-70 group-hover:opacity-100"><Plus size={16} /> <span className="hidden sm:inline">Добави</span></span>
        </button>
      )}

      {/* Публикациите */}
      {total === 0 ? (
        !showInvite && (
          <div className="text-center py-14 text-sm text-slate-600">
            {siteOnly && !needle ? 'Няма публикации, които чакат за сайта.'
              : filtersOn ? 'Нищо не отговаря на филтъра.'
              : scope === 'mine' ? `Още нямаш ${km ? km.plural.toLowerCase() : 'публикации'}.`
              : `Още няма ${km ? km.plural.toLowerCase() : 'публикации'}.`}
            {filtersOn && (
              <div className="mt-3">
                <button type="button" onClick={clearFilters} className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700 hover:border-[#0f2240]">Изчисти филтрите</button>
              </div>
            )}
          </div>
        )
      ) : shownGroups.map(g => (
        <section key={g.key} className="mb-8 last:mb-0">
          {g.label && (
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[12px] uppercase tracking-widest text-slate-700">{g.label}</h2>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">{g.total}</span>
              <span className="flex-1 h-px bg-slate-200" />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
            {g.items.map(p => (
              <PostCard key={p.id} post={p} author={personBy[p.author_id || '']} thumbs={thumbs} classNames={classNames} onOpen={() => setOpenId(p.id)}
                onToggleShare={scope === 'mine' && !siteOnly && p.author_id === meId ? () => toggleShare(p) : undefined}
                onDelete={canDelete(p) ? () => removePost(p) : undefined} />
            ))}
          </div>
        </section>
      ))}
      {total > limit && (
        <div className="text-center mt-8">
          <button type="button" onClick={() => setLimit(l => l + PER_PAGE)} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 hover:border-[#0f2240]">
            Покажи още ({total - limit})
          </button>
        </div>
      )}
      </>)}

      {open && !editor && (
        <PostReader post={open} author={personBy[open.author_id || '']} thumbs={thumbs} classNames={classNames}
          canEdit={canEdit(open)} canDelete={canDelete(open)} siteDesk={siteDesk} meId={meId}
          onClose={() => setOpenId(null)}
          onEdit={() => setEditor({ post: open })}
          onDeleted={() => { setOpenId(null); refresh('Публикацията е изтрита.') }}
          onChanged={msg => refresh(msg)} />
      )}

      {editor && (
        <PostEditor post={editor.post} presetKind={editor.kind} meId={meId} academicYearId={academicYearId} datesReady={datesReady}
          classes={classes} myClassIds={myClassIds} thumbs={thumbs}
          onClose={() => setEditor(null)}
          onSaved={(id, msg) => { setEditor(null); setOpenId(id); refresh(msg) }} />
      )}

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm shadow-lg">{toast}</div>}
    </div>
  )
}
