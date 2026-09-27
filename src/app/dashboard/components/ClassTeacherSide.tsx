'use client'
import { useState, type ReactNode } from 'react'
import { Calendar, Bell, FolderOpen } from 'lucide-react'
import { formatDate } from '@/lib/utils'

// Дясната колона на класния: една карта с три таба вместо четири отделни кутии
export default function ClassTeacherSide({ deadlines, announcements, files }: {
  deadlines: { id: string; title: string; deadline_date: string }[]
  announcements: { id: string; title: string; body: string }[]
  files: ReactNode
}) {
  const [tab, setTab] = useState<'deadlines' | 'news' | 'files'>('deadlines')
  const btn = (id: typeof tab, icon: ReactNode, label: string, n?: number) => (
    <button type="button" onClick={() => setTab(id)}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition ${
        tab === id ? 'bg-white shadow-sm ring-1 ring-slate-200 text-[#0f2240]' : 'text-slate-500 hover:text-slate-700'
      }`}>
      {icon} {label}
      {!!n && <span className={`text-[10px] px-1.5 rounded-full ${tab === id ? 'bg-sky-50 text-sky-700' : 'bg-slate-200/70 text-slate-500'}`}>{n}</span>}
    </button>
  )

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <div className="flex gap-1 p-1.5 bg-slate-50/60 border-b border-slate-100">
        {btn('deadlines', <Calendar size={13} />, 'Срокове', deadlines.length)}
        {btn('news', <Bell size={13} />, 'Съобщения', announcements.length)}
        {btn('files', <FolderOpen size={13} />, 'Файлове')}
      </div>
      <div className="p-4">
        {tab === 'deadlines' && (
          !deadlines.length ? <p className="text-sm text-slate-400 font-light">Няма предстоящи срокове</p> : (
            <div className="space-y-2.5">
              {deadlines.map(d => (
                <div key={d.id} className="flex justify-between items-center gap-2">
                  <div className="text-sm text-slate-700 truncate" title={d.title}>{d.title}</div>
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">{formatDate(d.deadline_date)}</span>
                </div>
              ))}
            </div>
          )
        )}
        {tab === 'news' && (
          !announcements.length ? <p className="text-sm text-slate-400 font-light">Няма активни съобщения</p> : (
            <div className="space-y-3.5">
              {announcements.map(a => (
                <div key={a.id} className="relative pl-3 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-indigo-300 before:rounded-full">
                  <div className="text-sm font-medium text-slate-700">{a.title}</div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-3">{a.body}</p>
                </div>
              ))}
            </div>
          )
        )}
        {tab === 'files' && <div className="space-y-5">{files}</div>}
      </div>
    </div>
  )
}
