// Онлайн стаи на паралелките — списък.
//  • Ръководството: „Отвори стаи“ (една, няколко или всички паралелки, период, повод) + всички стаи с отчет за днес.
//  • Колегите: стаите на паралелките, с които работят (класен, часове, терапия, ЕПЛР, ИФО, ЦОУД).
// Отворена стая = материали за цялата паралелка + личен линк за родителя на всяко дете (виж /rooms/[id]).

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MonitorSmartphone, ArrowRight, CircleAlert, MessageCircle, Eye, FileText } from 'lucide-react'
import { isClassRoomActive, isManagerRole, myClassIds, sofiaDayStartISO } from '@/lib/class-rooms'
import { todaySofia } from '@/lib/ores'
import OpenRoomsPanel from './OpenRoomsPanel'
export const dynamic = 'force-dynamic'

const fmt = (d: string) => d.split('-').reverse().join('.')

export default async function RoomsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (!profile || ['secretary', 'support'].includes(profile.role)) redirect('/dashboard')
  const isManager = isManagerRole(profile.role)
  const { data: year } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const { data: classes } = await supabase.from('classes').select('id, name').eq('academic_year_id', year?.id).order('name')
  const className: Record<string, string> = {}
  ;(classes || []).forEach((c: any) => { className[c.id] = c.name })

  const { data: roomsRaw, error } = await supabase.from('class_rooms')
    .select('id, class_id, from_date, to_date, reason, closed_at').order('from_date', { ascending: false })
  if (error) {
    return (
      <div className="p-4 md:p-8 max-w-5xl">
        <h1 className="text-xl md:text-2xl font-light text-[#0f2240] mb-4">Онлайн стаи на паралелките</h1>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">Стаите още не са подготвени в базата — пуснете SQL файла 2026-10-17_class_rooms.sql.</div>
      </div>
    )
  }

  let rooms = (roomsRaw || []) as any[]
  // паралелки от минали години (стари стаи) — само за имената
  const missing = Array.from(new Set(rooms.map(r => r.class_id).filter(id => !className[id])))
  if (missing.length) {
    const { data: old } = await supabase.from('classes').select('id, name').in('id', missing)
    ;(old || []).forEach((c: any) => { className[c.id] = c.name })
  }
  if (!isManager) {
    const mine = await myClassIds(supabase, profile.id, year?.id || '')
    rooms = rooms.filter(r => mine.has(r.class_id))
  }
  const today = todaySofia()
  const active = rooms.filter(r => isClassRoomActive(r, today)).sort((a, b) => (className[a.class_id] || '').localeCompare(className[b.class_id] || '', 'bg', { numeric: true }))
  const upcoming = rooms.filter(r => !r.closed_at && r.from_date > today)
  const past = rooms.filter(r => !active.includes(r) && !upcoming.includes(r))

  // отчет за днес по активните стаи
  const ids = active.map(r => r.id)
  const stats: Record<string, { kids: number; postsToday: number; posts: number; seenToday: number; seenEver: number; unread: number }> = {}
  ids.forEach(id => { stats[id] = { kids: 0, postsToday: 0, posts: 0, seenToday: 0, seenEver: 0, unread: 0 } })
  if (ids.length) {
    const dayStart = sofiaDayStartISO(today)
    const [{ data: mem }, { data: postsToday }, { data: msgs }, totals] = await Promise.all([
      supabase.from('class_room_members').select('room_id, first_visit_at, last_visit_at').in('room_id', ids).is('revoked_at', null),
      supabase.from('class_room_posts').select('room_id').in('room_id', ids).is('hidden_at', null).gte('created_at', dayStart),
      supabase.from('class_room_messages').select('room_id').in('room_id', ids).eq('from_parent', true).is('read_at', null).neq('kind', 'ok'),
      // общият брой публикации — по стая (броене, без да се теглят редовете)
      Promise.all(ids.map(id => supabase.from('class_room_posts').select('id', { count: 'exact', head: true }).eq('room_id', id).is('hidden_at', null))),
    ])
    ;(mem || []).forEach((m: any) => {
      const s = stats[m.room_id]
      s.kids++
      if (m.first_visit_at) s.seenEver++
      if (m.last_visit_at && Date.parse(m.last_visit_at) >= Date.parse(dayStart)) s.seenToday++
    })
    ;(postsToday || []).forEach((p: any) => { stats[p.room_id].postsToday++ })
    totals.forEach((r: any, i: number) => { stats[ids[i]].posts = r.count || 0 })
    ;(msgs || []).forEach((m: any) => { stats[m.room_id].unread++ })
  }
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay()
  const weekday = dow >= 1 && dow <= 5
  const quiet = active.filter(r => weekday && stats[r.id].postsToday === 0)

  const activeClassIds = rooms.filter(r => !r.closed_at && r.to_date >= today).map(r => r.class_id)

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-light text-[#0f2240] flex items-center gap-2"><MonitorSmartphone size={22} className="text-sky-600" /> Онлайн стаи на паралелките</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl font-light">
          Една стая за паралелката — учителите пускат материалите веднъж. Всяко дете има личен линк за родителя: виждаме кой е отворил стаята и кой пита, а отговорите вижда само този родител. Без видеовръзка — само материали и указания.
        </p>
      </div>

      {isManager && <OpenRoomsPanel classes={(classes || []) as any} busyClassIds={activeClassIds} />}

      {active.length > 0 && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Отворени сега ({active.length})</h2>
            {isManager && quiet.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                <CircleAlert size={13} /> Без публикация днес: {quiet.map(r => className[r.class_id] || '—').join(', ')}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map(r => {
              const s = stats[r.id]
              const noPost = weekday && s.postsToday === 0
              return (
                <Link key={r.id} href={`/rooms/${r.id}`}
                  className={`group block bg-white rounded-2xl border px-5 py-4 shadow-[0_1px_4px_rgba(15,34,64,0.06)] hover:shadow-md hover:-translate-y-0.5 transition-all ${s.unread ? 'border-amber-300' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-light text-[#0f2240]">Паралелка {className[r.class_id] || '—'}</span>
                    <ArrowRight size={15} className="ml-auto text-slate-300 group-hover:text-[#0f2240] transition-colors" />
                  </div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5">{fmt(r.from_date)} – {fmt(r.to_date)}{r.reason ? ` · ${r.reason}` : ''}</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12.5px]">
                    <span className={`inline-flex items-center gap-1 ${noPost ? 'text-amber-700' : 'text-slate-600'}`}><FileText size={13} /> днес {s.postsToday} · общо {s.posts}</span>
                    <span className="inline-flex items-center gap-1 text-slate-600" title="родители, отворили линка днес / някога"><Eye size={13} /> днес {s.seenToday} от {s.kids} · някога {s.seenEver}</span>
                    {s.unread > 0 && <span className="inline-flex items-center gap-1 text-amber-700"><MessageCircle size={13} /> {s.unread} {s.unread === 1 ? 'нов въпрос' : 'нови въпроса'}</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Предстоящи ({upcoming.length})</h2>
          <div className="flex flex-wrap gap-2">
            {upcoming.map(r => (
              <Link key={r.id} href={`/rooms/${r.id}`} className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[13px] text-slate-700 hover:border-[#0f2240]">
                {className[r.class_id] || '—'} · от {fmt(r.from_date)}
              </Link>
            ))}
          </div>
        </section>
      )}

      {active.length === 0 && upcoming.length === 0 && (
        <div className="mt-6 bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-500 font-light">
          {isManager ? 'Няма отворени стаи. Отворете от „Отвори стаи“ горе — например при грипна ваканция.' : 'Няма отворени стаи за вашите паралелки. Отварят се от ръководството — например при грипна ваканция.'}
        </div>
      )}

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Приключили — само преглед и хронология ({past.length})</h2>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {past.map((r, i) => (
              <Link key={r.id} href={`/rooms/${r.id}`} className={`flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-sky-50/50 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                <span className="w-28 text-slate-800">Паралелка {className[r.class_id] || '—'}</span>
                <span className="text-slate-500">{fmt(r.from_date)} – {fmt(r.to_date)}</span>
                {r.reason && <span className="text-slate-500 truncate">· {r.reason}</span>}
                {r.closed_at && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">затворена</span>}
                <ArrowRight size={13} className="ml-auto text-slate-300" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
