'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { TherapistsMatrix } from './TherapistsMatrix'

interface Staff { id: string; first_name: string; last_name: string; middle_name?: string; position?: string }

interface Props {
  classes: any[]
  enrollments: any[]
  psychologists: Staff[]
  speechTherapists: Staff[]
  rehabilitators: Staff[]
}

// Обвивка: мениджърите превключват Списък / Разпределение; координаторът вижда само списъка
export function TherapistsView(props: Props & { isManager: boolean }) {
  const { isManager, ...rest } = props
  const [view, setView] = useState<'list' | 'matrix'>(isManager ? 'matrix' : 'list')

  if (!isManager) return <TherapistsList {...rest} />

  return (
    <div>
      <div className="inline-flex p-1 mb-5 bg-slate-100 rounded-xl">
        {([['list', 'Списък'], ['matrix', 'Разпределение']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-all ${view === k ? 'bg-white shadow-sm text-[#0f2240]' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {view === 'list' ? <TherapistsList {...rest} /> : <TherapistsMatrix {...rest} />}
    </div>
  )
}

export function TherapistsList({ classes, enrollments, psychologists, speechTherapists, rehabilitators }: Props) {
  const [q, setQ] = useState('')

  const nameOf = useMemo(() => {
    const m: Record<string, string> = {}
    ;[...psychologists, ...speechTherapists, ...rehabilitators].forEach(s => { m[s.id] = `${s.first_name} ${s.last_name}` })
    return m
  }, [psychologists, speechTherapists, rehabilitators])

  const rows = useMemo(() => enrollments
    .filter(e => e.student && e.student.status !== 'archived')
    .map(e => {
      const s = e.student
      return {
        id: s.id as string,
        classId: e.class_id as string,
        name: `${s.first_name} ${s.last_name}`,
        psy: s.therapist_psychologist_id ? nameOf[s.therapist_psychologist_id] || '' : '',
        slt: s.therapist_speech_id ? nameOf[s.therapist_speech_id] || '' : '',
        rehab: s.therapist_rehab_id ? nameOf[s.therapist_rehab_id] || '' : '',
      }
    }), [enrollments, nameOf])

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase()
    const match = (r: typeof rows[number]) => !t || [r.name, r.psy, r.slt, r.rehab].some(x => x.toLowerCase().includes(t))
    return classes
      .map(c => ({ c, rows: rows.filter(r => r.classId === c.id && match(r)).sort((a, b) => a.name.localeCompare(b.name, 'bg')) }))
      .filter(g => g.rows.length > 0)
  }, [classes, rows, q])

  const shown = groups.reduce((n, g) => n + g.rows.length, 0)
  const cols = 'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-center'
  const cell = (v: string) => v
    ? <span className="text-sm text-slate-700 truncate">{v}</span>
    : <span className="text-sm text-slate-300">—</span>

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси дете или терапевт…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
        </div>
        <span className="text-sm text-slate-500">{shown} деца</span>
      </div>

      <div className="space-y-4">
        {groups.map(({ c, rows }) => (
          <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-shadow hover:shadow-md">
            <div className={`${cols} px-4 py-2.5 border-b border-slate-100 bg-slate-50/60`}>
              <span className="text-sm font-medium text-[#0f2240]">{c.name} <span className="font-normal text-slate-400">· {rows.length}</span></span>
              <span className="text-xs text-slate-500">Психолог</span>
              <span className="text-xs text-slate-500">Логопед</span>
              <span className="text-xs text-slate-500">Рехабилитатор</span>
            </div>
            {rows.map((r, i) => (
              <div key={r.id} className={`${cols} px-4 py-2 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                <span className="text-sm text-slate-800 truncate">{r.name}</span>
                {cell(r.psy)}
                {cell(r.slt)}
                {cell(r.rehab)}
              </div>
            ))}
          </div>
        ))}
        {groups.length === 0 && <div className="text-sm text-slate-400 px-1">Няма съвпадения</div>}
      </div>
    </div>
  )
}
