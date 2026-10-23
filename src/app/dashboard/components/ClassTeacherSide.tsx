'use client'
import { useState, type ReactNode } from 'react'
import { Bell } from 'lucide-react'

// Дясната колона на таблото: отделни кратки карти — Съобщения (+ файловете, ако са подадени).
// Сроковете са в картата „Моята седмица“ (календара) най-горе на таблото.
// Празна карта е само един ред. За управата — една до друга в ред: layout="row".

export const FRESH_DAYS = 7
export const isFreshFile = (iso?: string | null) => !!iso && Date.now() - new Date(iso).getTime() < FRESH_DAYS * 864e5


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

type Ann = { id: string; title: string; body: string; created_at?: string }
const manage = (href: string) => <a href={href} className="text-[11px] text-slate-400 hover:text-[#0f2240]">управление →</a>

// Съобщения: заглавие + 1 ред, клик разгръща; зелена точка — новите (3 дни)
export function NewsCard({ announcements, newsHref }: { announcements: Ann[]; newsHref?: string }) {
  const [openNews, setOpenNews] = useState<string | null>(null)
  const newsFresh = (a: { created_at?: string }) => !!a.created_at && Date.now() - new Date(a.created_at).getTime() < 3 * 864e5
  return (
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
  )
}


export default function ClassTeacherSide({ announcements, files, newsHref, layout = 'stack' }: {
  announcements: Ann[]
  files?: ReactNode
  newsHref?: string
  layout?: 'stack' | 'row'
}) {
  return (
    <div className={layout === 'row' ? 'grid grid-cols-1 md:grid-cols-2 gap-4 items-start' : 'space-y-4'}>
      <NewsCard announcements={announcements} newsHref={newsHref} />
      {/* файловете (споделено, учебни планове) — всеки списък е своя карта */}
      {files}
    </div>
  )
}
