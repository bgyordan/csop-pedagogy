'use client'

import { useMemo } from 'react'
import {
  Newspaper, FileText, CalendarDays, Images, Briefcase, Plus, Upload, ExternalLink, AlertCircle, CheckCircle2,
  ImagePlus, LayoutTemplate, EyeOff, PenLine, CalendarClock, ChevronRight, Clock,
} from 'lucide-react'
import { ACCENT, SITE_URL, SECTIONS, SITE_PAGES, MONTHS_SHORT, fmtDate } from './shared'
import type { Doc, News, Ev, Album, Photo, Job } from './shared'

export type Go =
  | { tab: 'news'; openId?: string; createNew?: boolean }
  | { tab: 'docs'; section?: string }
  | { tab: 'events' | 'gallery' | 'hero' | 'jobs' | 'site-images' | 'team' }

const isScheduled = (n: News) => n.status === 'published' && !!n.published_at && new Date(n.published_at) > new Date()
const isLive = (n: News) => n.status === 'published' && !isScheduled(n)

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 0) return 'предстои'
  if (s < 3600) return `преди ${Math.max(1, Math.round(s / 60))} мин`
  if (s < 86400) return `преди ${Math.round(s / 3600)} ч`
  const d = Math.round(s / 86400)
  return d === 1 ? 'вчера' : d < 30 ? `преди ${d} дни` : fmtDate(iso)
}

/* ═══════════════ ТАБЛО ═══════════════ */
export default function Overview({
  news, docs, events, albums, photos, heroPhotos, pagePhotos, jobs, go,
}: {
  news: News[]; docs: Doc[]; events: Ev[]; albums: Album[]; photos: Photo[]; heroPhotos: string[]
  pagePhotos: Record<string, string[]>; jobs: Job[]; go: (g: Go) => void
}) {
  const today = new Date().toISOString().slice(0, 10)

  const s = useMemo(() => {
    const live = news.filter(isLive), sched = news.filter(isScheduled), drafts = news.filter((n) => n.status !== 'published')
    const siteDocs = docs.filter((d) => d.section !== 'eis')
    const upcoming = events.filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date))
    const lastLive = live.map((n) => n.published_at || n.created_at).sort().pop() || null
    return {
      live, sched, drafts, upcoming, lastLive,
      docsOn: siteDocs.filter((d) => d.on_site).length,
      docsOff: siteDocs.filter((d) => !d.on_site),
      noCover: live.filter((n) => !n.cover_url && !(n.gallery_images || []).length),
      emptyPages: SITE_PAGES.filter((p) => !(pagePhotos[p.key] || []).length),
      activeJobs: jobs.filter((j) => j.status === 'active').length,
    }
  }, [news, docs, events, jobs, pagePhotos, today])

  // какво чака внимание — всеки ред води директно към мястото за оправяне
  const todo: { key: string; icon: React.ElementType; text: string; hint?: string; tone: 'amber' | 'sky' | 'slate'; action: () => void }[] = []
  s.drafts.slice(0, 4).forEach((n) => todo.push({ key: 'd' + n.id, icon: PenLine, tone: 'amber', text: `Чернова: „${n.title || 'без заглавие'}“`, hint: 'Не се вижда на сайта', action: () => go({ tab: 'news', openId: n.id }) }))
  if (s.drafts.length > 4) todo.push({ key: 'dmore', icon: PenLine, tone: 'amber', text: `Още ${s.drafts.length - 4} чернови`, action: () => go({ tab: 'news' }) })
  s.noCover.slice(0, 3).forEach((n) => todo.push({ key: 'c' + n.id, icon: ImagePlus, tone: 'sky', text: `Новина без снимка: „${n.title}“`, hint: 'На сайта ще излезе само с текст', action: () => go({ tab: 'news', openId: n.id }) }))
  if (heroPhotos.length < 3) todo.push({ key: 'hero', icon: LayoutTemplate, tone: 'sky', text: heroPhotos.length ? `Началната страница има ${heroPhotos.length} от 3 снимки` : 'Началната страница няма избрани снимки', action: () => go({ tab: 'hero' }) })
  if (s.emptyPages.length) todo.push({ key: 'pages', icon: Images, tone: 'slate', text: s.emptyPages.length === 1 ? '1 страница е без снимки' : `${s.emptyPages.length} страници са без снимки`, hint: s.emptyPages.slice(0, 4).map((p) => p.label.replace(/^Материална база: /, '')).join(', ') + (s.emptyPages.length > 4 ? '…' : ''), action: () => go({ tab: 'site-images' }) })
  const hiddenBySection = SECTIONS.filter((x) => !x.internalOnly).map((x) => ({ x, n: s.docsOff.filter((d) => d.section === x.id).length })).filter((r) => r.n)
  hiddenBySection.forEach(({ x, n }) => todo.push({ key: 'h' + x.id, icon: EyeOff, tone: 'slate', text: `${n} ${n === 1 ? 'скрит документ' : 'скрити документа'} в „${x.label}“`, hint: 'Качени са, но не се показват', action: () => go({ tab: 'docs', section: x.id }) }))
  if (!s.upcoming.length) todo.push({ key: 'ev', icon: CalendarDays, tone: 'slate', text: 'Няма предстоящи събития в календара', action: () => go({ tab: 'events' }) })

  // последни промени
  const recent = useMemo(() => {
    const r: { key: string; when: string; icon: React.ElementType; text: string; sub: string; action: () => void }[] = []
    news.forEach((n) => r.push({ key: 'n' + n.id, when: (isLive(n) && n.published_at) || n.created_at, icon: Newspaper, text: n.title || 'Без заглавие', sub: isLive(n) ? 'Публикувана новина' : isScheduled(n) ? `Насрочена за ${fmtDate(n.published_at)}` : 'Чернова', action: () => go({ tab: 'news', openId: n.id }) }))
    docs.forEach((d) => d.created_at && r.push({ key: 'f' + d.id, when: d.created_at, icon: FileText, text: d.name, sub: `Документ · ${SECTIONS.find((x) => x.id === d.section)?.label || ''}`, action: () => go({ tab: 'docs', section: d.section }) }))
    return r.filter((x) => x.when && x.when <= new Date().toISOString()).sort((a, b) => b.when.localeCompare(a.when)).slice(0, 8)
  }, [news, docs, go])

  const stats = [
    { icon: Newspaper, label: 'Новини на сайта', value: s.live.length, sub: s.lastLive ? `последна ${ago(s.lastLive)}` : 'още няма', action: () => go({ tab: 'news' }) },
    { icon: FileText, label: 'Документи на сайта', value: s.docsOn, sub: s.docsOff.length ? `${s.docsOff.length} скрити` : 'всички се виждат', action: () => go({ tab: 'docs' }) },
    { icon: CalendarDays, label: 'Предстоящи събития', value: s.upcoming.length, sub: s.upcoming[0] ? `следващо ${fmtDate(s.upcoming[0].event_date)}` : 'няма насрочени', action: () => go({ tab: 'events' }) },
    { icon: Images, label: 'Албуми', value: albums.length, sub: `${photos.length} снимки`, action: () => go({ tab: 'gallery' }) },
    { icon: Briefcase, label: 'Обяви за работа', value: s.activeJobs, sub: s.activeJobs ? 'активни' : 'няма активни', action: () => go({ tab: 'jobs' }) },
  ]

  const actions = [
    { icon: Plus, label: 'Нова новина', primary: true, action: () => go({ tab: 'news', createNew: true }) },
    { icon: Upload, label: 'Качи документ', action: () => go({ tab: 'docs' }) },
    { icon: CalendarDays, label: 'Добави събитие', action: () => go({ tab: 'events' }) },
    { icon: Images, label: 'Нов албум', action: () => go({ tab: 'gallery' }) },
  ]

  const TONE = { amber: 'bg-amber-50 text-amber-600', sky: 'bg-sky-50 text-sky-600', slate: 'bg-slate-100 text-slate-500' }

  return (
    <div className="space-y-6">
      {/* бързи действия */}
      <div className="flex flex-wrap gap-2.5">
        {actions.map((a) => (
          <button key={a.label} onClick={a.action}
            className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13.5px] font-medium transition ${a.primary ? 'text-white shadow-sm hover:opacity-90' : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow-sm'}`}
            style={a.primary ? { backgroundColor: ACCENT } : {}}>
            <a.icon size={16} /> {a.label}
          </button>
        ))}
        <a href={SITE_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13.5px] font-medium text-slate-600 hover:text-slate-800 sm:ml-auto">
          Отвори сайта <ExternalLink size={14} />
        </a>
      </div>

      {/* числа */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((c) => (
          <button key={c.label} onClick={c.action}
            className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-300 hover:shadow-sm transition group">
            <div className="flex items-center gap-2 text-slate-500 text-[12.5px]"><c.icon size={15} /> {c.label}</div>
            <div className="text-[28px] font-semibold mt-1 leading-none" style={{ color: ACCENT }}>{c.value}</div>
            <div className="text-[12px] text-slate-400 mt-1.5">{c.sub}</div>
          </button>
        ))}
      </div>

      {s.sched.length > 0 && (
        <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-sky-800">
          <span className="inline-flex items-center gap-1.5 font-medium"><CalendarClock size={15} /> Насрочени за публикуване:</span>
          {s.sched.sort((a, b) => (a.published_at || '').localeCompare(b.published_at || '')).map((n) => (
            <button key={n.id} onClick={() => go({ tab: 'news', openId: n.id })} className="hover:underline">
              „{n.title}“ · {new Date(n.published_at!).toLocaleString('bg-BG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-5">
        {/* внимание */}
        <section className="bg-white border border-slate-200 rounded-2xl min-w-0">
          <h2 className="px-5 pt-4 pb-3 text-[15px] font-semibold flex items-center gap-2" style={{ color: ACCENT }}>
            <AlertCircle size={17} /> Какво чака внимание
          </h2>
          {todo.length === 0 ? (
            <div className="px-5 pb-6 pt-2 flex items-center gap-2.5 text-[13.5px] text-emerald-700">
              <CheckCircle2 size={18} /> Всичко е наред — няма нищо недовършено.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todo.map((t) => (
                <li key={t.key}>
                  <button onClick={t.action} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 transition">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TONE[t.tone]}`}><t.icon size={16} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] text-slate-700 truncate">{t.text}</span>
                      {t.hint && <span className="block text-[12px] text-slate-400 truncate">{t.hint}</span>}
                    </span>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5 min-w-0">
          {/* предстоящи */}
          <section className="bg-white border border-slate-200 rounded-2xl">
            <h2 className="px-5 pt-4 pb-3 text-[15px] font-semibold flex items-center gap-2" style={{ color: ACCENT }}>
              <CalendarDays size={17} /> Предстоящи събития
            </h2>
            {s.upcoming.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-slate-400">Няма насрочени събития.</p>
            ) : (
              <ul className="px-5 pb-4 space-y-3">
                {s.upcoming.slice(0, 3).map((e) => {
                  const d = new Date(e.event_date + 'T00:00:00')
                  return (
                    <li key={e.id} className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center leading-none shrink-0">
                        <span className="text-[15px] font-semibold" style={{ color: ACCENT }}>{d.getDate()}</span>
                        <span className="text-[10.5px] text-slate-400 mt-0.5">{MONTHS_SHORT[d.getMonth()]}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] text-slate-700 truncate">{e.title}</span>
                        {(e.event_time || e.location) && <span className="block text-[12px] text-slate-400 truncate">{[e.event_time?.slice(0, 5), e.location].filter(Boolean).join(' · ')}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* последни промени */}
          <section className="bg-white border border-slate-200 rounded-2xl">
            <h2 className="px-5 pt-4 pb-3 text-[15px] font-semibold flex items-center gap-2" style={{ color: ACCENT }}>
              <Clock size={17} /> Последно добавено
            </h2>
            {recent.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-slate-400">Още няма нищо.</p>
            ) : (
              <ul className="pb-2">
                {recent.map((r) => (
                  <li key={r.key}>
                    <button onClick={r.action} className="w-full flex items-center gap-3 px-5 py-2 text-left hover:bg-slate-50 transition">
                      <r.icon size={15} className="text-slate-400 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-slate-700 truncate">{r.text}</span>
                        <span className="block text-[11.5px] text-slate-400 truncate">{r.sub}</span>
                      </span>
                      <span className="text-[11.5px] text-slate-400 shrink-0">{ago(r.when)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
