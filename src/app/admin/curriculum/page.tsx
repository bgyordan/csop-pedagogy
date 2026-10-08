import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { BookOpenCheck } from 'lucide-react'
import CurriculumClient from './CurriculumClient'
import { fetchAll } from '@/lib/supabase/fetch-all'

export const dynamic = 'force-dynamic'

export default async function CurriculumPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(me?.role || '')) redirect('/dashboard')

  const { data: cy } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()
  const [{ data: classes }, { data: couds }, { data: staff }, { data: map }, linesRes] = await Promise.all([
    supabase.from('classes').select('id, name').eq('academic_year_id', cy?.id),
    supabase.from('coud_groups').select('id, name').eq('academic_year_id', cy?.id),
    supabase.from('staff_profiles').select('id, first_name, last_name, is_active'),
    supabase.from('curriculum_name_map').select('kind, source_name, target_id'),
    fetchAll(() => supabase.from('curriculum_lines').select('*').eq('academic_year_id', cy?.id).order('holder_label').order('id')),
  ])

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-700">
          <BookOpenCheck size={22} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Учебни планове</h1>
          <p className="text-sm text-slate-500 mt-0.5">Внос от НЕИСПУО · {cy?.name} · предмети, часове и преподаватели по паралелки</p>
        </div>
      </header>
      <CurriculumClient
        ready={!linesRes.error}
        lines={linesRes.data || []}
        classes={(classes || []).map((c: any) => ({ id: c.id, name: c.name }))}
        couds={(couds || []).map((c: any) => ({ id: c.id, name: c.name }))}
        staff={(staff || []).filter((s: any) => s.is_active !== false).map((s: any) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` }))
          .sort((a, b) => a.name.localeCompare(b.name, 'bg'))}
        map={(map || []) as any}
      />
    </div>
  )
}
