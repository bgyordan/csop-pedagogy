import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'
import { getFullName } from '@/lib/utils'

// Кратки етикети за таблото (пълните са в StudentDocuments)
const DOC_LABELS: Record<string, string> = {
  telk: 'ТЕЛК / МЕ',
  rcpppo: 'Заповед РЦПППО',
  allergy: 'Алергии / хранене',
}

// studentIds подаден → само тези деца (класен); липсва → всички (админ/ЗДУД/директор).
// Показва изтекли + изтичащи до windowDays напред.
export default async function ExpiringDocsCard({
  studentIds,
  windowDays = 30,
}: {
  studentIds?: string[]
  windowDays?: number
}) {
  if (studentIds && studentIds.length === 0) return null

  const supabase = await createClient()
  const now = new Date()
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let q = supabase
    .from('student_documents')
    .select('doc_type, valid_until, student:students(id, first_name, middle_name, last_name, status)')
    .not('valid_until', 'is', null)
    .lte('valid_until', horizon)
    .order('valid_until', { ascending: true })
    .limit(40)
  if (studentIds) q = q.in('student_id', studentIds)
  const { data } = await q

  const rows = (data || [])
    .filter((r: any) => r.student && r.student.status === 'active')
    .map((r: any) => {
      const days = Math.ceil((new Date(r.valid_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        sid: r.student.id,
        name: getFullName(r.student),
        label: DOC_LABELS[r.doc_type] || r.doc_type,
        valid_until: r.valid_until,
        days,
      }
    })

  if (rows.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <CalendarClock size={15} className="text-slate-500" />
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Изтичащи документи</span>
        <span className="ml-auto text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{rows.length}</span>
      </div>
      <div className="p-2">
        {rows.map((r, i) => {
          const expired = r.days < 0
          const pillCls = expired
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
          const pillTxt = expired ? 'Изтекъл' : r.days === 0 ? 'Днес' : r.days === 1 ? 'Утре' : `${r.days} дни`
          return (
            <Link key={i} href={`/students/${r.sid}`}
              className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors">
              <div className="min-w-0 pr-3">
                <div className="text-xs font-medium text-slate-700 truncate">{r.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {r.label} · до {new Date(r.valid_until).toLocaleDateString('bg-BG')}
                </div>
              </div>
              <span className={`text-[10px] font-medium px-2 py-1 rounded border whitespace-nowrap ${pillCls}`}>{pillTxt}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
