import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { DOC_TYPES, DOC_LABEL, todaySofia, daysTo, fmt } from '@/lib/student-docs'

// Компактна карта „Документи със срок“: броячи по вид (изтекли / изтичат до 30 дни) + най-спешните 3,
// а всичко останало — в справката „Документи на децата“ (филтри, групиране, печат).
// studentIds подаден → само тези деца (класен); липсва → всички (управа).
export default async function ExpiringDocsCard({ studentIds, windowDays = 30 }: { studentIds?: string[]; windowDays?: number }) {
  if (studentIds && studentIds.length === 0) return null
  const supabase = await createClient()
  const today = todaySofia()
  const horizon = new Date(Date.now() + windowDays * 86400000).toISOString().slice(0, 10)

  let q = supabase.from('student_documents')
    .select('doc_type, valid_until, student:students(id, first_name, middle_name, last_name, status)')
    .not('valid_until', 'is', null).lte('valid_until', horizon).order('valid_until', { ascending: true }).limit(500)
  if (studentIds) q = q.in('student_id', studentIds)
  const { data } = await q
  const rows = (data || []).filter((r: any) => r.student && r.student.status === 'active')
    .map((r: any) => ({ sid: r.student.id, name: getFullName(r.student), type: r.doc_type as string, until: r.valid_until as string, days: daysTo(r.valid_until, today) }))
  if (rows.length === 0) return null

  const count = (t: string, expired: boolean) => rows.filter(r => r.type === t && (expired ? r.days < 0 : r.days >= 0)).length
  const urgent = rows.slice(0, 3)
  const href = studentIds ? '/reports/documents?mine=1' : '/reports/documents'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <CalendarClock size={15} className="text-slate-500" />
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Документи със срок</span>
        <Link href={href} className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-[#0f2240] hover:underline">Справка <ArrowRight size={12} /></Link>
      </div>
      {/* броячи по вид — клик води към справката, филтрирана */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        {DOC_TYPES.map(t => {
          const ex = count(t.key, true), so = count(t.key, false)
          return (
            <Link key={t.key} href={`${href}${href.includes('?') ? '&' : '?'}doc=${t.key}&status=expired,soon`} className="px-3 py-2.5 hover:bg-slate-50">
              <div className="text-[11px] text-slate-500 truncate">{t.short}</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-lg font-semibold tabular-nums ${ex ? 'text-rose-700' : 'text-slate-300'}`} title="изтекли">{ex}</span>
                <span className={`text-[12px] tabular-nums ${so ? 'text-amber-700' : 'text-slate-300'}`} title={`изтичат до ${windowDays} дни`}>+{so}</span>
              </div>
            </Link>
          )
        })}
      </div>
      <div className="p-2">
        {urgent.map((r, i) => (
          <Link key={i} href={`/students/${r.sid}?tab=data`} className="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-slate-50 rounded-lg">
            <div className="min-w-0 pr-3">
              <div className="text-xs font-medium text-slate-700 truncate">{r.name}</div>
              <div className="text-[11px] text-slate-500">{DOC_LABEL[r.type] || r.type} · до {fmt(r.until)}</div>
            </div>
            <span className={`text-[10px] font-medium px-2 py-1 rounded border whitespace-nowrap ${r.days < 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {r.days < 0 ? 'Изтекъл' : r.days === 0 ? 'Днес' : r.days === 1 ? 'Утре' : `${r.days} дни`}
            </span>
          </Link>
        ))}
        {rows.length > 3 && <Link href={href} className="block px-3 py-1.5 text-[11.5px] text-slate-500 hover:text-[#0f2240]">и още {rows.length - 3} → в справката</Link>}
      </div>
    </div>
  )
}
