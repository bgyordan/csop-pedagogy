import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wrench } from 'lucide-react'
import FacilitiesClient from './FacilitiesClient'
import { isFacilityHandler } from './lib'
import type { Issue, IssueEvent } from './lib'
export const dynamic = 'force-dynamic'

// Материална база: колегите подават сигнали за проблеми в помещенията;
// деловодството и управата ги движат (Нов → Приет → Поправено / Не може) с отговор към колегата.
export default async function FacilitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id, role, position, first_name, last_name').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const handler = isFacilityHandler(me)

  const { data: raw, error } = await supabase.from('facility_issues').select('*').order('created_at', { ascending: false }).range(0, 999)
  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Материалната база още не е включена. Пуснете SQL файла <b>2026-10-05_facilities.sql</b>.
        </div>
      </div>
    )
  }
  const all = (raw || []) as Issue[]
  // управата вижда всичко; колегата — своите (+ отворените, за да не подава два пъти)
  const issues = handler ? all : all.filter(i => i.reporter_id === me.id)
  const openAll = all.filter(i => i.status === 'new' || i.status === 'accepted')
    .map(i => ({ id: i.id, room: i.room, category: i.category, description: i.description }))
  const rooms = Array.from(new Set(all.map(i => i.room.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'bg', { numeric: true }))

  const ids = issues.map(i => i.id)
  const [{ data: ev }, { data: staff }] = await Promise.all([
    ids.length ? supabase.from('facility_issue_events').select('*').in('issue_id', ids).order('created_at') : Promise.resolve({ data: [] as any[] }),
    supabase.from('staff_profiles').select('id, first_name, last_name'),
  ])
  const people: Record<string, string> = {}
  ;(staff || []).forEach((s: any) => { people[s.id] = `${s.first_name} ${s.last_name}` })

  const paths = issues.map(i => i.photo_path).filter(Boolean) as string[]
  const photos: Record<string, string> = {}
  if (paths.length) {
    const { data } = await supabase.storage.from('facilities').createSignedUrls(paths, 60 * 60 * 6)
    ;(data || []).forEach((d: any) => { if (d.signedUrl && d.path) photos[d.path] = d.signedUrl })
  }

  // кои мои сигнали са с нов отговор (преди да ги отбележим като видени)
  const unseen = issues.filter(i => i.reporter_id === me.id && i.status !== 'new' && (!i.reporter_seen_at || i.reporter_seen_at < i.updated_at)).map(i => i.id)
  if (unseen.length) await supabase.rpc('facility_mark_seen')

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-700"><Wrench size={20} /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Материална база</h1>
          <p className="text-sm text-slate-500 mt-0.5">{handler ? 'Сигнали за проблеми в помещенията — от колегите' : 'Има ли нещо счупено в помещението ти? Подай сигнал — ще получиш отговор тук.'}</p>
        </div>
      </header>
      <FacilitiesClient meId={me.id} handler={handler} issues={issues} events={(ev || []) as IssueEvent[]}
        people={people} photos={photos} rooms={rooms} openAll={openAll} unseen={unseen} />
    </div>
  )
}
