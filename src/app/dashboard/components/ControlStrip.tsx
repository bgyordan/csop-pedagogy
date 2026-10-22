import Link from 'next/link'
import { ClipboardCheck, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PROTOCOL_DAYS, addDays } from '@/lib/control'

// Контролна дейност на таблото: „протокол за запознаване“ (за проверения) и „черновите изтичат“ (за проверяващия).
export default async function ControlStrip({ profile }: { profile: any }) {
  const supabase = await createClient()
  const { data: pending, error } = await supabase.from('control_check_staff')
    .select('check_id, check:control_checks!inner(status, subject)')
    .eq('staff_id', profile.id).is('acked_at', null).eq('check.status', 'signed')
  if (error) return null   // таблиците още ги няма

  let late = 0
  if (['director', 'zdud', 'admin'].includes(profile.role)) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
    const { count } = await supabase.from('control_checks').select('id', { count: 'exact', head: true })
      .eq('inspector_id', profile.id).eq('status', 'draft').lte('check_date', addDays(today, 5 - PROTOCOL_DAYS))
    late = count || 0
  }
  const n = (pending || []).length
  if (!n && !late) return null
  const one = n === 1 ? (pending as any[])[0] : null

  return (
    <Link href={one ? `/control/${one.check_id}` : '/control'}
      className={`flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${n ? 'bg-indigo-50/70 border-indigo-200' : 'bg-amber-50/70 border-amber-200'}`}>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${n ? 'bg-indigo-600' : 'bg-amber-500'}`}><ClipboardCheck size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-800">
          {n ? (n === 1 ? 'Имате констативен протокол за запознаване' : `Имате ${n} констативни протокола за запознаване`) : `${late} ${late === 1 ? 'протокол изтича' : 'протокола изтичат'} — срокът е ${PROTOCOL_DAYS} дни от проверката`}
        </span>
        <span className="block text-[12.5px] text-slate-500 truncate">
          {n ? (one?.check?.subject || 'Контролна дейност') : 'Довършете и подпишете черновите'}
          {n > 0 && late > 0 ? ` · и ${late} ваши чернови изтичат` : ''}
        </span>
      </span>
      <ArrowRight size={15} className="text-slate-400 shrink-0" />
    </Link>
  )
}
