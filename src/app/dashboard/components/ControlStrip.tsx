import Link from 'next/link'
import { ClipboardCheck, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PROTOCOL_DAYS, addDays } from '@/lib/control'

// Контролна дейност на таблото — едно известие с най-важното:
// за служителя: протокол за запознаване, препоръки със срок до 3 дни или изтекъл;
// за проверяващия: изтичащи чернови и отчетени препоръки, които чакат потвърждение.
export default async function ControlStrip({ profile }: { profile: any }) {
  const supabase = await createClient()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
  const { data: pending, error } = await supabase.from('control_check_staff')
    .select('check_id, check:control_checks!inner(status, subject)')
    .eq('staff_id', profile.id).is('acked_at', null).eq('check.status', 'signed')
  if (error) return null   // таблиците още ги няма

  const { data: myRecs } = await supabase.from('control_recommendations')
    .select('id, check_id, due_date, check:control_checks!control_recommendations_check_id_fkey!inner(status)')
    .eq('responsible_id', profile.id).eq('check.status', 'signed').in('status', ['open', 'not_done'])
    .lte('due_date', addDays(today, 3))

  const { data: selfReq } = await supabase.rpc('control_self_requests')
  const selfOpen = ((selfReq || []) as any[]).filter(r => !r.self_assessed_at).length

  let late = 0, toReview = 0
  if (['director', 'zdud', 'admin'].includes(profile.role)) {
    const [{ count }, { count: rc }] = await Promise.all([
      supabase.from('control_checks').select('id', { count: 'exact', head: true })
        .eq('inspector_id', profile.id).eq('status', 'draft').lte('check_date', addDays(today, 5 - PROTOCOL_DAYS)),
      supabase.from('control_recommendations').select('id, check:control_checks!control_recommendations_check_id_fkey!inner(inspector_id, status)', { count: 'exact', head: true })
        .eq('status', 'reported').eq('check.status', 'signed').eq('check.inspector_id', profile.id),
    ])
    late = count || 0
    toReview = rc || 0
  }

  const n = (pending || []).length
  const recs = (myRecs || []) as any[]
  const overdue = recs.filter(r => r.due_date < today).length
  const items: { text: string; href: string; tone: 'indigo' | 'rose' | 'amber' }[] = []
  if (n) items.push({
    text: n === 1 ? 'Имате констативен протокол за запознаване' : `Имате ${n} констативни протокола за запознаване`,
    href: n === 1 ? `/control/${(pending as any[])[0].check_id}` : '/control', tone: 'indigo',
  })
  if (recs.length) items.push({
    text: overdue ? `${overdue === 1 ? 'Препоръка с изтекъл срок' : `${overdue} препоръки с изтекъл срок`} — отчетете изпълнението`
      : `${recs.length === 1 ? 'Препоръка със срок' : `${recs.length} препоръки със срок`} до 3 дни`,
    href: recs.length === 1 ? `/control/${recs[0].check_id}` : '/control', tone: overdue ? 'rose' : 'amber',
  })
  if (selfOpen) items.push({ text: selfOpen === 1 ? 'Поискана е самооценка преди проверка' : `Поискани са ${selfOpen} самооценки преди проверка`, href: '/control', tone: 'indigo' })
  if (toReview) items.push({ text: `${toReview} ${toReview === 1 ? 'отчетена препоръка чака' : 'отчетени препоръки чакат'} потвърждение`, href: '/control?tab=recs', tone: 'indigo' })
  if (late) items.push({ text: `${late} ${late === 1 ? 'протокол изтича' : 'протокола изтичат'} — срокът е ${PROTOCOL_DAYS} дни от проверката`, href: '/control', tone: 'amber' })
  if (!items.length) return null

  const [main, ...rest] = items
  const box = main.tone === 'rose' ? 'bg-rose-50/70 border-rose-200' : main.tone === 'amber' ? 'bg-amber-50/70 border-amber-200' : 'bg-indigo-50/70 border-indigo-200'
  const icon = main.tone === 'rose' ? 'bg-rose-600' : main.tone === 'amber' ? 'bg-amber-500' : 'bg-indigo-600'
  const sub = rest.length ? rest.map(i => i.text.charAt(0).toLowerCase() + i.text.slice(1)).join(' · ')
    : n ? ((pending as any[])[0]?.check?.subject || 'Контролна дейност') : 'Контролна дейност'

  return (
    <Link href={main.href}
      className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${box}`}>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${icon}`}><ClipboardCheck size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-800">{main.text}</span>
        <span className="block text-[12.5px] text-slate-500 truncate">{sub}</span>
      </span>
      <ArrowRight size={15} className="text-slate-400 shrink-0" />
    </Link>
  )
}
