'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Calendar, Bell, FolderOpen } from 'lucide-react'
import { formatDate } from '@/lib/utils'

// Дясната колона на таблото: една карта с три таба — Срокове · Съобщения · Файлове.
// Числото на „Файлове“ показва само новите (последните 7 дни) — за да се забележат.

// Списъците във „Файлове“ съобщават колко нови имат (ключ → брой)
const NewFilesCtx = createContext<((key: string, n: number) => void) | null>(null)
export function useReportNewFiles(key: string, n: number) {
  const report = useContext(NewFilesCtx)
  useEffect(() => { report?.(key, n) }, [report, key, n])
}
export const FRESH_DAYS = 7
export const isFreshFile = (iso?: string | null) => !!iso && Date.now() - new Date(iso).getTime() < FRESH_DAYS * 864e5

function daysLeft(d: string) {
  const t = new Date(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' }) + 'T00:00:00')
  return Math.round((new Date(d + 'T00:00:00').getTime() - t.getTime()) / 864e5)
}
const leftLabel = (n: number) => n <= 0 ? 'днес' : n === 1 ? 'утре' : `след ${n} дни`

export default function ClassTeacherSide({ deadlines, announcements, files, deadlinesHref, newsHref }: {
  deadlines: { id: string; title: string; deadline_date: string }[]
  announcements: { id: string; title: string; body: string; created_at?: string }[]
  files: ReactNode
  deadlinesHref?: string   // „Управление →“ (за управата)
  newsHref?: string
}) {
  const [tab, setTab] = useState<'deadlines' | 'news' | 'files'>('deadlines')
  const [openNews, setOpenNews] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Record<string, number>>({})
  const report = useCallback((key: string, n: number) => setFresh(f => (f[key] === n ? f : { ...f, [key]: n })), [])
  const newFiles = Object.values(fresh).reduce((s, n) => s + n, 0)
  const newsFresh = (a: { created_at?: string }) => !!a.created_at && Date.now() - new Date(a.created_at).getTime() < 3 * 864e5

  const btn = (id: typeof tab, icon: ReactNode, label: string, n?: number, tone: 'plain' | 'new' = 'plain') => (
    <button type="button" onClick={() => setTab(id)}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition ${
        tab === id ? 'bg-white shadow-sm ring-1 ring-slate-200 text-[#0f2240]' : 'text-slate-500 hover:text-slate-700'
      }`}>
      {icon} {label}
      {!!n && <span className={`text-[10px] px-1.5 rounded-full ${tone === 'new' ? 'bg-emerald-50 text-emerald-700' : tab === id ? 'bg-sky-50 text-sky-700' : 'bg-slate-200/70 text-slate-500'}`}>{tone === 'new' ? `${n} нови` : n}</span>}
    </button>
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <div className="flex gap-1 p-1.5 bg-slate-50/60 border-b border-slate-100">
        {btn('deadlines', <Calendar size={13} />, 'Срокове', deadlines.length)}
        {btn('news', <Bell size={13} />, 'Съобщения', announcements.length)}
        {btn('files', <FolderOpen size={13} />, 'Файлове', newFiles, 'new')}
      </div>
      <div className="p-3">
        {tab === 'deadlines' && (
          !deadlines.length ? <p className="px-1 py-1 text-sm text-slate-400 font-light">Няма предстоящи срокове</p> : (
            <div>
              {deadlines.map(d => {
                const n = daysLeft(d.deadline_date)
                return (
                  <div key={d.id} className="flex items-center gap-2 px-1 py-1.5">
                    <div className="flex-1 min-w-0 text-[13px] text-slate-700 truncate" title={`${d.title} — ${formatDate(d.deadline_date)}`}>{d.title}</div>
                    <span title={formatDate(d.deadline_date)}
                      className={`text-[11px] flex-shrink-0 tabular-nums ${n <= 3 ? 'text-amber-700' : 'text-slate-400'}`}>{leftLabel(n)}</span>
                  </div>
                )
              })}
            </div>
          )
        )}
        {tab === 'news' && (
          !announcements.length ? <p className="px-1 py-1 text-sm text-slate-400 font-light">Няма активни съобщения</p> : (
            <div>
              {announcements.map(a => {
                const open = openNews === a.id
                return (
                  <button key={a.id} type="button" onClick={() => setOpenNews(open ? null : a.id)}
                    className="w-full text-left px-1 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-1.5">
                      {newsFresh(a) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="ново" />}
                      <span className="text-[13px] text-slate-800 truncate">{a.title}</span>
                    </div>
                    <p className={`text-xs text-slate-500 mt-0.5 whitespace-pre-line ${open ? '' : 'line-clamp-1'}`}>{a.body}</p>
                  </button>
                )
              })}
            </div>
          )
        )}
        {/* файловете се зареждат веднага (заради броя на новите), а се показват при таба */}
        <NewFilesCtx.Provider value={report}>
          <div className={tab === 'files' ? 'space-y-3' : 'hidden'}>{files}</div>
        </NewFilesCtx.Provider>
        {tab === 'deadlines' && deadlinesHref && (
          <a href={deadlinesHref} className="mt-2 px-1 inline-block text-[11px] text-slate-400 hover:text-[#0f2240]">График срокове — управление →</a>
        )}
        {tab === 'news' && newsHref && (
          <a href={newsHref} className="mt-2 px-1 inline-block text-[11px] text-slate-400 hover:text-[#0f2240]">Съобщения — управление →</a>
        )}
      </div>
    </div>
  )
}
