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
  // с час на съвета (event_time); ако колоната още я няма — без него
  const loadSets = (cols: string) => {
    let q = supabase.from('council_sets').select(cols)
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (!canManage) q = q.eq('is_archived', false)
    return q
  }
  let setsRes: any = await loadSets('id, title, event_date, event_time, is_archived, created_at')
  const timeOn = !setsRes.error
  if (!timeOn) setsRes = await loadSets('id, title, event_date, is_archived, created_at')
  const sets: any[] = setsRes.data || []

  const setIds = (sets || []).map((s: any) => s.id)
  const filesBySet: Record<string, any[]> = {}
  const acksBySet: Record<string, { staffId: string; at: string }[]> = {}
  let acksOn = false
  if (setIds.length > 0) {
    const [{ data: files }, acksRes] = await Promise.all([
      supabase.from('council_files')
        .select('id, set_id, name, description, path, size, mime_type, created_at')
        .in('set_id', setIds).order('created_at', { ascending: true }),
      supabase.from('council_acks').select('set_id, staff_id, acked_at').in('set_id', setIds),
    ])
    ;(files || []).forEach((f: any) => { (filesBySet[f.set_id] ||= []).push(f) })
    // ако таблицата council_acks още я няма — „Запознах се“ просто не се показва
    acksOn = !acksRes.error
    ;(acksRes.data || []).forEach((a: any) => { (acksBySet[a.set_id] ||= []).push({ staffId: a.staff_id, at: a.acked_at }) })
  }

  // за управата: кой трябва да се запознае (активните служители с достъп, без помощния персонал)
  const { data: people } = canManage
    ? await supabase.from('staff_profiles').select('id, first_name, last_name, role')
        .eq('is_active', true).not('user_id', 'is', null).neq('role', 'support').order('first_name')
    : { data: [] as any[] }

  const groups = (sets || []).map((s: any) => ({
    id: s.id, title: s.title, eventDate: s.event_date, eventTime: s.event_time ? String(s.event_time).slice(0, 5) : null, isArchived: s.is_archived,
    files: (filesBySet[s.id] || []).map((f: any) => ({
      id: f.id, name: f.name, description: f.description, path: f.path, size: f.size, mime: f.mime_type || '', createdAt: f.created_at,
    })),
    acks: acksBySet[s.id] || [],
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
          <p className="text-sm text-slate-500 mt-0.5">Документи за преглед преди педагогически съвет — прочетете ги и натиснете „Запознах се“</p>
        </div>
      </header>
      <CouncilClient
        groups={groups}
        canManage={canManage}
        meId={me.id}
        acksOn={acksOn}
        timeOn={timeOn}
        people={(people || []).map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))}
      />
    </div>
  )
}
