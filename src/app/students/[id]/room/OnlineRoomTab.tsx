'use client'

// Таб „Онлайн стая“ в досието — само докато детето е на ОРЕС.
// Учителите пускат указания, линк и по желание файл; родителят ги вижда по личния линк (/room/<token>).

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Send, Link2, Paperclip, Trash2, Copy, Check, MonitorSmartphone, X, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

// Родителите са извън сградата → линкът винаги е през външния адрес
const PUBLIC_BASE = process.env.NEXT_PUBLIC_PUBLIC_URL || 'https://out.csop-varna.bg'
const MAX_MB = 20

type Post = { id: string; author_id: string | null; body: string | null; link_url: string | null; file_path: string | null; file_name: string | null; created_at: string }

export default function OnlineRoomTab({ studentId, ores, meId, isManager }: {
  studentId: string; ores: { id: string; from_date: string; to_date: string | null; room_token: string }; meId: string; isManager: boolean
}) {
  const supabase = createClient()
  const { toast } = useToast()
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const parentUrl = `${PUBLIC_BASE}/room/${ores.room_token}`
  const fmt = (d: string) => d.split('-').reverse().join('.')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('online_room_posts')
      .select('id, author_id, body, link_url, file_path, file_name, created_at')
      .eq('ores_id', ores.id).order('created_at', { ascending: false })
    if (error) { setErr('Онлайн стаята още не е подготвена в базата — пуснете SQL файла 2026-10-11_online_room.sql.'); return }
    setPosts((data || []) as Post[])
    const ids = Array.from(new Set((data || []).map((p: any) => p.author_id).filter(Boolean))) as string[]
    if (ids.length) {
      const { data: st } = await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', ids)
      const n: Record<string, string> = {}
      ;(st || []).forEach((s: any) => { n[s.id] = `${s.first_name} ${s.last_name}` })
      setNames(n)
    }
  }, [ores.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function copyLink() {
    try { await navigator.clipboard.writeText(parentUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { toast('Копирайте линка ръчно', 'error') }
  }

  async function publish() {
    const url = link.trim()
    if (!body.trim() && !url && !file) { toast('Напишете указания, добавете линк или файл', 'error'); return }
    if (url && !/^https?:\/\//i.test(url)) { toast('Линкът трябва да започва с http:// или https://', 'error'); return }
    if (file && file.size > MAX_MB * 1024 * 1024) { toast(`Файлът е над ${MAX_MB} MB`, 'error'); return }
    setBusy(true)
    let file_path: string | null = null
    if (file) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      file_path = `${ores.id}/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('online-room').upload(file_path, file, { contentType: file.type || undefined })
      if (up.error) { setBusy(false); toast('Грешка при качване: ' + up.error.message, 'error'); return }
    }
    const { error } = await supabase.from('online_room_posts').insert({
      ores_id: ores.id, student_id: studentId, author_id: meId,
      body: body.trim() || null, link_url: url || null, file_path, file_name: file?.name || null,
    })
    setBusy(false)
    if (error) {
      if (file_path) await supabase.storage.from('online-room').remove([file_path])
      toast('Грешка: ' + error.message, 'error'); return
    }
    setBody(''); setLink(''); setFile(null); if (fileRef.current) fileRef.current.value = ''
    toast('Публикувано — родителят ще го види по линка')
    load()
  }

  async function remove(p: Post) {
    if (!confirm('Да се изтрие ли публикацията? Родителят вече няма да я вижда.')) return
    if (p.file_path) await supabase.storage.from('online-room').remove([p.file_path])
    const { error } = await supabase.from('online_room_posts').delete().eq('id', p.id)
    if (error) { toast(error.message, 'error'); return }
    setPosts(prev => (prev || []).filter(x => x.id !== p.id))
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage.from('online-room').createSignedUrl(path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (err) return <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">{err}</div>

  return (
    <div className="space-y-4">
      {/* Линкът за родителя */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <MonitorSmartphone size={16} className="text-sky-600" />
          <span className="text-sm text-slate-800">Онлайн стая · ОРЕС от {fmt(ores.from_date)}{ores.to_date ? ` до ${fmt(ores.to_date)}` : ''}</span>
          <span className="text-[12px] text-slate-500">— родителят вижда публикациите по този линк, без регистрация</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="flex-1 min-w-0 truncate text-[13px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">{parentUrl}</code>
          <button type="button" onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copied ? 'Копирано' : 'Копирай'}
          </button>
        </div>
        <p className="text-[11.5px] text-slate-400 mt-2">Изпратете линка на родителя (Viber, имейл). Спира да работи, когато ОРЕС приключи.</p>
      </div>

      {/* Нова публикация */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 space-y-3">
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Указания за родителя — какво да направят днес, как, колко време…"
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0f2240] resize-y" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] px-3 py-2 border border-slate-200 rounded-xl focus-within:border-[#0f2240]">
            <Link2 size={14} className="text-slate-400 shrink-0" />
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="Линк (клип, файл в Drive, видеовръзка) — по желание"
              className="flex-1 min-w-0 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none" />
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-700 max-w-[260px]">
              <Paperclip size={13} /> <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }} className="text-slate-400 hover:text-slate-700"><X size={13} /></button>
            </span>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
              <Paperclip size={14} /> Файл
            </button>
          )}
          <button type="button" onClick={publish} disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Публикувай
          </button>
        </div>
      </div>

      {/* Публикациите — най-новите горе */}
      {posts === null ? (
        <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>
      ) : posts.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-400">Още няма публикации.</div>
      ) : (
        <div className="space-y-2">
          {posts.map(p => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 shadow-[0_1px_4px_rgba(15,34,64,0.06)]">
              <div className="flex items-center gap-2 text-[12px] text-slate-500 mb-1">
                <span>{new Date(p.created_at).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-slate-300">·</span>
                <span>{(p.author_id && names[p.author_id]) || '—'}</span>
                {(p.author_id === meId || isManager) && (
                  <button type="button" onClick={() => remove(p)} title="Изтрий" className="ml-auto p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                )}
              </div>
              {p.body && <p className="text-[14px] text-slate-800 whitespace-pre-line leading-relaxed">{p.body}</p>}
              <div className="flex flex-wrap gap-2 mt-1.5">
                {p.link_url && <a href={p.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-sky-700 hover:underline max-w-full"><ExternalLink size={13} /> <span className="truncate">{p.link_url}</span></a>}
                {p.file_path && <button type="button" onClick={() => openFile(p.file_path!)} className="inline-flex items-center gap-1 text-[13px] text-sky-700 hover:underline"><Paperclip size={13} /> {p.file_name || 'файл'}</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
