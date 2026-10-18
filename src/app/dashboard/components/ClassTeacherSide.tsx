'use client'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Calendar, Bell, FolderOpen } from 'lucide-react'
import { formatDate } from '@/lib/utils'

// Дясната колона на таблото: три отделни, кратки карти — Съобщения · Срокове · Файлове.
// (за управата — една до друга в ред: layout="row")

// Списъците във „Файлове“ съобщават колко нови имат (ключ → брой) — за „N нови“ в заглавието
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

function Card({ icon, title, right, children }: { icon: ReactNode; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-[11px] text-[#0f2240] uppercase tracking-widest flex-1">{title}</h2>
        {right}
      </div>
      <div className="px-3 py-2">{children}</div>
    </div>
  )
}

export default function ClassTeacherSide({ deadlines, announcements, files, deadlinesHref, newsHref, layout = 'stack' }: {
  deadlines: { id: string; title: string; deadline_date: string }[]
  announcements: { id: string; title: string; body: string; created_at?: string }[]
  files: ReactNode
  deadlinesHref?: string   // „управление →“ (за управата)
  newsHref?: string
  layout?: 'stack' | 'row'
}) {
  const [openNews, setOpenNews] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Record<string, number>>({})
  const report = useCallback((key: string, n: number) => setFresh(f => (f[key] === n ? f : { ...f, [key]: n })), [])
  const newFiles = Object.values(fresh).reduce((s, n) => s + n, 0)
  const newsFresh = (a: { created_at?: string }) => !!a.created_at && Date.now() - new Date(a.created_at).getTime() < 3 * 864e5
  const manage = (href: string) => <a href={href} className="text-[11px] text-slate-400 hover:text-[#0f2240]">управление →</a>

  return (
    <div className={layout === 'row' ? 'grid grid-cols-1 md:grid-cols-3 gap-4 items-start' : 'space-y-4'}>
      <Card icon={<Bell size={14} />} title="Съобщения" right={newsHref ? manage(newsHref) : undefined}>
        {!announcements.length ? <p className="px-1 py-1 text-[13px] text-slate-400 font-light">Няма активни съобщения</p> : (
          announcements.map(a => {
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
          })
        )}
      </Card>

      <Card icon={<Calendar size={14} />} title="Срокове" right={deadlinesHref ? manage(deadlinesHref) : undefined}>
        {!deadlines.length ? <p className="px-1 py-1 text-[13px] text-slate-400 font-light">Няма предстоящи срокове</p> : (
          deadlines.map(d => {
            const n = daysLeft(d.deadline_date)
            return (
              <div key={d.id} className="flex items-center gap-2 px-1 py-1.5">
                <div className="flex-1 min-w-0 text-[13px] text-slate-700 truncate" title={`${d.title} — ${formatDate(d.deadline_date)}`}>{d.title}</div>
                <span title={formatDate(d.deadline_date)}
                  className={`text-[11px] flex-shrink-0 tabular-nums ${n <= 3 ? 'text-amber-700' : 'text-slate-400'}`}>{leftLabel(n)}</span>
              </div>
            )
          })
        )}
      </Card>

      <Card icon={<FolderOpen size={14} />} title="Файлове"
        right={newFiles > 0 ? <span className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{newFiles} нови</span> : undefined}>
        <NewFilesCtx.Provider value={report}>
          <div className="space-y-3 py-1">{files}</div>
        </NewFilesCtx.Provider>
      </Card>
    </div>
  )
}
