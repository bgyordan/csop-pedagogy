// PECS — всички деца, с които колегата работи по метода: етап, последно занимание, тенденция.
// Ръководството вижда всички. Оттук се започва и за ново дете.

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { MessagesSquare, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react'
import { myChildrenIds } from '@/lib/my-children'
import { PHASES, ROMAN, PHASE_COLOR, pct, fmtDate } from '../students/[id]/pecs/lib'
import StartPicker from './StartPicker'
export const dynamic = 'force-dynamic'

export default async function PecsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isManager = ['admin', 'zdud', 'director'].includes(me.role) || me.is_coordinator
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const { data: profs, error } = await supabase.from('pecs_profiles').select('student_id, phase, phase_since, criterion_pct, active, student:students(id, first_name, last_name, status)')
  const { data: sess } = await supabase.from('pecs_sessions').select('student_id, held_on, trials, independent, created_at').order('held_on', { ascending: false }).limit(3000)
  const by: Record<string, any[]> = {}
  ;(sess || []).forEach((s: any) => { (by[s.student_id] = by[s.student_id] || []).push(s) })

  const rows = (profs || []).filter((p: any) => p.student && p.active).map((p: any) => {
    const ss = (by[p.student_id] || []).filter((s: any) => s.trials > 0)
    const a = ss.slice(0, 3), b = ss.slice(3, 6)
    const avg = (x: any[]) => x.length ? Math.round(x.reduce((t, s) => t + pct(s), 0) / x.length) : null
    return { p, name: `${p.student.first_name} ${p.student.last_name}`, last: ss[0]?.held_on || null, now: avg(a), before: avg(b), count: ss.length }
  }).sort((x: any, y: any) => x.p.phase - y.p.phase || x.name.localeCompare(y.name, 'bg'))

  // моите деца, които още не са в PECS
  let candidates: { id: string; name: string }[] = []
  const inPecs = new Set((profs || []).map((p: any) => p.student_id))
  const ids = isManager ? null : await myChildrenIds(supabase, me.id, cy?.id)
  if (isManager || (ids && ids.size)) {
    let q = supabase.from('students').select('id, first_name, last_name').eq('status', 'active').order('first_name')
    if (ids) q = q.in('id', Array.from(ids))
    const { data: st } = await q
    candidates = (st || []).filter((s: any) => !inPecs.has(s.id)).map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex flex-wrap items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-sky-50 border border-sky-100 text-sky-700"><MessagesSquare size={22} /></div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">PECS</h1>
          <p className="text-sm text-slate-500 mt-0.5">Общуване чрез размяна на картинки — {isManager ? 'всички деца' : 'децата, с които работите'}</p>
        </div>
        {candidates.length > 0 && <StartPicker candidates={candidates} />}
      </header>

      {error ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">PECS още не е подготвен в базата — пуснете SQL файла 2026-10-11_pecs.sql.</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-600">Още няма деца в PECS.</p>
          <p className="text-[12.5px] text-slate-400 mt-1">Изберете дете горе вдясно или отворете досието му → таб „PECS“.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {rows.map((r: any) => {
            const trend = r.now != null && r.before != null ? r.now - r.before : null
            return (
              <Link key={r.p.student_id} href={`/students/${r.p.student_id}?tab=pecs`} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                <span className="w-10 h-10 rounded-full text-white text-[13px] font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: PHASE_COLOR[r.p.phase] }}>{ROMAN[r.p.phase]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-slate-800">{r.name}</div>
                  <div className="text-[12.5px] text-slate-500">{PHASES[r.p.phase].name} · от {fmtDate(r.p.phase_since)} · {r.count} занимания{r.last ? ` · последно ${fmtDate(r.last)}` : ''}</div>
                </div>
                {r.now != null && (
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-slate-800 tabular-nums">{r.now}%</div>
                    <div className="text-[11px] text-slate-400">сам, посл. 3</div>
                  </div>
                )}
                <span className="w-6">
                  {trend == null ? null : trend > 5 ? <TrendingUp size={18} className="text-emerald-600" /> : trend < -5 ? <TrendingDown size={18} className="text-rose-500" /> : <Minus size={18} className="text-slate-300" />}
                </span>
                <ChevronRight size={16} className="text-slate-300" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
