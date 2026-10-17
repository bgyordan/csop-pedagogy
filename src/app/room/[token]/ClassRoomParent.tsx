// Стаята на паралелката — страницата за РОДИТЕЛЯ (по личния линк на детето, без вход).
// Показва публикациите за цялата паралелка + тези само за това дете, с филтър по предмет.
// Под всяка публикация — само СОБСТВЕНИЯТ разговор на този родител с учителите (другите родители не се виждат).
// Отварянето се записва („видяно“) — най-много веднъж на 10 минути. Ако детето е и на лична ОРЕС стая — бутон към нея.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ExternalLink, Paperclip, User, DoorOpen } from 'lucide-react'
import { MSG_LABEL, todaySofia } from './lib'
import ParentReply from './ParentReply'
import { Shell } from './Shell'

type Member = { memberId: string; roomId: string; studentId: string; firstName: string; from_date: string; to_date: string; reason: string | null; className: string }

const fmt = (d: string) => d.split('-').reverse().join('.')

export default async function ClassRoomParent({ db, token, member, subject }: { db: SupabaseClient; token: string; member: Member; subject: string }) {
  const tenMin = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count: recent } = await db.from('class_room_visits').select('id', { count: 'exact', head: true })
    .eq('member_id', member.memberId).gte('visited_at', tenMin)
  if (!recent) {
    await db.from('class_room_visits').insert({ room_id: member.roomId, member_id: member.memberId })
    // кратко резюме в реда на детето — за отчетите на много стаи наведнъж
    const now = new Date().toISOString()
    const { data: m } = await db.from('class_room_members').select('first_visit_at, visit_count').eq('id', member.memberId).maybeSingle()
    await db.from('class_room_members').update({ first_visit_at: m?.first_visit_at || now, last_visit_at: now, visit_count: (m?.visit_count || 0) + 1 }).eq('id', member.memberId)
  }

  const { data: all } = await db.from('class_room_posts')
    .select('id, student_id, author_id, subject, body, link_url, file_path, file_name, material_id, created_at')
    .eq('room_id', member.roomId).is('hidden_at', null)
    .or(`student_id.is.null,student_id.eq.${member.studentId}`)
    .order('created_at', { ascending: false })
  const subjects = Array.from(new Set((all || []).map((p: any) => p.subject).filter(Boolean))) as string[]
  const posts = (all || []).filter((p: any) => !subject || p.subject === subject)

  const { data: msgs } = await db.from('class_room_messages')
    .select('id, post_id, from_parent, author_id, kind, body, created_at').eq('member_id', member.memberId).order('created_at')
  const authorIds = Array.from(new Set([...(posts || []), ...(msgs || [])].map((p: any) => p.author_id).filter(Boolean))) as string[]
  const { data: authors } = authorIds.length
    ? await db.from('staff_profiles').select('id, first_name, last_name').in('id', authorIds) : { data: [] as any[] }
  const who: Record<string, string> = {}
  ;(authors || []).forEach((a: any) => { who[a.id] = `${a.first_name} ${a.last_name}` })

  // временни линкове към файловете (качени в стаята или от библиотеката)
  const urls: Record<string, string> = {}
  const paths = posts.map((p: any) => p.file_path).filter(Boolean) as string[]
  if (paths.length) {
    const { data } = await db.storage.from('online-room').createSignedUrls(paths, 60 * 60 * 6)
    ;(data || []).forEach((d: any) => { if (d.signedUrl && d.path) urls[d.path] = d.signedUrl })
  }
  const matIds = posts.map((p: any) => p.material_id).filter(Boolean) as string[]
  if (matIds.length) {
    const { data: ms } = await db.from('materials').select('id, file_path').in('id', matIds)
    const byPath: Record<string, string> = {}
    ;(ms || []).forEach((m: any) => { byPath[m.file_path] = m.id })
    if (Object.keys(byPath).length) {
      const { data } = await db.storage.from('materials').createSignedUrls(Object.keys(byPath), 60 * 60 * 6)
      ;(data || []).forEach((d: any) => { if (d.signedUrl && d.path && byPath[d.path]) urls['m:' + byPath[d.path]] = d.signedUrl })
    }
  }
  const fileUrl = (p: any) => p.material_id ? urls['m:' + p.material_id] : (p.file_path ? urls[p.file_path] : undefined)
  const thread: Record<string, any[]> = {}
  ;(msgs || []).forEach((m: any) => { (thread[m.post_id] = thread[m.post_id] || []).push(m) })
  const when = (d: string) => new Date(d).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

  // лична ОРЕС стая на същото дете (ако е активна) — бутон към нея
  const today = todaySofia()
  const { data: ores } = await db.from('student_ores').select('room_token, from_date, to_date, room_closed_at')
    .eq('student_id', member.studentId).lte('from_date', today)
  const personal = (ores || []).find((o: any) => o.room_token && !o.room_closed_at && (!o.to_date || o.to_date >= today))

  const chip = (label: string, value: string) => (
    <a key={label} href={value ? `?s=${encodeURIComponent(value)}` : '?'}
      className={`px-3 py-1.5 rounded-full text-[13px] border ${subject === value ? 'border-[#0f2240] bg-white text-[#0f2240]' : 'border-slate-200 bg-white/60 text-slate-600'}`}>{label}</a>
  )

  return (
    <Shell>
      <h1 className="text-2xl font-normal text-[#0f2240]">Материали за {member.firstName}</h1>
      <p className="text-sm text-slate-500 mt-1">
        Паралелка {member.className}{member.reason ? ` · ${member.reason}` : ''} · от {fmt(member.from_date)} до {fmt(member.to_date)}. Най-новото е най-горе.
      </p>
      <p className="text-[13px] text-sky-800 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 mt-3">Запазете този линк (в Viber, като отметка или на началния екран) — с него влизате всеки път, без регистрация.</p>
      {personal && (
        <a href={`/room/${personal.room_token}`} className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 text-[15px]">
          <DoorOpen size={16} /> Лична стая на {member.firstName}
        </a>
      )}

      {subjects.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-5">
          {chip('Всичко', '')}
          {subjects.map(s => chip(s, s))}
        </div>
      )}

      <div className="mt-5">
        {posts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Учителите още не са публикували материали. Проверете отново по-късно.</div>
        ) : (
          <div className="space-y-3">
            {posts.map((p: any) => (
              <article key={p.id} className={`bg-white rounded-2xl border shadow-sm px-5 py-4 ${p.student_id ? 'border-violet-200' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500 mb-1.5">
                  <span>{new Date(p.created_at).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                  {p.author_id && who[p.author_id] ? <span>· {who[p.author_id]}</span> : null}
                  {p.subject && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-100 text-[12px]">{p.subject}</span>}
                  {p.student_id && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 border border-violet-100 text-[12px]"><User size={11} /> лично за {member.firstName}</span>}
                </div>
                {p.body && <p className="text-[16px] text-slate-800 whitespace-pre-line leading-relaxed">{p.body}</p>}
                <div className="flex flex-col gap-2 mt-2">
                  {p.link_url && (
                    <a href={p.link_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-[15px] hover:bg-sky-100 w-fit max-w-full">
                      <ExternalLink size={16} className="shrink-0" /> <span className="truncate">Отвори линка</span>
                    </a>
                  )}
                  {fileUrl(p) && (
                    <a href={fileUrl(p)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-[15px] hover:bg-slate-100 w-fit max-w-full">
                      <Paperclip size={16} className="shrink-0" /> <span className="truncate">{p.file_name || 'Файл'}</span>
                    </a>
                  )}
                </div>
                {(thread[p.id] || []).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {thread[p.id].map((m: any) => (
                      <div key={m.id} className={`text-[14px] px-3 py-2 rounded-xl ${m.from_parent ? 'bg-slate-50 text-slate-700' : 'bg-sky-50 text-slate-800 border border-sky-100'}`}>
                        <span className="text-[12px] text-slate-500">{m.from_parent ? 'Вие' : (who[m.author_id] || 'Учител')} · {when(m.created_at)}</span>
                        <div className="whitespace-pre-line">{[MSG_LABEL[m.kind], m.body].filter(Boolean).join(' — ')}</div>
                      </div>
                    ))}
                  </div>
                )}
                <ParentReply token={token} postId={p.id} />
              </article>
            ))}
          </div>
        )}
      </div>
      <p className="text-[12px] text-slate-400 mt-8">Този линк е личен — не го споделяйте. Въпросите ви вижда само учителят. Линкът спира да работи, когато стаята се затвори.</p>
    </Shell>
  )
}
