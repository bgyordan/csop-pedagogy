'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Newspaper, CalendarDays, Images, ImagePlus, LayoutTemplate, Briefcase, LayoutDashboard, Users, Settings2 } from 'lucide-react'
import { ACCENT, SITE_URL } from './shared'
import type { Doc, News, Ev, Album, Photo, Job, Subscriber } from './shared'
import Overview, { type Go, type AuditRow } from './Overview'
import SettingsManager from './SettingsManager'
import type { SiteInfo } from './siteinfo'
import NewsManager from './NewsManager'
import DocumentsManager from './DocumentsManager'
import TeamManager, { type StaffRow, type TeamSetting } from './TeamManager'
import { EventsManager, JobsManager } from './legacy'
import GalleryManager from './GalleryManager'
import HomeManager from './HomeManager'
import PagePhotosManager from './PagePhotosManager'

const TABS = [
  { id: 'overview', label: 'Табло', icon: LayoutDashboard },
  { id: 'news', label: 'Новини', icon: Newspaper },
  { id: 'docs', label: 'Документи', icon: FileText },
  { id: 'events', label: 'Събития', icon: CalendarDays },
  { id: 'gallery', label: 'Галерия', icon: Images },
  { id: 'hero', label: 'Начална', icon: LayoutTemplate },
  { id: 'site-images', label: 'Снимки', icon: ImagePlus },
  { id: 'team', label: 'Екип', icon: Users },
  { id: 'jobs', label: 'Кариери', icon: Briefcase },
  { id: 'settings', label: 'Настройки', icon: Settings2 },
] as const
type TabId = (typeof TABS)[number]['id']

/* ═══════════════ обвивка ═══════════════ */
export default function SiteDocsClient({
  docs = [], defaultYear, news = [], authorId, events = [], albums = [], photos = [], heroPhotos = [], pagePhotos = {}, jobs = [], subscribers = [], staff = [], team = [], teamReady = false, info, infoReady = false, audit = [],
}: {
  docs: Doc[]; defaultYear: string; news?: News[]; authorId: string | null
  events?: Ev[]; albums?: Album[]; photos?: Photo[]; heroPhotos?: string[]; pagePhotos?: Record<string, string[]>
  jobs?: Job[]; subscribers?: Subscriber[]; staff?: StaffRow[]; team?: TeamSetting[]; teamReady?: boolean
  info: SiteInfo; infoReady?: boolean; audit?: AuditRow[]
}) {
  const [tab, setTab] = useState<TabId>('overview')
  // „скок“ от таблото: коя новина да се отвори / нова новина / кой раздел документи
  const [jump, setJump] = useState<{ newsId?: string; newNews?: number; section?: string; page?: string; n: number }>({ n: 0 })

  // разделът се помни в адреса (#news), за да оцелее при презареждане
  useEffect(() => {
    const h = window.location.hash.slice(1)
    if (TABS.some((t) => t.id === h)) setTab(h as TabId)
  }, [])
  const show = useCallback((t: TabId) => {
    setTab(t)
    window.history.replaceState(null, '', t === 'overview' ? window.location.pathname : `#${t}`)
    window.scrollTo({ top: 0 })
  }, [])

  const go = useCallback((g: Go) => {
    setJump((p) => ({
      n: p.n + 1,
      newsId: g.tab === 'news' ? g.openId : undefined,
      newNews: g.tab === 'news' && g.createNew ? Date.now() : undefined,
      section: g.tab === 'docs' ? g.section : undefined,
      page: g.tab === 'site-images' ? g.page : undefined,
    }))
    show(g.tab)
  }, [show])

  const drafts = news.filter((n) => n.status !== 'published').length

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[26px] md:text-[30px] font-semibold tracking-tight" style={{ color: ACCENT }}>Сайт</h1>
          <p className="text-slate-500 text-sm mt-1">Всичко, което се вижда на csop-varna.bg — от едно място.</p>
        </div>
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[12.5px] text-slate-500 bg-white border border-slate-200 rounded-full px-3.5 py-2 hover:text-slate-700 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" /> csop-varna.bg
        </a>
      </div>

      {/* раздели */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-6 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none]">
        {TABS.map((t) => {
          const Icon = t.icon; const on = tab === t.id
          return (
            <button key={t.id} onClick={() => { setJump((p) => ({ n: p.n + 1 })); show(t.id) }}
              className={`relative shrink-0 flex items-center gap-1.5 px-3 h-11 text-[13.5px] font-medium rounded-t-lg transition-colors ${on ? '' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              style={on ? { color: ACCENT } : {}}>
              <Icon size={15} className="shrink-0" /> <span className="whitespace-nowrap">{t.label}</span>
              {t.id === 'news' && drafts > 0 && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-700 text-[11px] leading-[18px] text-center">{drafts}</span>}
              {on && <span className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded" style={{ backgroundColor: ACCENT }} />}
            </button>
          )
        })}
      </div>

      {tab === 'overview' && (
        <Overview news={news} docs={docs} events={events} albums={albums} photos={photos}
          heroPhotos={heroPhotos} pagePhotos={pagePhotos} jobs={jobs} audit={audit} go={go} />
      )}
      {tab === 'news' && <NewsManager key={jump.n} initial={news} authorId={authorId} openId={jump.newsId} openNewSignal={jump.newNews} />}
      {tab === 'docs' && <DocumentsManager key={jump.n} initial={docs} defaultYear={defaultYear} startSection={jump.section} />}
      {tab === 'events' && <EventsManager initial={events} />}
      {tab === 'gallery' && <GalleryManager initialAlbums={albums} initialPhotos={photos} />}
      {tab === 'hero' && <HomeManager photos={photos} albums={albums} initialSelected={heroPhotos} />}
      {tab === 'site-images' && <PagePhotosManager key={jump.n} albums={albums} photos={photos} initialPages={pagePhotos} startPage={jump.page} />}
      {tab === 'team' && <TeamManager staff={staff} initial={team} ready={teamReady} />}
      {tab === 'settings' && <SettingsManager initial={info} ready={infoReady} />}
      {tab === 'jobs' && <JobsManager initial={jobs} authorId={authorId} subscribers={subscribers} />}
    </div>
  )
}
