import Link from 'next/link'
import { Users, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isClassRoomActive, isManagerRole, myClassIds, sofiaDayStartISO } from '@/lib/class-rooms'
import { todaySofia } from '@/lib/ores'

// Стаи на паралелките на таблото (грипна ваканция):
//  • колегата — отворените стаи на неговите паралелки и новите въпроси от родители към НЕГОВИТЕ публикации;
//  • ръководството — всички отворени стаи, коя е без публикация днес (в делничен ден) и въпросите без прочит.
// Ако няма отворени стаи (или таблицата още я няма) — нищо.
export default async function ClassRoomStrip({ profile, currentYearId }: { profile: { id: string; role: string }; currentYearId: string }) {
  if (['secretary', 'support'].includes(profile.role)) return null
  const supabase = await createClient()
  const today = todaySofia()
  const { data: rooms, error } = await supabase.from('class_rooms')
    .select('id, class_id, from_date, to_date, closed_at, class:classes(name)').lte('from_date', today).gte('to_date', today).is('closed_at', null)
  if (error || !rooms?.length) return null
  const manager = isManagerRole(profile.role)
  let list = (rooms as any[]).filter(r => isClassRoomActive(r, today))
  if (!manager) {
    const mine = await myClassIds(supabase, profile.id, currentYearId)
    list = list.filter(r => mine.has(r.class_id))
  }
  if (!list.length) return null
  list.sort((a, b) => (a.class?.name || '').localeCompare(b.class?.name || '', 'bg', { numeric: true }))

  const ids = list.map(r => r.id)
  const [{ data: posts }, { data: msgs }] = await Promise.all([
    supabase.from('class_room_posts').select('room_id').in('room_id', ids).is('hidden_at', null).gte('created_at', sofiaDayStartISO(today)),
    supabase.from('class_room_messages').select('room_id, post_id').in('room_id', ids).eq('from_parent', true).is('read_at', null).neq('kind', 'ok'),
  ])
  const todayPosts: Record<string, number> = {}
  ;(posts || []).forEach((p: any) => { todayPosts[p.room_id] = (todayPosts[p.room_id] || 0) + 1 })
  // колегата вижда въпросите към СВОИТЕ публикации; ръководството — всички
  let mineOnly: Set<string> | null = null
  if (!manager && (msgs || []).length) {
    const pids = Array.from(new Set((msgs || []).map((m: any) => m.post_id)))
    const { data: own } = await supabase.from('class_room_posts').select('id').in('id', pids).eq('author_id', profile.id)
    mineOnly = new Set((own || []).map((p: any) => p.id))
  }
  const unread: Record<string, number> = {}
  ;(msgs || []).forEach((m: any) => { if (manager || mineOnly?.has(m.post_id)) unread[m.room_id] = (unread[m.room_id] || 0) + 1 })
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay()
  const weekday = dow >= 1 && dow <= 5

  return (
    <div className={`px-5 py-3 rounded-2xl border shadow-sm ${totalUnread ? 'border-amber-300 bg-amber-50/60' : 'border-sky-200 bg-sky-50/60'}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
        <Users size={16} className="text-sky-700" /> Онлайн стаи на паралелките ({list.length})
        {totalUnread > 0 && <span className="text-[12px] px-2 py-0.5 rounded-full bg-amber-500 text-white">{totalUnread} {totalUnread === 1 ? 'нов въпрос' : 'нови въпроса'} от родители</span>}
        <Link href="/rooms" className="ml-auto text-[12px] text-sky-800 hover:underline">всички стаи</Link>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {list.map(r => {
          const quiet = weekday && !todayPosts[r.id]
          return (
            <Link key={r.id} href={`/rooms/${r.id}`} className="inline-flex items-center gap-1 text-[13px] text-slate-700 hover:text-[#0f2240] hover:underline">
              Паралелка {r.class?.name || '—'}
              {manager && <span className={quiet ? 'text-amber-700' : 'text-slate-500'}> · {quiet ? 'без публикация днес' : `днес ${todayPosts[r.id]}`}</span>}
              {unread[r.id] > 0 && <span className="text-amber-700"> · {unread[r.id]} въпрос{unread[r.id] > 1 ? 'а' : ''}</span>}
              <ArrowRight size={12} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
