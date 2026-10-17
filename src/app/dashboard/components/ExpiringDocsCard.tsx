import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { DOC_TYPES, todaySofia, daysTo, fmt } from '@/lib/student-docs'

// Карта „Документи със срок“ — по една картичка на дете: инициали, име, паралелка
// и етикет за всеки изтекъл / изтичащ документ. Най-спешните първи; останалото — в справката.
// studentIds подаден → само тези деца (класен); липсва → всички (управа).
const MAX = 11
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
  const shown = list.slice(0, list.length > MAX + 1 ? MAX : MAX + 1)
  const rest = list.length - shown.length
  const href = studentIds ? '/reports/documents?mine=1' : '/reports/documents'
  const statusHref = (s: string) => `${href}${href.includes('?') ? '&' : '?'}status=${s}`

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <CalendarClock size={15} className="text-slate-500" />
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mr-1">Документи със срок</span>
        {expired > 0 && (
          <Link href={statusHref('expired')} className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{expired} изтекли
          </Link>
        )}
        {soon > 0 && (
          <Link href={statusHref('soon')} className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{soon} до {windowDays} дни
          </Link>
        )}
        <Link href={href} className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-[#0f2240] hover:underline">Справка <ArrowRight size={12} /></Link>
      </div>

      <div className="grid gap-2 p-3 grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
        {shown.map(k => {
          const bad = k.worst < 0
          const initials = `${k.first[0] || ''}${k.last[0] || ''}`.toUpperCase()
          return (
            <Link key={k.id} href={`/students/${k.id}?tab=data`}
              className={`group relative rounded-xl border bg-white p-2.5 pl-3 hover:shadow-md hover:-translate-y-px transition overflow-hidden ${bad ? 'border-rose-200' : 'border-amber-200'}`}>
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${bad ? 'bg-rose-500' : 'bg-amber-400'}`} />
              <div className="flex items-center gap-2.5">
                <span className={`shrink-0 w-9 h-9 rounded-full grid place-items-center text-[13px] font-semibold tracking-wide ${bad ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{initials}</span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-slate-800 truncate leading-tight" title={`${k.first} ${k.last}`}>{k.first} {k.last}</div>
                  {k.cls && <div className="text-[11px] text-slate-500 truncate mt-0.5">{k.cls}</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {k.docs.sort((a, b) => a.days - b.days).map(d => (
                  <span key={d.type} title={`${SHORT[d.type] || d.type} — валиден до ${fmt(d.until)}`}
                    className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded-md border whitespace-nowrap ${d.days < 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                    {SHORT[d.type] || d.type} · {d.days < 0 ? 'изтекъл' : d.days === 0 ? 'днес' : d.days === 1 ? 'утре' : `${d.days} дни`}
                  </span>
                ))}
              </div>
            </Link>
          )
        })}
        {rest > 0 && (
          <Link href={href} className="rounded-xl border border-dashed border-slate-300 p-2.5 grid place-items-center text-center text-slate-500 hover:text-[#0f2240] hover:border-slate-400 hover:bg-slate-50 transition">
            <div>
              <div className="text-lg font-semibold tabular-nums">+{rest}</div>
              <div className="text-[11px]">още деца · справка</div>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}
