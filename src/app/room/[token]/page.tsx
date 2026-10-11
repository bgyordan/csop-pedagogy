// Онлайн стая — страницата за РОДИТЕЛЯ. Без вход: достъпът е личният линк (/room/<token>).
// Работи само докато ОРЕС периодът е активен. Показва малкото име на детето, публикациите (без скритите),
// файловете (с временни линкове) и нишката въпроси/отговори под всяка публикация.
// Всяко отваряне се записва („видяно от родителя“) — най-много веднъж на 10 минути.
// Данните се четат на сървъра със service-role клиента — браузърът не получава ключ.

import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { MonitorSmartphone, ExternalLink, Paperclip, Lock } from 'lucide-react'
import { activeOresByToken, MSG_LABEL } from './lib'
import ParentReply from './ParentReply'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Онлайн стая — ЦСОП Варна', robots: { index: false, follow: false } }

function Closed() {
  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Lock size={28} className="mx-auto mb-3 text-slate-300" />
        <p className="text-slate-700">Стаята не е активна.</p>
        <p className="text-sm text-slate-500 mt-1">Линкът е изтекъл или е грешен. Обърнете се към класния ръководител.</p>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
        <div className="flex items-center gap-2 text-[12px] uppercase tracking-widest text-slate-500 mb-4">
          <MonitorSmartphone size={15} /> ЦСОП Варна · Онлайн стая
        </div>
        {children}
      </div>
    </div>
  )
}

export default async function RoomPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = createAdminClient()
  const ores = await activeOresByToken(db, token)
  if (!ores) return <Closed />

  // посещение (за „видяно от родителя“) — не по-често от веднъж на 10 минути
  const tenMin = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count: recent } = await db.from('online_room_visits').select('id', { count: 'exact', head: true })
    .eq('ores_id', ores.id).gte('visited_at', tenMin)
  if (!recent) await db.from('online_room_visits').insert({ ores_id: ores.id })

  const { data: posts } = await db.from('online_room_posts')
    .select('id, author_id, body, link_url, file_path, file_name, material_id, created_at')
    .eq('ores_id', ores.id).is('hidden_at', null).order('created_at', { ascending: false })
  const { data: msgs } = await db.from('online_room_messages')
    .select('id, post_id, from_parent, author_id, kind, body, created_at').eq('ores_id', ores.id).order('created_at')
  const authorIds = Array.from(new Set([...(posts || []), ...(msgs || [])].map((p: any) => p.author_id).filter(Boolean))) as string[]
  const { data: authors } = authorIds.length
    ? await db.from('staff_profiles').select('id, first_name, last_name').in('id', authorIds) : { data: [] as any[] }
  const who: Record<string, string> = {}
  ;(authors || []).forEach((a: any) => { who[a.id] = `${a.first_name} ${a.last_name}` })
  const paths = (posts || []).map((p: any) => p.file_path).filter(Boolean) as string[]
  const urls: Record<string, string> = {}     // ключ: file_path или „m:<material_id>“
  if (paths.length) {
    const { data } = await db.storage.from('online-room').createSignedUrls(paths, 60 * 60 * 6)
    ;(data || []).forEach((d: any) => { if (d.signedUrl && d.path) urls[d.path] = d.signedUrl })
  }
  // материали от библиотеката — файлът е в кофата materials
  const matIds = (posts || []).map((p: any) => p.material_id).filter(Boolean) as string[]
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
  const fmt = (d: string) => d.split('-').reverse().join('.')
  const when = (d: string) => new Date(d).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

  return (
    <Shell>
      <h1 className="text-2xl font-normal text-[#0f2240]">Материали за {ores.firstName}</h1>
      <p className="text-sm text-slate-500 mt-1">Обучение от разстояние · от {fmt(ores.from_date)}{ores.to_date ? ` до ${fmt(ores.to_date)}` : ''}. Най-новото е най-горе.</p>
      <p className="text-[13px] text-sky-800 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2 mt-3 mb-6">Запазете този линк (в Viber, като отметка или на началния екран) — с него влизате всеки път, без регистрация.</p>

      {(posts || []).length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Учителите още не са публикували материали. Проверете отново по-късно.</div>
      ) : (
        <div className="space-y-3">
          {(posts || []).map((p: any) => (
            <article key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
              <div className="text-[13px] text-slate-500 mb-1.5">
                {new Date(p.created_at).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                {p.author_id && who[p.author_id] ? <> · {who[p.author_id]}</> : null}
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
      <p className="text-[12px] text-slate-400 mt-8">Този линк е личен — не го споделяйте. Спира да работи, когато обучението от разстояние приключи.</p>
    </Shell>
  )
}
