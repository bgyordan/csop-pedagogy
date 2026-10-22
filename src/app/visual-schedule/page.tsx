// Визуален график с пиктограми — денят на паралелката от разписанието, за екрана в класната стая и за печат.
// Колегата вижда само своите паралелки (класен или има часове там); ръководството — всички.
// Сменените картинки се пазят за паралелката (visual_schedule_pictos); ЗДУД и админ виждат „Промени от колегите“.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { Images } from 'lucide-react'
import { PERIOD_BY_N } from '@/lib/periods'
import VisualScheduleClient from './VisualScheduleClient'
import type { Slot, Override, ChangeRow } from './VisualScheduleClient'
export const dynamic = 'force-dynamic'

export default async function VisualSchedulePage({ searchParams }: { searchParams: Promise<{ c?: string; term?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isManager = ['admin', 'zdud', 'director'].includes(me.role)
  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  // паралелките на колегата
  const { data: scheds } = await supabase.from('class_schedules').select('id, class_id, term').eq('academic_year_id', cy?.id)
  let classIds: Set<string>
  if (isManager) {
    classIds = new Set((scheds || []).map((s: any) => s.class_id))
  } else {
    classIds = new Set<string>()
    const { data: ct } = await supabase.from('class_teacher_assignments').select('class_id').eq('staff_id', me.id).eq('academic_year_id', cy?.id)
    ;(ct || []).forEach((r: any) => r.class_id && classIds.add(r.class_id))
    const byId: Record<string, string> = {}
    ;(scheds || []).forEach((s: any) => { byId[s.id] = s.class_id })
    if (Object.keys(byId).length) {
      const { data: sl } = await supabase.from('schedule_slots').select('schedule_id').in('schedule_id', Object.keys(byId)).eq('staff_id', me.id)
      ;(sl || []).forEach((r: any) => byId[r.schedule_id] && classIds.add(byId[r.schedule_id]))
    }
  }
  const { data: cls } = classIds.size
    ? await supabase.from('classes').select('id, name').in('id', Array.from(classIds)) : { data: [] as any[] }
  const classes = ((cls || []) as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name, 'bg', { numeric: true }))
  const current = classes.find(c => c.id === sp.c) || classes[0]

  // срок: от февруари — втори (ако за него още няма разписание — първи)
  const month = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Sofia', month: 'numeric' }))
  let term = sp.term === '1' || sp.term === '2' ? Number(sp.term) : (month >= 2 && month <= 8 ? 2 : 1)
  const forClass = (scheds || []).filter((s: any) => s.class_id === current?.id)
  if (!sp.term && !forClass.some((s: any) => s.term === term)) term = 1
  const sched = forClass.find((s: any) => s.term === term)

  let slots: Slot[] = []
  if (sched) {
    const { data: rows } = await supabase.from('schedule_slots')
      .select('day, period, subject:subjects(name)').eq('schedule_id', sched.id)
    slots = (rows || []).map((r: any) => {
      const p = PERIOD_BY_N[r.period]
      return { day: r.day, period: r.period, subject: r.subject?.name || '', start: p?.start ?? 0, end: p?.end ?? 0 }
    }).filter(s => s.subject && s.start)
  }

  // картинките на паралелката
  let overrides: Record<string, Override> = {}
  if (current) {
    const { data: ov } = await supabase.from('visual_schedule_pictos').select('subject_key, picto, label').eq('class_id', current.id)
    ;(ov || []).forEach((r: any) => { overrides[r.subject_key] = { picto: r.picto || undefined, label: r.label || undefined } })
  }

  // ЗДУД и админ: какво са сменили колегите (последните 200)
  let changes: ChangeRow[] | null = null
  if (['admin', 'zdud'].includes(me.role)) {
    const { data: ch } = await supabase.from('visual_schedule_pictos')
      .select('id, class_id, subject_key, picto, label, updated_at, class:classes(name), who:staff_profiles(first_name, last_name)')
      .order('updated_at', { ascending: false }).limit(200)
    changes = (ch || []).map((r: any) => ({
      id: r.id, classId: r.class_id, className: r.class?.name || '', subject: r.subject_key, picto: r.picto, label: r.label,
      at: r.updated_at, who: r.who ? `${r.who.first_name || ''} ${r.who.last_name || ''}`.trim() : '—',
    }))
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="print:hidden">
        <BackButton />
        <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
          <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 text-sky-700">
            <Images size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Визуален график</h1>
            <p className="text-sm text-slate-500 mt-0.5">Денят на паралелката с картинки — на екрана в класа или разпечатан</p>
          </div>
        </header>
      </div>
      {!current ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-sm text-slate-500">
          Нямате паралелка с разписание за тази година.
        </div>
      ) : (
        <VisualScheduleClient key={current.id + term} classes={classes} classId={current.id} className={current.name}
          term={term} yearName={cy?.name || ''} slots={slots} overrides={overrides} meId={me.id} changes={changes} />
      )}
    </div>
  )
}
