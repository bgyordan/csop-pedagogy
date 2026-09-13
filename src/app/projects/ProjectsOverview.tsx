'use client'
import { Lightbulb, Users } from 'lucide-react'

interface Cls { id: string; name: string }
interface Project {
  id: string; title: string; ideas: string | null; activities: string | null; goals: string | null
  period_from: string | null; period_to: string | null; status: string; classIds: string[]
}

const SCHOOL_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
const MONTH_SHORT: Record<number, string> = { 9: 'Сеп', 10: 'Окт', 11: 'Ное', 12: 'Дек', 1: 'Яну', 2: 'Фев', 3: 'Мар', 4: 'Апр', 5: 'Май', 6: 'Юни' }
const monthOfISO = (iso: string | null) => iso ? parseInt(iso.slice(5, 7)) : null
const idxOf = (m: number | null) => m === null ? -1 : SCHOOL_MONTHS.indexOf(m)

const STATUS: Record<string, { label: string; cls: string }> = {
  idea: { label: 'Идея', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_progress: { label: 'В ход', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  done: { label: 'Завършен', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}
// Мека палитра — всеки проект със свой цвят (зеленикаво-хладна гама)
const PALETTE = ['#5ea89f', '#6d9edb', '#7bbf7b', '#c0a35e', '#a98bd0', '#d29b6e', '#8bb0c9', '#cf8a8a', '#6bb9a8', '#b9a06b']

export default function ProjectsOverview({ classes, projects, yearName }: { classes: Cls[]; projects: Project[]; yearName: string }) {
  const nameById: Record<string, string> = {}
  classes.forEach(c => { nameById[c.id] = c.name })

  const total = projects.length
  const byStatus = (k: string) => projects.filter(p => p.status === k).length
  const withProject = new Set(projects.flatMap(p => p.classIds))
  const withoutProject = classes.filter(c => !withProject.has(c.id) && !/служебна/i.test(c.name))

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><Lightbulb size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Проекти на училището</h1>
          <p className="text-slate-500 text-sm mt-0.5">{yearName} · преглед на плановете по паралелки</p>
        </div>
      </div>

      {/* Обобщение */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[['Общо', total, 'text-slate-800'], ['В ход', byStatus('in_progress'), 'text-amber-600'], ['Завършени', byStatus('done'), 'text-emerald-600'], ['Идеи', byStatus('idea'), 'text-slate-500']].map(([l, n, c]) => (
          <div key={l as string} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <div className={`text-2xl font-semibold ${c}`}>{n as number}</div>
            <div className="text-xs text-slate-400 mt-0.5">{l as string}</div>
          </div>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Lightbulb size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Още няма въведени проекти</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-x-auto">
          {/* Месеци (хедър) */}
          <div className="grid min-w-[720px]" style={{ gridTemplateColumns: '240px 1fr' }}>
            <div />
            <div className="flex text-[10px] font-medium text-slate-400 mb-1">
              {SCHOOL_MONTHS.map(m => <div key={m} className="flex-1 text-center border-l border-slate-100">{MONTH_SHORT[m]}</div>)}
            </div>
          </div>

          {/* Редове проекти */}
          <div className="space-y-1.5 min-w-[720px]">
            {projects.map((p, i) => {
              const fromM = monthOfISO(p.period_from), toM = monthOfISO(p.period_to)
              let s = idxOf(fromM), e = idxOf(toM)
              if (s < 0 && e >= 0) s = e
              if (e < 0 && s >= 0) e = s
              const hasBar = s >= 0 && e >= 0
              const left = hasBar ? (s / 10) * 100 : 0
              const width = hasBar ? ((e - s + 1) / 10) * 100 : 0
              const color = PALETTE[i % PALETTE.length]
              const st = STATUS[p.status] || STATUS.idea
              const clsNames = p.classIds.map(id => nameById[id] || '?').join(', ')
              return (
                <div key={p.id} className="grid items-center" style={{ gridTemplateColumns: '240px 1fr' }}>
                  <div className="pr-3 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-800 truncate">{p.title}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate inline-flex items-center gap-1"><Users size={10} /> {clsNames}</div>
                  </div>
                  <div className="relative h-8">
                    <div className="absolute inset-0 flex">
                      {SCHOOL_MONTHS.map(m => <div key={m} className="flex-1 border-l border-slate-50" />)}
                    </div>
                    {hasBar ? (
                      <div className="absolute top-1 bottom-1 rounded-md flex items-center px-2 overflow-hidden shadow-sm"
                        style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
                        title={`${p.title} · ${clsNames}${p.ideas ? ' · ' + p.ideas : ''}`}>
                        <span className="text-[10px] text-white truncate">{clsNames}</span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] text-slate-300 italic">без период</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {withoutProject.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Паралелки без проект ({withoutProject.length})</div>
          <div className="flex flex-wrap gap-1.5">
            {withoutProject.map(c => <span key={c.id} className="text-xs px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-500">{c.name}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}
