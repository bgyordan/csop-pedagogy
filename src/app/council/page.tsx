import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { ClipboardCheck } from 'lucide-react'
import CouncilClient from './CouncilClient'
export const dynamic = 'force-dynamic'

export default async function CouncilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const canManage = ['admin', 'director', 'zdud'].includes(me.role || '')

  // комплекти (архивните само за управляващите)
  let setQuery = supabase.from('council_sets')
    .select('id, title, event_date, is_archived, created_at')
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (!canManage) setQuery = setQuery.eq('is_archived', false)
  const { data: sets } = await setQuery

  const setIds = (sets || []).map((s: any) => s.id)
  let filesBySet: Record<string, any[]> = {}
  if (setIds.length > 0) {
    const { data: files } = await supabase.from('council_files')
      .select('id, set_id, name, description, path, size, created_at')
      .in('set_id', setIds).order('created_at', { ascending: true })
    ;(files || []).forEach((f: any) => { (filesBySet[f.set_id] = filesBySet[f.set_id] || []).push(f) })
  }

  const groups = (sets || []).map((s: any) => ({
    id: s.id, title: s.title, eventDate: s.event_date, isArchived: s.is_archived,
    files: (filesBySet[s.id] || []).map((f: any) => ({ id: f.id, name: f.name, description: f.description, path: f.path, size: f.size })),
  }))

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 shadow-sm text-blue-600">
          <ClipboardCheck size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Материали за съгласуване</h1>
          <p className="text-sm text-slate-500 mt-0.5">Документи за преглед преди педагогически съвет</p>
        </div>
      </header>
      <CouncilClient groups={groups} canManage={canManage} />
    </div>
  )
}
