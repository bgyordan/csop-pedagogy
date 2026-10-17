// РЕМЕЛКА — децата, с които колегата работи по методиката: програма, овладени умения, последно занимание.
// Ръководството и координаторите виждат всички и поддържат каталога с уменията.

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { Calculator, ChevronRight, AlertTriangle } from 'lucide-react'
import { myChildrenIds } from '@/lib/my-children'
import { PARTS, fmtDate, todaySofia } from '@/lib/remelka'
import type { Part } from '@/lib/remelka'
import StartPicker from './StartPicker'
import RemelkaTools from './RemelkaTools'
export const dynamic = 'force-dynamic'

export default async function RemelkaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const isManager = ['admin', 'zdud', 'director'].includes(me.role) || me.is_coordinator
  const { data: cy } = await supabase.from('academic_years').select('id').eq('is_current', true).single()

  const { data: profs, error } = await supabase.from('remelka_profiles').select('student_id, parts, started_at, active, student:students(id, first_name, last_name, status)')
  const { data: goals } = await supabase.from('remelka_goals').select('student_id, status')
  const { data: sess } = await supabase.from('remelka_sessions').select('student_id, held_on, staff_id').order('held_on', { ascending: false }).limit(5000)
  const { data: asm } = await supabase.from('remelka_assessments').select('student_id, held_on')

  const g: Record<string, { active: number; mastered: number }> = {}
  ;(goals || []).forEach((x: any) => { const t = (g[x.student_id] ||= { active: 0, mastered: 0 }); if (x.status === 'active') t.active++; if (x.status === 'mastered') t.mastered++ })
  const lastS: Record<string, string> = {}, count: Record<string, number> = {}, staffBy: Record<string, Set<string>> = {}
  ;(sess || []).forEach((s: any) => {
    if (!lastS[s.student_id]) lastS[s.student_id] = s.held_on
    count[s.student_id] = (count[s.student_id] || 0) + 1
    ;(staffBy[s.student_id] ||= new Set()).add(s.staff_id)
  })
  const nA: Record<string, number> = {}
  ;(asm || []).forEach((a: any) => { nA[a.student_id] = (nA[a.student_id] || 0) + 1 })
  const today = todaySofia()
  const daysSince = (d?: string) => d ? Math.round((new Date(today).getTime() - new Date(d).getTime()) / 86400000) : null

  const rows = (profs || []).filter((p: any) => p.student && p.active && p.student.status === 'active').map((p: any) => ({
    p, name: `${p.student.first_name} ${p.student.last_name}`, goals: g[p.student_id] || { active: 0, mastered: 0 },
    last: lastS[p.student_id], n: count[p.student_id] || 0, assess: nA[p.student_id] || 0, colleagues: staffBy[p.student_id]?.size || 0,
  })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'bg'))

  let candidates: { id: string; name: string }[] = []
  const inProgram = new Set((profs || []).map((p: any) => p.student_id))
  const ids = isManager ? null : await myChildrenIds(supabase, me.id, cy?.id)
  if (isManager || (ids && ids.size)) {
    let q = supabase.from('students').select('id, first_name, last_name').eq('status', 'active').order('first_name')
    if (ids) q = q.in('id', Array.from(ids))
    const { data: st } = await q
    candidates = (st || []).filter((s: any) => !inProgram.has(s.id)).map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))
  }
  // колегата вижда само децата, с които работи — това пази базата (works_with_student)
  const visible = rows
  const totals = { kids: visible.length, mastered: visible.reduce((a: number, r: any) => a + r.goals.mastered, 0), sessions: visible.reduce((a: number, r: any) => a + r.n, 0) }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex flex-wrap items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700"><Calculator size={22} /></div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">РЕМЕЛКА</h1>
          <p className="text-sm text-slate-500 mt-0.5">Смятане и социални умения — {isManager ? 'всички деца' : 'децата, с които работите'}</p>
        </div>
        <RemelkaTools canEditCatalog={isManager} />
        {candidates.length > 0 && <StartPicker candidates={candidates} />}
      </header>

      {error ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">РЕМЕЛКА още не е подготвена в базата — пуснете SQL файла 2026-10-17_remelka.sql.</div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-600">Още няма деца по РЕМЕЛКА.</p>
          <p className="text-[12.5px] text-slate-400 mt-1">Изберете дете горе вдясно или отворете досието му → таб „РЕМЕЛКА“. Започва се с входяща диагностика.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[['деца', totals.kids], ['овладени умения', totals.mastered], ['занимания', totals.sessions]].map(([l, v]) => (
              <div key={l as string} className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
                <div className="text-2xl font-semibold text-slate-800 tabular-nums">{v}</div>
                <div className="text-[12px] text-slate-500">{l}</div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {visible.map((r: any) => {
              const d = daysSince(r.last)
              return (
                <Link key={r.p.student_id} href={`/students/${r.p.student_id}?tab=remelka`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="flex-1 min-w-[180px]">
                    <div className="text-[15px] text-slate-800">{r.name}</div>
                    <div className="text-[12.5px] text-slate-500">
                      {(r.p.parts as Part[]).map(p => PARTS[p].short).join(' + ')} · от {fmtDate(r.p.started_at)} · {r.n} занимания
                      {r.last ? ` · последно ${fmtDate(r.last)}` : ''}{isManager && r.colleagues ? ` · ${r.colleagues} колеги` : ''}
                    </div>
                  </div>
                  {r.assess === 0 && <span className="inline-flex items-center gap-1 text-[11.5px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"><AlertTriangle size={12} /> без диагностика</span>}
                  {d !== null && d > 14 && <span className="text-[11.5px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{d} дни без занимание</span>}
                  <div className="text-right">
                    <div className="text-[14px] text-slate-800 tabular-nums">{r.goals.active} <span className="text-slate-400 text-[12px]">в програмата</span></div>
                    <div className="text-[12px] text-emerald-700 tabular-nums">{r.goals.mastered} овладени</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
