// РЕМЕЛКА → „Работни листове“: красиви тематични листове за печат, по умението и нивото на детето.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { currentLevels } from '@/lib/remelka'
import SheetsStudio, { type Rec } from './SheetsStudio'
export const dynamic = 'force-dynamic'

export default async function SheetsPage({ searchParams }: { searchParams: Promise<{ student?: string; skill?: string; level?: string; gen?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // децата по РЕМЕЛКА, които колегата вижда (базата пуска само неговите)
  const { data: profs } = await supabase.from('remelka_profiles').select('student_id, active, student:students(id, first_name, last_name, status)')
  const kids = (profs || []).filter((p: any) => p.student && p.active && p.student.status === 'active')
    .map((p: any) => ({ id: p.student.id as string, name: `${p.student.first_name} ${p.student.last_name}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'))

  // програмата на избраното дете → препоръчани листове (умение + текущо ниво)
  let recs: Rec[] = []
  const sid = sp.student && kids.some(k => k.id === sp.student) ? sp.student : ''
  if (sid) {
    const [{ data: skills }, { data: goals }, { data: asm }, { data: res }, { data: ses }, { data: its }] = await Promise.all([
      supabase.from('remelka_skills').select('id, code, title, part'),
      supabase.from('remelka_goals').select('skill_id, status').eq('student_id', sid).eq('status', 'active'),
      supabase.from('remelka_assessments').select('*').eq('student_id', sid),
      supabase.from('remelka_results').select('assessment_id, skill_id, level, errors, note').eq('student_id', sid),
      supabase.from('remelka_sessions').select('*').eq('student_id', sid),
      supabase.from('remelka_session_items').select('id, session_id, skill_id, level, support, activity').eq('student_id', sid),
    ])
    const lv = currentLevels((asm || []) as any, (res || []) as any, (ses || []) as any, (its || []) as any)
    const sk = Object.fromEntries((skills || []).map((s: any) => [s.id, s]))
    recs = (goals || []).map((g: any) => sk[g.skill_id]).filter(Boolean)
      .map((s: any) => ({ code: s.code, title: s.title, part: s.part, level: lv[s.id] ?? 0 }))
      .sort((a: Rec, b: Rec) => a.code.localeCompare(b.code, 'bg', { numeric: true }))
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <BackButton href={sid ? `/students/${sid}?tab=remelka` : '/remelka'} label={sid ? 'Към детето' : 'РЕМЕЛКА'} />
      <SheetsStudio kids={kids} studentId={sid} recs={recs} init={{ skill: sp.skill || '', level: Number(sp.level) || 0, gen: sp.gen || '' }} />
    </div>
  )
}
