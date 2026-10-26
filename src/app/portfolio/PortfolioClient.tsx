'use client'

import { useEffect, useMemo, useState } from 'react'
import { smartMatch } from '@/lib/search'
import { useRouter } from 'next/navigation'
import { Plus, Search, LayoutGrid, UserRound, Globe, Share2, FileDown, Loader2, Sparkles, X, CalendarClock, ArrowRight } from 'lucide-react'
import PostCard, { Avatar } from './PostCard'
import PostReader from './PostReader'
import PostEditor from './PostEditor'
import SharedFilesTab, { loadSharedFiles } from './SharedFilesTab'
import type { FileRow } from './SharedFilesTab'
import { KINDS, MANAGERS, isImage, isDraft, isDrive, trashVideos, keyDates, nextKeyDate, todayYmd, relDays, dateTone, kindMeta } from './lib'
import { createClient } from '@/lib/supabase/client'
import type { Post, Person, Cls, Kind, KeyDate } from './lib'
import { confirmDialog } from '@/components/ui/Toast'

type Tab = 'wall' | 'mine' | 'files' | 'site'
const plusDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const PER_PAGE = 24

export default function PortfolioClient({ meId, role, posts, thumbs, people, classes, myClassIds, academicYearId, datesReady }: {
  meId: string; role: string; posts: Post[]; thumbs: Record<string, string>; people: Person[]
  classes: Cls[]; myClassIds: string[]; academicYearId: string | null
  /** Има ли таблица за датите (миграция 2026-11-03_portfolio_dates.sql) */
  datesReady: boolean
}) {
  const router = useRouter()
  const isManager = MANAGERS.includes(role)
  const siteDesk = isManager || role === 'secretary'
  const canPost = role !== 'secretary'

  const [tab, setTab] = useState<Tab>(canPost ? 'wall' : 'site')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [upcoming, setUpcoming] = useState(false)
  const [author, setAuthor] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PER_PAGE)
  const [openId, setOpenId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ post: Post | null; kind?: Kind } | null>(null)
  const [toast, setToast] = useState('')
  const [exporting, setExporting] = useState(false)
  const [files, setFiles] = useState<FileRow[] | null>(null)
  const [filesErr, setFilesErr] = useState('')
  useEffect(() => { loadSharedFiles().then(r => { setFiles(r.rows); setFilesErr(r.err) }) }, [])

  // ?kind=project · ?tab=site · ?open=<id> · ?new=1
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const k = sp.get('kind') as Kind | null
    if (k && KINDS.some(x => x.key === k)) setKind(k)
    const t = sp.get('tab') as Tab | null
    if (t === 'mine' || t === 'files' || (t === 'site' && siteDesk) || t === 'wall') setTab(t)
    if (sp.get('upcoming')) setUpcoming(true)
    if (sp.get('open')) setOpenId(sp.get('open'))
    if (sp.get('new') && canPost) setEditor({ post: null, kind: k || undefined })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const personBy = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])
  const classNames = useMemo(() => Object.fromEntries(classes.map(c => [c.id, c.name])), [classes])
  const me = personBy[meId]

  const mine = posts.filter(p => p.author_id === meId)
  const wall = posts.filter(p => !isDraft(p))
  const siteQueue = posts.filter(p => p.site_status === 'requested' && !isDraft(p))
  const base = tab === 'mine' ? mine : tab === 'site' ? siteQueue : wall

  const countBy = (k: Kind) => base.filter(p => p.kind === k).length
  const authors = useMemo(() => {
    const ids = new Set(wall.map(p => p.author_id).filter(Boolean) as string[])
    return people.filter(p => ids.has(p.id)).sort((a, b) => a.short.localeCompare(b.short, 'bg'))
  }, [wall, people])

  const today = todayYmd()
  const nextOf = useMemo(() => Object.fromEntries(posts.map(p => [p.id, nextKeyDate(p, today)])), [posts, today])
  const upcomingCount = base.filter(p => nextOf[p.id]).length

  const needle = q.trim().toLowerCase()
  const filtered = base
    .filter(p => kind === 'all' || p.kind === kind)
    .filter(p => tab !== 'wall' || !author || p.author_id === author)
    .filter(p => !upcoming || nextOf[p.id])
    .filter(p => !needle || smartMatch([p.title, p.body, p.ideas, p.activities, p.goals, personBy[p.author_id || '']?.name, ...(p.dates || []).map(d => d.title)].join(' '), needle))
  // „Предстоящи“ — подредени по най-близката дата
  const shown = upcoming ? [...filtered].sort((a, b) => nextOf[a.id]!.date.localeCompare(nextOf[b.id]!.date)) : filtered

  // Лентата „Предстоящи събития“ — следващите 60 дни от публикациите в текущия изглед
  const agenda: (KeyDate & { post: Post })[] = (tab === 'site' ? [] : base)
    .flatMap(p => keyDates(p).filter(d => d.highlight && d.date >= today && d.date <= plusDays(today, 60)).map(d => ({ ...d, post: p })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  const open = posts.find(p => p.id === openId) || null
  const canEdit = (p: Post) => p.author_id === meId || isManager || (p.kind === 'project' && p.classIds.some(c => myClassIds.includes(c)))
  const canDelete = (p: Post) => p.author_id === meId || isManager

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }
  function refresh(msg: string) { flash(msg); router.refresh() }

  // „Сподели“ / „Само за мен“ — като при файловете
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

  const tabs: { key: Tab; label: string; icon: typeof LayoutGrid; count: number | null; show: boolean }[] = [
    { key: 'wall', label: 'Портфолио на ЦСОП', icon: LayoutGrid, count: wall.length, show: true },
    { key: 'mine', label: 'Моето портфолио', icon: UserRound, count: mine.length, show: canPost },
    { key: 'files', label: 'Споделени файлове', icon: Share2, count: files ? files.length : null, show: true },
    { key: 'site', label: 'За сайта', icon: Globe, count: siteQueue.length, show: siteDesk },
  ]

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Заглавие */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Портфолио</h1>
          <p className="text-sm text-slate-500 mt-1">Кабинети, проекти, събития, материали и споделени файлове на колегите</p>
        </div>
        {canPost && (
          <button type="button" onClick={() => setEditor({ post: null, kind: kind === 'all' ? undefined : kind })}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f2240] text-white text-sm font-medium shadow-sm hover:bg-[#1a3560] hover:shadow-md transition-all">
            <Plus size={17} /> Нова публикация
          </button>
        )}
      </div>

      {/* Табове */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-slate-100 w-fit mb-5">
        {tabs.filter(t => t.show).map(t => {
          const on = tab === t.key; const I = t.icon
          return (
            <button key={t.key} type="button" onClick={() => { setTab(t.key); setLimit(PER_PAGE) }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${on ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900'}`}>
              <I size={15} /> {t.label}
              {t.count !== null && <span className={`text-[11px] min-w-5 px-1.5 py-0.5 rounded-full ${on ? (t.key === 'site' && t.count ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600') : 'bg-white/70 text-slate-500'}`}>{t.count}</span>}
            </button>
          )
        })}
      </div>

      {/* Моето портфолио — горна карта */}
      {tab === 'mine' && me && (
        <div className="rounded-3xl bg-gradient-to-br from-[#0f2240] to-[#24497a] text-white p-6 md:p-7 mb-6 flex flex-wrap items-center gap-5">
          <Avatar name={me.name} size={56} light />
          <div className="min-w-0">
            <div className="text-xl font-semibold">{me.name}</div>
            <div className="text-sm text-white/70">{me.label}</div>
          </div>
          <div className="flex flex-wrap gap-2 md:ml-6">
            {KINDS.map(x => (
              <div key={x.key} className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/10">
                <div className="text-lg font-semibold leading-none">{mine.filter(p => p.kind === x.key).length}</div>
                <div className="text-[11px] text-white/70 mt-1">{x.plural}</div>
              </div>
            ))}
            <div className="px-3.5 py-2 rounded-2xl bg-white/10 border border-white/10">
              <div className="text-lg font-semibold leading-none">{mine.reduce((s, p) => s + p.media.filter(isImage).length, 0)}</div>
              <div className="text-[11px] text-white/70 mt-1">Снимки</div>
            </div>
          </div>
          <a href="/pro-portfolio" className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20"
            title="Професионалното портфолио по Наредба № 15 — материали, квалификация, цели, доказателства за атестирането">
            Професионално портфолио →
          </a>
          <button type="button" onClick={exportWord} disabled={!mine.length || exporting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#0f2240] text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
            title="Word документ с всички мои публикации — за атестацията">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Изтегли за атестация
          </button>
        </div>
      )}


      {tab === 'files' && <SharedFilesTab canShare={canPost} rows={files} err={filesErr} />}

      {tab !== 'files' && (<>
      {/* Предстоящи събития от проектите, кабинетите и т.н. */}
      {agenda.length > 0 && !needle && (
        <div className="mb-6 rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <CalendarClock size={18} className="text-rose-600" />
            <span className="font-semibold text-slate-900">Предстоящи събития</span>
            <span className="text-[12px] text-slate-500">следващите 60 дни · {agenda.length}</span>
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
                    <span className="text-[18px] font-bold">{dt.getDate()}</span>
                    <span className="text-[10px] uppercase mt-1">{dt.toLocaleDateString('bg-BG', { month: 'short' }).replace('.', '')}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-slate-900 leading-snug line-clamp-2">{d.title}</div>
                    {!d.main && <div className={`mt-0.5 flex items-center gap-1 text-[11.5px] truncate ${k.tone}`}><I size={11} className="shrink-0" /><span className="truncate">{d.post.title}</span></div>}
                    <div className="mt-0.5 text-[11.5px] text-slate-500 truncate">{relDays(d.date, today)}{d.time ? ` · ${d.time}` : ''}{d.place ? ` · ${d.place}` : ''}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Филтри */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button type="button" onClick={() => setKind('all')}
          className={`px-3.5 py-2 rounded-full text-[13px] border transition-colors ${kind === 'all' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'}`}>
          Всички <span className="opacity-60">{base.length}</span>
        </button>
        {KINDS.map(x => {
          const on = kind === x.key; const I = x.icon
          return (
            <button key={x.key} type="button" onClick={() => setKind(on ? 'all' : x.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] border transition-colors ${on ? `bg-gradient-to-r ${x.grad} border-transparent text-white shadow-sm` : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'}`}>
              <I size={14} className={on ? 'text-white' : x.tone} /> {x.plural} <span className="opacity-60">{countBy(x.key)}</span>
            </button>
          )
        })}
        {upcomingCount > 0 && (
          <button type="button" onClick={() => setUpcoming(u => !u)} title="Само публикациите с предстояща дата — най-близките първи"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] border transition-colors ${upcoming ? 'bg-rose-600 border-rose-600 text-white shadow-sm' : 'bg-white border-rose-200 text-rose-700 hover:border-rose-400'}`}>
            <CalendarClock size={14} /> Предстоящи <span className="opacity-70">{upcomingCount}</span>
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {tab === 'wall' && authors.length > 1 && (
            <select value={author} onChange={e => setAuthor(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700 focus:outline-none focus:border-[#0f2240]">
              <option value="">Всички колеги</option>
              {authors.map(a => <option key={a.id} value={a.id}>{a.short}</option>)}
            </select>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси…"
              className="pl-8 pr-7 py-2 w-48 rounded-xl border border-slate-300 bg-white text-[13px] focus:outline-none focus:border-[#0f2240] focus:w-60 transition-all" />
            {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
          </div>
        </div>
      </div>

      {/* Покана за публикуване */}
      {canPost && tab !== 'site' && (tab === 'mine' ? mine.length === 0 : wall.length < 4) && !needle && (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-6 md:p-8 mb-6">
          <div className="flex items-center gap-2 text-slate-900 font-semibold"><Sparkles size={18} className="text-amber-500" /> {tab === 'mine' ? 'Твоето портфолио още е празно' : 'Сподели с колегите'}</div>
          <p className="text-sm text-slate-500 mt-1 mb-4">Няколко снимки и няколко изречения стигат. Избери с какво да започнеш:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {KINDS.map(x => {
              const I = x.icon
              return (
                <button key={x.key} type="button" onClick={() => setEditor({ post: null, kind: x.key })}
                  className={`text-left rounded-2xl p-4 bg-gradient-to-br ${x.grad} text-white hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
                  <I size={22} />
                  <div className="mt-2 font-semibold text-sm">{x.label}</div>
                  <div className="text-[11.5px] text-white/85 leading-snug mt-0.5">{x.hint}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Стена */}
      {shown.length === 0 ? (
        (tab === 'site' || needle || kind !== 'all' || author || upcoming) && (
          <div className="text-center py-16 text-slate-500 text-sm">
            {tab === 'site' && !needle ? 'Няма публикации, които чакат за сайта.' : 'Нищо не отговаря на филтъра.'}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
          {shown.slice(0, limit).map(p => (
            <PostCard key={p.id} post={p} author={personBy[p.author_id || '']} thumbs={thumbs} classNames={classNames} onOpen={() => setOpenId(p.id)}
              onToggleShare={tab === 'mine' && p.author_id === meId ? () => toggleShare(p) : undefined}
              onDelete={canDelete(p) ? () => removePost(p) : undefined} />
          ))}
        </div>
      )}
      {shown.length > limit && (
        <div className="text-center mt-8">
          <button type="button" onClick={() => setLimit(l => l + PER_PAGE)} className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 hover:border-[#0f2240]">
            Покажи още ({shown.length - limit})
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
