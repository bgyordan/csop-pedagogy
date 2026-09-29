import { createClient } from '@/lib/supabase/server'
import { History } from 'lucide-react'

// История на терапевтите на детето: кой кога го е взел, махнал или сменил (от therapist_changes).
// Ако таблицата още я няма или няма записи — нищо не се показва.
const ROLE_L: Record<string, string> = { psychologist: 'психолог', speech_therapist: 'логопед', rehabilitator: 'рехабилитатор' }

export default async function TherapistHistory({ studentId }: { studentId: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('therapist_changes')
    .select(`id, role, changed_at,
      old:staff_profiles!therapist_changes_old_staff_id_fkey(first_name, last_name),
      new:staff_profiles!therapist_changes_new_staff_id_fkey(first_name, last_name),
      by:staff_profiles!therapist_changes_changed_by_fkey(first_name, last_name)`)
    .eq('student_id', studentId).order('changed_at', { ascending: false }).limit(30)
  if (error || !data || data.length === 0) return null

  const nm = (p: any) => p ? `${p.first_name} ${p.last_name}` : ''
  const when = (iso: string) => {
    const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Europe/Sofia' }))
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 mt-4">
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <History size={16} className="text-slate-400" />
        <h2 className="font-semibold text-slate-800 text-sm">История на терапевтите</h2>
      </div>
      <div className="space-y-2">
        {data.map((c: any) => {
          const o = nm(c.old), n = nm(c.new), role = ROLE_L[c.role] || c.role
          const text = !o && n ? <>зачислен при <b className="font-medium text-slate-800">{n}</b> ({role})</>
            : o && !n ? <>премахнат от <b className="font-medium text-slate-800">{o}</b> ({role})</>
            : <>{role}: <b className="font-medium text-slate-800">{o}</b> → <b className="font-medium text-slate-800">{n}</b></>
          return (
            <div key={c.id} className="text-[13px] text-slate-600 leading-snug">
              <div>{text}</div>
              <div className="text-[11px] text-slate-400">{when(c.changed_at)}{c.by ? ` · ${nm(c.by)}` : ''}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
