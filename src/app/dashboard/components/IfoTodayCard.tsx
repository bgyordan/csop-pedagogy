import Link from 'next/link'
import { Clock3 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getChildrenToday } from '@/lib/children-today'
import ChildrenTodayClient from './ChildrenTodayClient'

// „Деца в ИФО — днес“ — картички с имена; докосване отваря деня на детето (сега / следва / целият ден).
//  • search (помощници) — „Децата днес“ с търсене сред ВСИЧКИ деца; без търсене се виждат ИФО децата;
//  • без staffId (управа) — всички ИФО деца;
//  • staffId (останалите) — само „моите“ ИФО деца: от паралелката, на която съм класен, или с ИФО час / терапия при мен.
//    Ако нямам такива — картата не се показва.
// Данните се четат на сървъра (service-role) — само имена, паралелка и днешните часове, нищо от досието.
export default async function IfoTodayCard({ currentYearId, staffId, search, full }: {
  currentYearId: string; staffId?: string; search?: boolean; full?: boolean
}) {
  const mine = !!staffId && !search
  const { schoolDay, nowMin, kids } = await getChildrenToday(currentYearId)
  let ifoKids = kids.filter(k => k.ifo)

  if (mine) {
    const db = createAdminClient()
    const [{ data: cta }, { data: myIfo }, { data: myTher }, { data: enr }] = await Promise.all([
      db.from('class_teacher_assignments').select('class_id').eq('staff_id', staffId).eq('academic_year_id', currentYearId),
      db.from('teacher_ifo_slots').select('student_id').eq('teacher_id', staffId).eq('academic_year_id', currentYearId),
      db.from('therapist_slots').select('student_id, schedule:therapist_schedules!inner(staff_id, academic_year_id)')
        .eq('schedule.staff_id', staffId).eq('schedule.academic_year_id', currentYearId),
      db.from('student_enrollments').select('student_id, class_id').eq('academic_year_id', currentYearId).eq('education_form', 'ifo'),
    ])
    const myClasses = new Set((cta || []).map((c: any) => c.class_id))
    const myKids = new Set([...(myIfo || []), ...(myTher || [])].map((x: any) => x.student_id))
    ;(enr || []).forEach((e: any) => { if (myClasses.has(e.class_id)) myKids.add(e.student_id) })
    ifoKids = ifoKids.filter(k => myKids.has(k.id))
    if (ifoKids.length === 0 || !schoolDay) return null
  }

  const title = search ? 'Децата днес' : mine ? 'Моите деца в ИФО — днес' : 'Деца в ИФО — днес'
  const count = search ? null : ifoKids.length

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
        <Clock3 size={18} className="text-teal-600" />
        <span className="text-base font-medium text-[#0f2240]">{title}</span>
        {count != null && <span className="ml-auto text-xs text-slate-400">{count} {count === 1 ? 'дете' : 'деца'}</span>}
        {!full && !search && count != null && count > 0 && <Link href="/ifo-today" className="text-xs text-teal-700 hover:underline">цял екран</Link>}
      </div>
      {!schoolDay && <p className="px-5 pt-3 text-sm text-slate-400">Днес не е учебен ден.</p>}
      <div className={full || search ? '' : 'max-h-[24rem] overflow-y-auto'}>
        <ChildrenTodayClient
          kids={search ? kids : ifoKids}
          defaultIds={search ? ifoKids.map(k => k.id) : undefined}
          nowMin={nowMin}
          search={search}
          emptyText="Днес няма деца в ИФО."
        />
      </div>
    </div>
  )
}
