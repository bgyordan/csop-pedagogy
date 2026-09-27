import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Check, Circle, Info, Sparkles } from 'lucide-react'

// „Прием“ — за НОВО дете: какво е попълнено и какво липсва, на едно място.
// Показва се само докато детето е отбелязано като ново.
export default async function IntakeCard({ student, enrollment, guardiansCount, eplr, coudEnrolled, canManage }: {
  student: any; enrollment: any; guardiansCount: number; eplr: any; coudEnrolled: boolean; canManage: boolean
}) {
  const supabase = await createClient()
  const id = student.id
  const [{ data: survey }, { count: docsCount }] = await Promise.all([
    supabase.from('student_surveys').select('status').eq('student_id', id).maybeSingle(),
    supabase.from('student_documents').select('*', { count: 'exact', head: true }).eq('student_id', id),
  ])
  const className = enrollment?.class?.name || ''
  const inSluzhebna = !className || /служебна/i.test(className)
  const hasTeam = !!(eplr && (eplr.psychologist_id || eplr.speech_therapist_id || eplr.rehabilitator_id || eplr.class_teacher_id))
  const hasTherapist = !!(student.therapist_psychologist_id || student.therapist_speech_id || student.therapist_rehab_id)

  type Step = { done: boolean; label: string; hint: string; href?: string; info?: boolean }
  const steps: Step[] = [
    { done: !inSluzhebna, label: 'Паралелка', hint: inSluzhebna ? 'още е в Служебна' : `паралелка ${className}`, href: canManage ? `/students/${id}/transfer` : undefined },
    { done: !!enrollment?.education_form, label: 'Форма на обучение', hint: enrollment?.education_form === 'ifo' ? 'ИФО' : enrollment?.education_form ? 'дневна' : 'таб „Данни“' },
    { done: guardiansCount > 0, label: 'Родител', hint: guardiansCount > 0 ? `${guardiansCount} въведен(и)` : 'таб „Данни“' },
    { done: !!student.sending_school_id, label: 'Изпращащо училище', hint: student.sending_school?.name || 'от „Редактирай“', href: `/students/${id}/edit` },
    { done: hasTeam, label: 'ЕПЛР екип', hint: hasTeam ? 'определен' : 'не е определен', href: `/students/${id}/eplr` },
    { done: hasTherapist, label: 'Терапевти', hint: hasTherapist ? 'разпределено' : 'не е разпределено', href: canManage ? '/admin/therapists' : undefined },
    { done: survey?.status === 'completed', label: 'Анкета (оценка)', hint: survey?.status === 'completed' ? 'завършена' : survey?.status === 'in_progress' ? 'започната' : 'непопълнена', href: `/students/${id}/survey` },
    { done: (docsCount || 0) > 0, label: 'ТЕЛК / ЕР / документи', hint: (docsCount || 0) > 0 ? `${docsCount} въведени` : 'таб „Данни“' },
    { done: true, info: true, label: 'ЦОУД', hint: coudEnrolled ? 'записан в група' : 'не е в ЦОУД (решава КЕ)' },
  ]
  const required = steps.filter(s => !s.info)
  const doneCount = required.filter(s => s.done).length

  return (
    <div className="bg-white rounded-2xl border border-violet-200/70 shadow-sm p-5 mb-5">
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <Sparkles size={16} className="text-violet-500" />
        <h2 className="text-sm font-semibold text-slate-800">Прием на ново дете</h2>
        <span className="ml-auto text-xs text-slate-500">{doneCount} от {required.length} готови</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
        <div className="h-full bg-violet-400 transition-all" style={{ width: `${Math.round(doneCount / required.length * 100)}%` }} />
      </div>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(s => {
          const icon = s.info ? <Info size={14} className="text-slate-400 shrink-0" />
            : s.done ? <Check size={14} className="text-emerald-600 shrink-0" />
            : <Circle size={14} className="text-amber-400 shrink-0" />
          const body = (
            <div className="flex items-start gap-2 min-w-0">
              <span className="mt-0.5">{icon}</span>
              <div className="min-w-0">
                <div className={`text-sm ${s.done && !s.info ? 'text-slate-500' : 'text-slate-800'}`}>{s.label}</div>
                <div className={`text-[11px] truncate ${!s.done ? 'text-amber-700' : 'text-slate-400'}`}>{s.hint}</div>
              </div>
            </div>
          )
          return s.href && !s.done
            ? <Link key={s.label} href={s.href} className="rounded-lg px-2 py-1 -mx-2 hover:bg-amber-50/60 transition-colors">{body}</Link>
            : <div key={s.label} className="px-2 py-1 -mx-2">{body}</div>
        })}
      </div>
      {doneCount === required.length && (
        <p className="text-xs text-emerald-700 mt-3">Всичко е попълнено — може да натиснете „Вече не е нов“.</p>
      )}
    </div>
  )
}
