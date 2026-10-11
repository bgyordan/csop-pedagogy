import Link from 'next/link'
import { MonitorSmartphone, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

// Онлайн стаи на таблото: децата на ОРЕС в момента, с които колегата работи
// (класен, часове в паралелката, ИФО, ЦОУД, терапия, ЕПЛР екип). Управата вижда всички.
// Ако няма такива деца (или колоната още я няма) — нищо.
export default async function OnlineRoomStrip({ profile, currentYearId }: { profile: { id: string; role: string }; currentYearId: string }) {
  if (['secretary', 'support'].includes(profile.role)) return null
  const supabase = await createClient()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
  const { data: ores, error } = await supabase.from('student_ores')
    .select('id, student_id, to_date, room_token, room_closed_at, student:students(id, first_name, last_name, status, therapist_psychologist_id, therapist_speech_id, therapist_rehab_id, therapist_rehab2_id)')
    .lte('from_date', today).or(`to_date.is.null,to_date.gte.${today}`)
  if (error || !ores?.length) return null
  let list = ores.filter((o: any) => o.room_token && !o.room_closed_at && o.student?.status === 'active')
  if (!list.length) return null

  const ids = list.map((o: any) => o.student_id)
  const { data: enr } = await supabase.from('student_enrollments').select('student_id, class_id, class:classes(name)')
    .in('student_id', ids).eq('academic_year_id', currentYearId)
  const classOf: Record<string, { id: string; name: string }> = {}
  ;(enr || []).forEach((e: any) => { classOf[e.student_id] = { id: e.class_id, name: e.class?.name || '' } })

  if (!['admin', 'zdud', 'director'].includes(profile.role)) {
    const me = profile.id
    const [{ data: ct }, { data: scheds }, { data: ifo }, { data: eplr }, { data: coud }] = await Promise.all([
      supabase.from('class_teacher_assignments').select('class_id').eq('staff_id', me).eq('academic_year_id', currentYearId),
      supabase.from('class_schedules').select('id, class_id').eq('academic_year_id', currentYearId),
      supabase.from('teacher_ifo_slots').select('student_id').eq('teacher_id', me).eq('academic_year_id', currentYearId),
      supabase.from('eplr_teams').select('student_id').eq('academic_year_id', currentYearId).in('student_id', ids)
        .or(`psychologist_id.eq.${me},speech_therapist_id.eq.${me},rehabilitator_id.eq.${me},class_teacher_id.eq.${me}`),
      supabase.from('coud_enrollments').select('student_id, coud_group:coud_groups(teacher_id)').eq('academic_year_id', currentYearId).in('student_id', ids),
    ])
    const myClasses = new Set<string>((ct || []).map((r: any) => r.class_id))
    const schedClass: Record<string, string> = {}
    ;(scheds || []).forEach((s: any) => { schedClass[s.id] = s.class_id })
    const sids = Object.keys(schedClass)
    if (sids.length) {
      const { data: sl } = await supabase.from('schedule_slots').select('schedule_id').in('schedule_id', sids).eq('staff_id', me)
      ;(sl || []).forEach((r: any) => { if (schedClass[r.schedule_id]) myClasses.add(schedClass[r.schedule_id]) })
    }
    const mine = new Set<string>([
      ...(ifo || []).map((r: any) => r.student_id),
      ...(eplr || []).map((r: any) => r.student_id),
      ...(coud || []).filter((r: any) => r.coud_group?.teacher_id === me).map((r: any) => r.student_id),
    ])
    list = list.filter((o: any) => {
      const s = o.student
      return mine.has(o.student_id) || myClasses.has(classOf[o.student_id]?.id)
        || [s.therapist_psychologist_id, s.therapist_speech_id, s.therapist_rehab_id, s.therapist_rehab2_id].includes(me)
    })
    if (!list.length) return null
  }

  // нови въпроси от родителите (непрочетени) — по ОРЕС период
  const unread: Record<string, number> = {}
  const { data: um } = await supabase.from('online_room_messages').select('ores_id')
    .in('ores_id', list.map((o: any) => o.id)).eq('from_parent', true).is('read_at', null).neq('kind', 'ok')
  ;(um || []).forEach((m: any) => { unread[m.ores_id] = (unread[m.ores_id] || 0) + 1 })
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)
  const fmt = (d: string) => d.split('-').reverse().join('.')
  return (
    <div className={`px-5 py-3 rounded-2xl border shadow-sm ${totalUnread ? 'border-amber-300 bg-amber-50/60' : 'border-sky-200 bg-sky-50/60'}`}>
      <div className="flex items-center gap-2 text-sm text-slate-800">
        <MonitorSmartphone size={16} className="text-sky-700" /> Онлайн стаи — деца на ОРЕС ({list.length})
        {totalUnread > 0 && <span className="text-[12px] px-2 py-0.5 rounded-full bg-amber-500 text-white">{totalUnread} {totalUnread === 1 ? 'нов въпрос' : 'нови въпроса'} от родители</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {list.map((o: any) => (
          <Link key={o.student_id} href={`/students/${o.student_id}?tab=room`} className="inline-flex items-center gap-1 text-[13px] text-slate-700 hover:text-[#0f2240] hover:underline">
            {o.student.first_name} {o.student.last_name}
            {classOf[o.student_id]?.name && <span className="text-slate-500"> · {classOf[o.student_id].name}</span>}
            {o.to_date && <span className="text-slate-500"> · до {fmt(o.to_date)}</span>}
            {unread[o.id] > 0 && <span className="text-amber-700"> · {unread[o.id]} въпрос{unread[o.id] > 1 ? 'а' : ''}</span>}
            <ArrowRight size={12} />
          </Link>
        ))}
      </div>
    </div>
  )
}
