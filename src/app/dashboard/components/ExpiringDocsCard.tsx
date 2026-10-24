import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { DOC_TYPES, todaySofia, daysTo, fmt } from '@/lib/student-docs'

// Карта „Документи със срок“ — сбит списък, по един ред на дете: цветна точка, име, паралелка
// и документите (до 2, останалите като +N). Най-спешните първи; останалото — в справката.
// studentIds подаден → само тези деца (класен); липсва → всички (управа).
const MAX = 10
const SHORT: Record<string, string> = Object.fromEntries(DOC_TYPES.map(d => [d.key, d.short]))

export default async function ExpiringDocsCard({ studentIds, windowDays = 30 }: { studentIds?: string[]; windowDays?: number }) {
  if (studentIds && studentIds.length === 0) return null
  const supabase = await createClient()
  const today = todaySofia()
  const horizon = new Date(Date.now() + windowDays * 86400000).toISOString().slice(0, 10)

  let q = supabase.from('student_documents')
    .select('doc_type, valid_until, student:students(id, first_name, last_name, status)')
    .not('valid_until', 'is', null).lte('valid_until', horizon).order('valid_until', { ascending: true }).limit(500)
  if (studentIds) q = q.in('student_id', studentIds)
  const { data } = await q
  const rows = (data || []).filter((r: any) => r.student && r.student.status === 'active')
  if (rows.length === 0) return null

  // групиране по дете
  type Kid = { id: string; first: string; last: string; cls: string; docs: { type: string; until: string; days: number }[]; worst: number }
  const kids = new Map<string, Kid>()
  for (const r of rows as any[]) {
    const k: Kid = kids.get(r.student.id) || { id: r.student.id, first: r.student.first_name || '', last: r.student.last_name || '', cls: '', docs: [], worst: Infinity }
    const days = daysTo(r.valid_until, today)
    k.docs.push({ type: r.doc_type, until: r.valid_until, days })
    k.worst = Math.min(k.worst, days)
    kids.set(k.id, k)
  }
  // паралелка от текущата година
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
  if (cy) {
    const { data: enr } = await supabase.from('student_enrollments').select('student_id, class:classes(name)')
      .eq('academic_year_id', cy.id).in('student_id', Array.from(kids.keys()))
    ;(enr || []).forEach((e: any) => { const k = kids.get(e.student_id); if (k && e.class?.name) k.cls = e.class.name })
  }

  const list = Array.from(kids.values()).sort((a, b) => a.worst - b.worst || a.last.localeCompare(b.last, 'bg'))
  const expired = rows.filter((r: any) => daysTo(r.valid_until, today) < 0).length
  const soon = rows.length - expired
  const shown = list.slice(0, MAX)
  const rest = list.length - shown.length
  const href = studentIds ? '/reports/documents?mine=1' : '/reports/documents'
  const statusHref = (s: string) => `${href}${href.includes('?') ? '&' : '?'}status=${s}`

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 border-b border-slate-100">
        <CalendarClock size={14} className="text-slate-400" />
        <span className="text-[13px] text-slate-700">Документи със срок</span>
        {expired > 0 && (
          <Link href={statusHref('expired')} className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 hover:text-[#0f2240]">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{expired} изтекли
          </Link>
        )}
        {soon > 0 && (
          <Link href={statusHref('soon')} className="inline-flex items-center gap-1.5 text-[12px] text-slate-600 hover:text-[#0f2240]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{soon} до {windowDays} дни
          </Link>
        )}
        <Link href={href} className="ml-auto inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-[#0f2240]">Справка <ArrowRight size={12} /></Link>
      </div>

      {/* по едно дете на ред: точка (червена — изтекъл, жълта — скоро), име, паралелка, документите */}
      <div className="grid md:grid-cols-2 md:divide-x divide-slate-100">
        {[shown.slice(0, Math.ceil(shown.length / 2)), shown.slice(Math.ceil(shown.length / 2))].map((col, ci) => (
          <div key={ci} className="divide-y divide-slate-50">
            {col.map(k => (
              <Link key={k.id} href={`/students/${k.id}?tab=docs`}
                className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-slate-50 transition-colors">
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${k.worst < 0 ? 'bg-rose-400' : 'bg-amber-400'}`} />
                <span className="text-[13px] text-slate-800 truncate">{k.first} {k.last}</span>
                {k.cls && <span className="shrink-0 text-[11px] text-slate-400">{k.cls}</span>}
                <span className="ml-auto flex items-center gap-1 min-w-0 overflow-hidden">
                  {k.docs.sort((a, b) => a.days - b.days).slice(0, 2).map(d => (
                    <span key={d.type} title={`${SHORT[d.type] || d.type} — валиден до ${fmt(d.until)}`}
                      className="text-[11px] text-slate-500 whitespace-nowrap">
                      {SHORT[d.type] || d.type} · <span className={d.days < 0 ? 'text-rose-600' : 'text-amber-700'}>{d.days < 0 ? 'изтекъл' : d.days === 0 ? 'днес' : d.days === 1 ? 'утре' : `${d.days} дни`}</span>
                    </span>
                  ))}
                  {k.docs.length > 2 && <span className="text-[11px] text-slate-400">+{k.docs.length - 2}</span>}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
      {rest > 0 && (
        <Link href={href} className="block px-4 py-2 border-t border-slate-100 text-[12px] text-slate-500 hover:text-[#0f2240] hover:bg-slate-50 rounded-b-2xl">
          + още {rest} {rest === 1 ? 'дете' : 'деца'} — в справката
        </Link>
      )}
    </div>
  )
}
