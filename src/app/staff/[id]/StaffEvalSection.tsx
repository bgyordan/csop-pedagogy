import Link from 'next/link'
import { Award } from 'lucide-react'
import { KIND_SHORT, ATTEST_YEARS, addYears, dmy, isoOf, num, finalGrade, type Kind } from '@/lib/evaluation'

// Оценяване в профила на служителя: ДТВ, атестиране и други оценки, следващото атестиране.
export default async function StaffEvalSection({ supabase, staffId }: { supabase: any; staffId: string }) {
  const [{ data: rows, error }, { data: hist }] = await Promise.all([
    supabase.from('eval_participants')
      .select('id, final_total, result, grade, employer_grade, status, finalized_at, acked_at, employer_at, campaign:eval_campaigns(id, name, kind, created_at)')
      .eq('staff_id', staffId).not('final_total', 'is', null),
    supabase.from('eval_attest_history').select('attested_on, grade, result').eq('staff_id', staffId),
  ])
  if (error) return null   // таблиците още ги няма
  const list = ((rows || []) as any[]).sort((a, b) => (b.campaign?.created_at || '').localeCompare(a.campaign?.created_at || ''))
  const attest = [
    ...list.filter(r => r.campaign?.kind === 'attest' && r.grade).map(r => isoOf(r.employer_at || r.acked_at || r.finalized_at)),
    ...((hist || []) as any[]).map(h => h.attested_on as string),
  ].sort().reverse()[0]
  if (!list.length && !attest) return null
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-5">
      <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100">
        <Award size={15} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Оценяване</span>
        <span className="ml-auto text-xs text-slate-400">
          {attest ? `последно атестиране ${dmy(attest)} · следващо до ${dmy(addYears(attest, ATTEST_YEARS))}` : 'няма данни за атестиране'}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {list.map(r => (
          <Link key={r.id} href={`/evaluation/${r.campaign?.id}?p=${r.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
            <span className="w-24 text-[12px] text-slate-500">{KIND_SHORT[(r.campaign?.kind || 'dtv') as Kind]}</span>
            <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{r.campaign?.name}</span>
            <span className="text-sm font-medium tabular-nums text-slate-800">
              {r.campaign?.kind === 'attest' ? `${num(r.result)} · ${finalGrade(r) || ''}` : `${num(r.final_total)} т.`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
