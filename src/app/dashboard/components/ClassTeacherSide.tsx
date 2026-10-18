'use client'
import { useState, type ReactNode } from 'react'
import { Calendar, Bell } from 'lucide-react'
import { formatDate } from '@/lib/utils'

// Дясната колона на таблото: отделни кратки карти — Съобщения · Срокове (+ файловете, ако са подадени).
// Празна карта е само един ред. За управата — една до друга в ред: layout="row".

export const FRESH_DAYS = 7
export const isFreshFile = (iso?: string | null) => !!iso && Date.now() - new Date(iso).getTime() < FRESH_DAYS * 864e5

function daysLeft(d: string) {
  const t = new Date(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' }) + 'T00:00:00')
  return Math.round((new Date(d + 'T00:00:00').getTime() - t.getTime()) / 864e5)
}
const leftLabel = (n: number) => n <= 0 ? 'днес' : n === 1 ? 'утре' : `след ${n} дни`

// Обща карта за дясната колона и файловете: заглавие + съдържание; празната е само един ред
export function SideCard({ icon, title, right, empty, children }: { icon: ReactNode; title: string; right?: ReactNode; empty?: string; children?: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm h-fit">
      <div className={`flex items-center gap-2 px-4 py-2.5 ${empty ? '' : 'border-b border-slate-100'}`}>
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-[11px] text-[#0f2240] uppercase tracking-widest">{title}</h2>
        {empty && <span className="text-[12px] text-slate-400 font-light">· {empty}</span>}
        <span className="flex-1" />
        {right}
      </div>
      {!empty && <div className="px-3 py-2">{children}</div>}
    </div>
  )
}

export default function ClassTeacherSide({ deadlines, announcements, files, deadlinesHref, newsHref, layout = 'stack' }: {
  deadlines: { id: string; title: string; deadline_date: string }[]
  announcements: { id: string; title: string; body: string; created_at?: string }[]
  files?: ReactNode
  deadlinesHref?: string   // „управление →“ (за управата)
  newsHref?: string
  layout?: 'stack' | 'row'
}) {
  const [openNews, setOpenNews] = useState<string | null>(null)
  const newsFresh = (a: { created_at?: string }) => !!a.created_at && Date.now() - new Date(a.created_at).getTime() < 3 * 864e5
  const manage = (href: string) => <a href={href} className="text-[11px] text-slate-400 hover:text-[#0f2240]">управление →</a>

  return (
    <div className={layout === 'row' ? 'grid grid-cols-1 md:grid-cols-3 gap-4 items-start' : 'space-y-4'}>
      <SideCard icon={<Bell size={14} />} title="Съобщения" right={newsHref ? manage(newsHref) : undefined} empty={announcements.length ? undefined : 'няма активни'}>
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
      </SideCard>

      <SideCard icon={<Calendar size={14} />} title="Срокове" right={deadlinesHref ? manage(deadlinesHref) : undefined} empty={deadlines.length ? undefined : 'няма предстоящи'}>
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
      </SideCard>

      {/* файловете (споделено, учебни планове) — всеки списък е своя карта */}
      {files}
    </div>
  )
}
