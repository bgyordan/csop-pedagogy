'use client'
import { useState } from 'react'
import { Loader2, FileDown, UserX, CalendarClock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getDeclarationData } from './actions'
import { generateSubstitutionDeclaration, generateSubstitutionInternalDecl } from '@/lib/docx-substitution'
import type { MySubRow } from './page'

function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '—' }

export default function MySubstitutionsClient({ rows }: { rows: MySubRow[] }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function download(id: string) {
    setBusy(id)
    const res: any = await getDeclarationData(id)
    if (res.error) { toast(res.error, 'error'); setBusy(null); return }
    const d = res.data
    if (!d.rows || d.rows.length === 0) { toast('Няма часове за декларация (липсва разписание на отсъстващия)', 'error'); setBusy(null); return }
    try {
      if (res.isBsch) {
        await generateSubstitutionDeclaration({
          substituteName: d.substituteName, substitutePosition: d.substitutePosition,
          absentName: d.absentName, orderRef: d.orderRef,
          periodFrom: d.periodFrom, periodTo: d.periodTo, yearName: d.yearName,
          rows: d.rows.map((r: any) => ({ date: r.date, cls: r.cls, hours: r.hours })),
          totalHours: d.totalHours,
        })
      } else {
        await generateSubstitutionInternalDecl({
          substituteName: d.substituteName, subjectLabel: '', education: '',
          monthName: d.monthName, orderRef: d.orderRef, absentName: d.absentName, yearName: d.yearName,
          rows: d.rows, totalHours: d.totalHours,
        })
      }
      toast('Декларацията е изтеглена')
    } catch (e) { toast('Грешка при генериране', 'error') }
    setBusy(null)
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center">
        <CalendarClock size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">Нямате замествания.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map((r, idx) => (
        <div key={r.id}
          className={`bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_4px_rgba(15,34,64,0.06)] ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-500 shrink-0">
            <UserX size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-slate-800">Замествам: <span className="font-medium">{r.absentName}</span></div>
            <div className="text-xs text-slate-500 mt-0.5">
              {fmt(r.dateFrom)} – {fmt(r.dateTo)}
              {r.bsch && <span className="ml-2 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">НП</span>}
            </div>
          </div>
          <button onClick={() => download(r.id)} disabled={busy === r.id}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0" style={{ backgroundColor: '#0f2240' }}>
            {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Декларация
          </button>
        </div>
      ))}
    </div>
  )
}
