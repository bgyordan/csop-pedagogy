import Link from 'next/link'
import { ClipboardCheck, MessageSquareWarning, Clock, CheckCircle2 } from 'lucide-react'
import { KIND_LABEL, FORM_LABEL, REC_STATUS_LABEL, REC_STATUS_TONE, recOverdue, dmy, type CheckKind, type CheckForm, type RecStatus } from '@/lib/control'

// Контролна дейност в профила на служителя: протоколите, в които е проверен, и препоръките към него.
// Показва само това, което гледащият има право да види (директорът — всичко, заместникът — своите проверки).
export default async function StaffControlSection({ supabase, staffId }: { supabase: any; staffId: string }) {
  const [{ data: rows, error }, { data: recs }] = await Promise.all([
    supabase.from('control_check_staff')
      .select('acked_at, objection, check:control_checks!inner(id, book_no, check_date, signed_at, subject, status, kind, form, inspector:staff_profiles(first_name, last_name))')
      .eq('staff_id', staffId).neq('check.status', 'draft'),
    supabase.from('control_recommendations')
      .select('id, text, due_date, status, check:control_checks!control_recommendations_check_id_fkey!inner(id, book_no, status)')
      .eq('responsible_id', staffId).eq('check.status', 'signed'),
  ])
  if (error) return null   // таблиците още ги няма
  const list = ((rows || []) as any[]).sort((a, b) => (b.check.check_date || '').localeCompare(a.check.check_date || ''))
  const recList = (recs || []) as any[]
  if (!list.length && !recList.length) return null
  const active = recList.filter(r => r.status !== 'done')
  const done = recList.length - active.length

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-5">
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
        <ClipboardCheck size={15} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Контролна дейност</span>
        <span className="ml-auto text-xs text-slate-400">
          {list.length} {list.length === 1 ? 'протокол' : 'протокола'} · препоръки: {done} изпълнени{active.length ? `, ${active.length} неприключени` : ''}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {list.map((r: any) => (
          <Link key={r.check.id} href={`/control/${r.check.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
            <span className="w-20 text-[12.5px] text-slate-500 tabular-nums">{dmy(r.check.check_date)}</span>
            <span className="flex-1 min-w-0">
              <span className={`block text-sm truncate ${r.check.status === 'voided' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{r.check.subject}</span>
              <span className="block text-[12px] text-slate-400">
                № {r.check.book_no} · {KIND_LABEL[r.check.kind as CheckKind]}, {FORM_LABEL[r.check.form as CheckForm].toLowerCase()} · {r.check.inspector ? `${r.check.inspector.first_name} ${r.check.inspector.last_name}` : ''}
              </span>
            </span>
            {r.objection && <span title="Има възражение" className="text-amber-600"><MessageSquareWarning size={14} /></span>}
            {r.check.status === 'signed' && (r.acked_at
              ? <span title="Запознат/а" className="text-emerald-600"><CheckCircle2 size={14} /></span>
              : <span title="Не е запознат/а" className="text-amber-500"><Clock size={14} /></span>)}
          </Link>
        ))}
      </div>
      {active.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3 space-y-1.5">
          <div className="text-[12px] uppercase tracking-wide text-slate-400">Неприключени препоръки</div>
          {active.map((r: any) => {
            const late = recOverdue(r)
            return (
              <Link key={r.id} href={`/control/${r.check.id}`} className="flex items-start gap-2 text-sm hover:underline">
                <span className="flex-1 text-slate-700">{r.text}</span>
                <span className={`text-[11.5px] px-2 py-0.5 rounded-full shrink-0 ${late ? 'bg-rose-100 text-rose-700' : REC_STATUS_TONE[r.status as RecStatus]}`}>
                  {late ? `срок ${dmy(r.due_date)}` : REC_STATUS_LABEL[r.status as RecStatus]}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
