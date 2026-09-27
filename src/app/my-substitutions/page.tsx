import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { CalendarClock } from 'lucide-react'
import MySubstitutionsClient from './MySubstitutionsClient'
export const dynamic = 'force-dynamic'
export interface MySubRow {
  id: string
  absentName: string
  dateFrom: string
  dateTo: string
  reason: string
  bsch: boolean
  hasOrder: boolean
  overNorm: boolean
  myDays: string | null   // при няколко заместника — само моите дни
}
export default async function MySubstitutionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase
    .from('staff_profiles').select('id, first_name, last_name').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')

  // като основен заместник ИЛИ в разпределение по дни (няколко заместника)
  const { data: myAs } = await supabase
    .from('substitution_assignments').select('substitution_id, date_from, date_to').eq('substitute_staff_id', me.id)
  const myParts: Record<string, { from: string; to: string }[]> = {}
  ;(myAs || []).forEach((a: any) => { (myParts[a.substitution_id] = myParts[a.substitution_id] || []).push({ from: a.date_from, to: a.date_to }) })
  const asIds = Object.keys(myParts)

  let q = supabase
    .from('substitutions')
    .select(`id, date_from, date_to, reason, bsch_eligible, substitution_order_id, over_norm,
      absent:staff_profiles!substitutions_absent_staff_id_fkey(first_name, last_name)`)
    .order('date_from', { ascending: false })
  q = asIds.length > 0 ? q.or(`substitute_staff_id.eq.${me.id},id.in.(${asIds.join(',')})`) : q.eq('substitute_staff_id', me.id)
  const { data } = await q

  // ако заместването е разделено между няколко души, основният заместник също е в разпределението —
  // тогава показваме само неговите дни
  const allIds = (data || []).map((r: any) => r.id)
  const splitIds = new Set<string>()
  if (allIds.length > 0) {
    const { data: anyAs } = await supabase.from('substitution_assignments').select('substitution_id').in('substitution_id', allIds)
    ;(anyAs || []).forEach((a: any) => splitIds.add(a.substitution_id))
  }

  const fmt = (d: string) => d.split('-').reverse().join('.')
  const rows: MySubRow[] = (data || []).flatMap((r: any) => {
    const parts = splitIds.has(r.id) ? (myParts[r.id] || []).sort((a, b) => a.from.localeCompare(b.from)) : null
    if (parts && parts.length === 0) return []
    return [{
      id: r.id,
      absentName: r.absent ? `${r.absent.first_name} ${r.absent.last_name}` : '—',
      dateFrom: parts ? parts[0].from : r.date_from,
      dateTo: parts ? parts[parts.length - 1].to : r.date_to,
      reason: r.reason,
      bsch: r.bsch_eligible === true, hasOrder: !!r.substitution_order_id,
      overNorm: r.over_norm !== false,
      myDays: parts ? parts.map(p => p.from === p.to ? fmt(p.from) : `${fmt(p.from)}–${fmt(p.to)}`).join(', ') : null,
    }]
  })

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <CalendarClock size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Моите замествания</h1>
          <p className="text-sm text-slate-500 mt-0.5">Замествания, в които участвате — изтеглете декларация за плащане</p>
        </div>
      </header>
      <MySubstitutionsClient rows={rows} />
    </div>
  )
}
