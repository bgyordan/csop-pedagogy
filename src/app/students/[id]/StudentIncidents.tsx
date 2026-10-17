'use client'
// Случаите на детето от „Дневник на случаите“ — всички години, в досието.
// Вижда се само от тези, които базата пуска (съветът, ръководството, класният, колегата констатирал случая);
// за останалите картата изобщо не се показва.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldAlert, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KINDS, STATUS, LEVELS, ROLE_LABEL, fmtDate } from '@/lib/incidents'
import type { Case, Role } from '@/lib/incidents'

type Row = { role: Role; c: Case }

export default function StudentIncidents({ studentId }: { studentId: string }) {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.from('incident_participants')
        .select('role, c:incident_cases(*)').eq('student_id', studentId)
      if (!alive) return
      if (error) { setRows([]); return }
      setRows(((data || []) as any[]).filter(r => r.c).map(r => ({ role: r.role, c: r.c }))
        .sort((a, b) => b.c.occurred_on.localeCompare(a.c.occurred_on)))
    })()
    return () => { alive = false }
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows || !rows.length) return null
  const active = rows.filter(r => r.role !== 'witness')
  const open = rows.filter(r => r.c.status !== 'closed').length
  const roles = active.reduce<Record<string, number>>((m, r) => ({ ...m, [r.role]: (m[r.role] || 0) + 1 }), {})

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <ShieldAlert size={16} className="text-rose-600" />
        <h3 className="text-[14px] font-medium text-slate-800">Случаи</h3>
        <span className="text-[12px] text-slate-500">
          {rows.length} · {Object.entries(roles).map(([r, n]) => `${ROLE_LABEL[r as Role]} ${n}`).join(' · ')}{open ? ` · ${open} неприключени` : ''}
        </span>
        {active.length >= 3 && <span className="text-[11.5px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">за план за подкрепа / ЕПЛР</span>}
        <span className="flex-1" />
        <span className="text-[11px] text-slate-400">виждат съветът, ръководството и класният</span>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.slice(0, 12).map(({ role, c }) => {
          const lvl = LEVELS[c.kind].find(l => l.n === c.level)
          return (
            <Link key={c.id} href={`/incidents?open=${c.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
              <span className="w-20 text-[12.5px] text-slate-700 tabular-nums">{fmtDate(c.occurred_on)}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ background: KINDS[c.kind].bg, color: KINDS[c.kind].color }}>{KINDS[c.kind].short}{lvl ? ` · ${lvl.label}` : ''}</span>
              <span className="text-[12px] text-slate-500">{ROLE_LABEL[role]}</span>
              <span className="flex-1 min-w-[160px] text-[13px] text-slate-700 truncate">{c.description}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: STATUS[c.status].bg, color: STATUS[c.status].color }}>{STATUS[c.status].label}</span>
              <ChevronRight size={14} className="text-slate-300" />
            </Link>
          )
        })}
      </div>
      {rows.length > 12 && <Link href="/incidents" className="block px-4 py-2 text-[12px] text-slate-500 hover:text-slate-800 border-t border-slate-100">Всички случаи →</Link>}
    </section>
  )
}
