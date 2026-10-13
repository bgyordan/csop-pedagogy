'use client'

// Таб „Онлайн стая“ в досието.
//  • Детето не е на ОРЕС → обяснение + „Започни ОРЕС“ (за управата).
//  • Активен ОРЕС → линк за родителя, нова публикация (указания, линк, файл), публикациите с „видяно от родителя“
//    и нишката с въпросите на родителя + отговор.
//  • Минали ОРЕС периоди → само преглед. Нищо не се трие — публикация може само да се скрие от родителя.
//  • „Хронология“ → Word за целия период (доказателство за ОРЕС).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Send, Link2, Paperclip, Copy, Check, MonitorSmartphone, X, ExternalLink, EyeOff, Eye, FileDown, Play, MessageCircle, CircleCheck, Square, RotateCcw, Library, Search, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { generateOresChronology } from '@/lib/docx-ores'
import { isOresActive, todaySofia } from '@/lib/ores'
import { deleteTestOres } from './actions'

// Линкът за родителя — през основния адрес (is.csop-varna.bg работи и отвън през Cloudflare)
const PUBLIC_BASE = process.env.NEXT_PUBLIC_PUBLIC_URL || 'https://is.csop-varna.bg'
const MAX_MB = 20
const MSG_LABEL: Record<string, string> = { ok: 'Разбрахме', unclear: 'Не разбирам — моля, обяснете', resend: 'Моля, изпратете материала отново', text: '' }

export type OresRow = { id: string; from_date: string; to_date: string | null; reason: string | null; room_token?: string | null; room_closed_at?: string | null; to_date_before_close?: string | null }
type Post = { id: string; author_id: string | null; body: string | null; link_url: string | null; file_path: string | null; file_name: string | null; created_at: string; hidden_at: string | null; hidden_by: string | null; material_id: string | null }
type Msg = { id: string; post_id: string; from_parent: boolean; author_id: string | null; kind: string; body: string | null; read_at: string | null; created_at: string }

const fmt = (d: string) => d.split('-').reverse().join('.')
const when = (d: string) => new Date(d).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function OnlineRoomTab({ studentId, studentName, oresList, meId, isManager, canStart, isAdmin = false }: {
  studentId: string; studentName: string; oresList: OresRow[]; meId: string; isManager: boolean; canStart: boolean; isAdmin?: boolean
}) {
  const today = todaySofia()
  const isActive = (o: OresRow) => isOresActive(o, today)
  const periods = useMemo(() => [...oresList].filter(o => o.room_token).sort((a, b) => b.from_date.localeCompare(a.from_date)), [oresList])
  const active = periods.find(isActive) || null
  const [selId, setSelId] = useState<string | null>(active?.id || periods[0]?.id || null)
  const sel = periods.find(p => p.id === selId) || null

  return (
    <div className="space-y-4">
      {!active && <StartOres studentId={studentId} canStart={canStart} hasPast={periods.length > 0} />}

      {periods.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {periods.map(p => (
            <button key={p.id} type="button" onClick={() => setSelId(p.id)}
              className={`px-3 py-1.5 rounded-lg text-[13px] transition-all ${p.id === selId ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
              {fmt(p.from_date)} – {p.to_date ? fmt(p.to_date) : '…'}{isActive(p) ? ' · сега' : ''}
            </button>
          ))}
        </div>
      )}

      {sel && <Room key={sel.id} studentId={studentId} studentName={studentName} ores={sel} live={isActive(sel)} meId={meId} isManager={isManager} isAdmin={isAdmin} />}
    </div>
  )
}

// ── Детето не е на ОРЕС: обяснение и бутон за започване ──
function StartOres({ studentId, canStart, hasPast }: { studentId: string; canStart: boolean; hasPast: boolean }) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' }))
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function start() {
    if (!from) return
    if (to && to < from) { toast('Крайната дата е преди началната', 'error'); return }
    setBusy(true)
    const { error } = await supabase.from('student_ores').insert({ student_id: studentId, from_date: from, to_date: to || null, reason: reason.trim() || null })
    setBusy(false)
    if (error) { toast('Грешка: ' + error.message, 'error'); return }
    toast('ОРЕС е започнат — стаята е отворена')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <MonitorSmartphone size={18} className="text-slate-400" />
        <div className="flex-1 min-w-[220px]">
          <p className="text-sm text-slate-800">Детето не е на обучение от разстояние (ОРЕС).</p>
          <p className="text-[12.5px] text-slate-500">Щом се започне ОРЕС, тук се отваря онлайн стаята — материали и указания за родителя по личен линк.{hasPast ? ' По-долу са минали периоди.' : ''}</p>
        </div>
        {canStart && !open && (
          <button type="button" onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
            <Play size={14} /> Започни ОРЕС
          </button>
        )}
        {!canStart && <span className="text-[12px] text-slate-400">ОРЕС се започва от ръководството.</span>}
      </div>
      {open && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-slate-500">От<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm" /></label>
          <label className="text-[12px] text-slate-500">До (по желание)<input type="date" value={to} onChange={e => setTo(e.target.value)} className="block mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm" /></label>
          <label className="text-[12px] text-slate-500 flex-1 min-w-[200px]">Основание (по желание)<input value={reason} onChange={e => setReason(e.target.value)} placeholder="напр. заявление на родителя, медицински причини" className="block w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm" /></label>
          <button type="button" onClick={start} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Започни
          </button>
          <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={16} /></button>
        </div>
      )}
    </div>
  )
}

// ── Стаята за един ОРЕС период ──
function Room({ studentId, studentName, ores, live, meId, isManager, isAdmin }: {
  studentId: string; studentName: string; ores: OresRow; live: boolean; meId: string; isManager: boolean; isAdmin: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const [closing, setClosing] = useState(false)
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [visits, setVisits] = useState<string[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [picker, setPicker] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const parentUrl = `${PUBLIC_BASE}/room/${ores.room_token}`

  const load = useCallback(async () => {
    const [ps, ms, vs] = await Promise.all([
      supabase.from('online_room_posts').select('id, author_id, body, link_url, file_path, file_name, created_at, hidden_at, hidden_by, material_id')
        .eq('ores_id', ores.id).order('created_at', { ascending: false }),
      supabase.from('online_room_messages').select('id, post_id, from_parent, author_id, kind, body, read_at, created_at').eq('ores_id', ores.id).order('created_at'),
      supabase.from('online_room_visits').select('visited_at').eq('ores_id', ores.id).order('visited_at'),
    ])
    if (ps.error || ms.error) { setErr('Онлайн стаята още не е подготвена в базата — пуснете SQL файловете 2026-10-11_online_room*.sql.'); return }
    setPosts((ps.data || []) as Post[])
    setMsgs((ms.data || []) as Msg[])
    setVisits((vs.data || []).map((v: any) => v.visited_at))
    const ids = Array.from(new Set([...(ps.data || []), ...(ms.data || [])].flatMap((p: any) => [p.author_id, p.hidden_by]).filter(Boolean))) as string[]
    if (ids.length) {
      const { data: st } = await supabase.from('staff_profiles').select('id, first_name, last_name').in('id', ids)
      const n: Record<string, string> = {}
      ;(st || []).forEach((s: any) => { n[s.id] = `${s.first_name} ${s.last_name}` })
      setNames(n)
    }
    // въпросите на родителя — отбелязани като прочетени (за картата на таблото)
    const unread = (ms.data || []).filter((m: any) => m.from_parent && !m.read_at).map((m: any) => m.id)
    if (unread.length) await supabase.from('online_room_messages').update({ read_at: new Date().toISOString() }).in('id', unread)
  }, [ores.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // първото отваряне на линка след публикуването = „видяно от родителя“
  const seenAt = (p: Post) => visits.find(v => v >= p.created_at) || null

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
    if (error) { toast('Грешка: ' + error.message, 'error'); return }
    setBody(''); setLink(''); setFile(null); if (fileRef.current) fileRef.current.value = ''
    toast('Публикувано — родителят ще го види по линка')
    load()
  }

  // материал от библиотеката → публикация (указанията от полето, ако има, иначе описанието на материала)
  async function pickMaterial(m: any) {
    const { error } = await supabase.from('online_room_posts').insert({
      ores_id: ores.id, student_id: studentId, author_id: meId,
      body: body.trim() || [m.title, m.description].filter(Boolean).join(' — '), link_url: null,
      file_path: null, file_name: m.file_name, material_id: m.id,
    })
    if (error) { toast('Грешка: ' + error.message, 'error'); return }
    setBody(''); setPicker(false)
    toast('Материалът е публикуван за родителя')
    load()
  }

  async function toggleHidden(p: Post) {
    const hide = !p.hidden_at
    if (hide && !confirm('Да се скрие ли от родителя? В хронологията остава.')) return
    const { error } = await supabase.from('online_room_posts')
      .update(hide ? { hidden_at: new Date().toISOString(), hidden_by: meId } : { hidden_at: null, hidden_by: null }).eq('id', p.id)
    if (error) { toast(error.message, 'error'); return }
    load()
  }

  async function reply(postId: string, text: string) {
    const { error } = await supabase.from('online_room_messages').insert({ post_id: postId, ores_id: ores.id, from_parent: false, author_id: meId, kind: 'text', body: text.slice(0, 500) })
    if (error) { toast('Грешка: ' + error.message, 'error'); return false }
    load(); return true
  }

  async function openFile(p: Post) {
    let bucket = 'online-room', path = p.file_path
    if (p.material_id) {   // материал от библиотеката — файлът е в кофата materials
      const { data: m } = await supabase.from('materials').select('file_path').eq('id', p.material_id).maybeSingle()
      if (m?.file_path) { bucket = 'materials'; path = m.file_path }
    }
    if (!path) { toast('Файлът вече не е наличен', 'error'); return }
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  // „Приключи ОРЕС“ — крайна дата днес, линкът спира веднага; „Отвори отново“ връща предишната крайна дата
  async function closeRoom() {
    if (!confirm('Да се приключи ли ОРЕС днес? Линкът на родителя спира веднага. Хронологията остава.')) return
    setClosing(true)
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
    const { error } = await supabase.from('student_ores').update({
      room_closed_at: new Date().toISOString(), room_closed_by: meId || null,
      to_date_before_close: ores.to_date, to_date: !ores.to_date || ores.to_date > today ? today : ores.to_date,
    }).eq('id', ores.id)
    setClosing(false)
    if (error) { toast('Грешка: ' + error.message, 'error'); return }
    toast('ОРЕС е приключен — стаята е затворена')
    router.refresh()
  }
  async function reopenRoom() {
    if (!confirm('Да се отвори ли стаята отново? Линкът на родителя ще работи пак.')) return
    setClosing(true)
    const { error } = await supabase.from('student_ores').update({
      room_closed_at: null, room_closed_by: null, to_date: ores.to_date_before_close ?? null, to_date_before_close: null,
    }).eq('id', ores.id)
    setClosing(false)
    if (error) { toast('Грешка: ' + error.message, 'error'); return }
    toast('Стаята е отворена отново')
    router.refresh()
  }

  // само за администратор: тестов ОРЕС се маха изцяло (истинските се приключват, не се трият)
  async function removeTest() {
    const period = `${fmt(ores.from_date)}${ores.to_date ? ` – ${fmt(ores.to_date)}` : ''}`
    if (!confirm(`Изтриване на ТЕСТОВ ОРЕС на ${studentName} (${period})?\n\nТрият се и всички публикации, въпроси на родителя и файлове в стаята. Не може да се върне.\n\nЗа истински ОРЕС използвайте „Приключи ОРЕС“.`)) return
    setClosing(true)
    const res = await deleteTestOres(ores.id)
    setClosing(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast('Тестовият ОРЕС е изтрит')
    router.refresh()
  }

  async function exportChronology() {
    if (!posts) return
    setExporting(true)
    try {
      await generateOresChronology({
        studentName, from: ores.from_date, to: ores.to_date, reason: ores.reason,
        visits: visits.length,
        posts: [...posts].reverse().map(p => ({
          at: p.created_at, author: (p.author_id && names[p.author_id]) || '—',
          body: p.body || '', link: p.link_url || '', file: p.file_name || '',
          seen: seenAt(p), hidden: p.hidden_at ? `скрита от родителя ${when(p.hidden_at)}${p.hidden_by && names[p.hidden_by] ? ` (${names[p.hidden_by]})` : ''}` : '',
          thread: msgs.filter(m => m.post_id === p.id).map(m => ({
            at: m.created_at, who: m.from_parent ? 'Родител' : ((m.author_id && names[m.author_id]) || 'Учител'),
            text: [MSG_LABEL[m.kind], m.body].filter(Boolean).join(' — '),
          })),
        })),
      })
    } catch { toast('Грешка при генериране', 'error') }
    setExporting(false)
  }

  if (err) return <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">{err}</div>

  return (
    <div className="space-y-4">
      {/* Периодът, линкът за родителя и хронологията */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <MonitorSmartphone size={16} className={live ? 'text-sky-600' : 'text-slate-400'} />
          <span className="text-sm text-slate-800">ОРЕС от {fmt(ores.from_date)}{ores.to_date ? ` до ${fmt(ores.to_date)}` : ''}</span>
          {live ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">стаята е отворена</span>
                : <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{ores.room_closed_at ? `приключен на ${when(ores.room_closed_at)}` : 'приключил'} — само преглед</span>}
          <span className="text-[12px] text-slate-500">· родителят е отварял линка {visits.length} пъти</span>
          <button type="button" onClick={exportChronology} disabled={exporting || !posts}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240] disabled:opacity-50">
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Хронология
          </button>
          {isManager && live && (
            <button type="button" onClick={closeRoom} disabled={closing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-[13px] text-rose-700 hover:bg-rose-50 disabled:opacity-50">
              {closing ? <Loader2 size={13} className="animate-spin" /> : <Square size={12} />} Приключи ОРЕС
            </button>
          )}
          {isManager && !live && ores.room_closed_at && (
            <button type="button" onClick={reopenRoom} disabled={closing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240] disabled:opacity-50">
              {closing ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Отвори отново
            </button>
          )}
          {isAdmin && (
            <button type="button" onClick={removeTest} disabled={closing} title="Само за тестови записи — изтрива ОРЕС и цялата стая"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] text-slate-400 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50">
              <Trash2 size={13} /> Изтрий като тестов
            </button>
          )}
        </div>
        {live && <>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-[13px] px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">{parentUrl}</code>
            <button type="button" onClick={copyLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copied ? 'Копирано' : 'Копирай'}
            </button>
          </div>
          <p className="text-[11.5px] text-slate-400 mt-2">Изпратете линка на родителя (Viber, имейл). Спира да работи, когато ОРЕС приключи.</p>
        </>}
      </div>

      {/* Нова публикация — само докато стаята е отворена */}
      {live && (
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
            <button type="button" onClick={() => setPicker(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 text-[13px] text-emerald-800 hover:bg-emerald-50">
              <Library size={14} /> От библиотеката
            </button>
            <button type="button" onClick={publish} disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Публикувай
            </button>
          </div>
        </div>
      )}

      {picker && <LibraryPicker onClose={() => setPicker(false)} onPick={pickMaterial} />}

      {/* Публикациите — най-новите горе */}
      {posts === null ? (
        <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>
      ) : posts.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-sm text-slate-400">Още няма публикации.</div>
      ) : (
        <div className="space-y-2">
          {posts.map(p => {
            const seen = seenAt(p)
            const th = msgs.filter(m => m.post_id === p.id)
            const fresh = th.some(m => m.from_parent && !m.read_at)
            return (
              <div key={p.id} className={`border rounded-2xl px-5 py-3.5 shadow-[0_1px_4px_rgba(15,34,64,0.06)] ${p.hidden_at ? 'bg-slate-50 border-slate-200 opacity-70' : fresh ? 'bg-white border-amber-300' : 'bg-white border-slate-200'}`}>
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500 mb-1">
                  <span>{when(p.created_at)}</span>
                  <span className="text-slate-300">·</span>
                  <span>{(p.author_id && names[p.author_id]) || '—'}</span>
                  {p.hidden_at
                    ? <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">скрита от родителя {when(p.hidden_at)}{p.hidden_by && names[p.hidden_by] ? ` · ${names[p.hidden_by]}` : ''}</span>
                    : seen ? <span className="inline-flex items-center gap-1 text-emerald-700"><CircleCheck size={12} /> видяно {when(seen)}</span>
                    : <span className="text-slate-400">още не е видяно</span>}
                  {live && (p.author_id === meId || isManager) && (
                    <button type="button" onClick={() => toggleHidden(p)} title={p.hidden_at ? 'Покажи отново на родителя' : 'Скрий от родителя (остава в хронологията)'}
                      className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                      {p.hidden_at ? <><Eye size={13} /> покажи</> : <><EyeOff size={13} /> скрий</>}
                    </button>
                  )}
                </div>
                {p.body && <p className="text-[14px] text-slate-800 whitespace-pre-line leading-relaxed">{p.body}</p>}
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {p.link_url && <a href={p.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-sky-700 hover:underline max-w-full"><ExternalLink size={13} /> <span className="truncate">{p.link_url}</span></a>}
                  {(p.file_path || p.material_id) && <button type="button" onClick={() => openFile(p)} className="inline-flex items-center gap-1 text-[13px] text-sky-700 hover:underline"><Paperclip size={13} /> {p.file_name || 'файл'}</button>}
                </div>
                <Thread msgs={th} names={names} canReply={live && !p.hidden_at} onReply={t => reply(p.id, t)} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── „От библиотеката“: само материали от източници, разрешени за родители и неизтекли ──
function LibraryPicker({ onPick, onClose }: { onPick: (m: any) => Promise<void>; onClose: () => void }) {
  const supabase = createClient()
  const [list, setList] = useState<any[] | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => {
    (async () => {
      const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Sofia' })
      const { data } = await supabase.from('materials').select('id, title, description, file_name, source:material_sources(allow_parents, valid_until)').order('title')
      setList((data || []).filter((m: any) => m.source?.allow_parents && (!m.source.valid_until || m.source.valid_until >= today)))
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = (list || []).filter(m => !q || `${m.title} ${m.description || ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-xl mx-auto my-0 md:my-10 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-200">
          <Library size={17} className="text-emerald-700" />
          <h2 className="text-base font-medium text-[#0f2240] flex-1">Добави от библиотеката</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl focus-within:border-[#0f2240]">
            <Search size={14} className="text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси материал…" className="flex-1 min-w-0 text-[14px] focus:outline-none" />
          </div>
          {list === null ? <div className="flex justify-center py-6 text-slate-400"><Loader2 className="animate-spin" size={18} /></div>
            : shown.length === 0 ? <p className="text-[13px] text-slate-400 py-4 text-center">Няма материали, които може да се дават на родители.</p>
            : <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {shown.map(m => (
                  <button key={m.id} type="button" disabled={!!busy} onClick={async () => { setBusy(m.id); await onPick(m); setBusy(null) }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] text-slate-800 truncate">{m.title}</span>
                      {m.description && <span className="block text-[12px] text-slate-500 truncate">{m.description}</span>}
                    </span>
                    {busy === m.id && <Loader2 size={14} className="animate-spin text-slate-400" />}
                  </button>
                ))}
              </div>}
          <p className="text-[11.5px] text-slate-400">Показват се само материалите, които може да се дават на родители.</p>
        </div>
      </div>
    </div>
  )
}

// ── Нишката под публикацията: въпросите на родителя и отговорите ──
function Thread({ msgs, names, canReply, onReply }: { msgs: Msg[]; names: Record<string, string>; canReply: boolean; onReply: (t: string) => Promise<boolean> }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const hasParent = msgs.some(m => m.from_parent)
  if (!msgs.length && !canReply) return null
  return (
    <div className="mt-2.5 space-y-1.5">
      {msgs.map(m => (
        <div key={m.id} className={`text-[13px] px-3 py-2 rounded-xl ${m.from_parent ? (m.kind === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900') : 'bg-sky-50 text-slate-800'}`}>
          <span className="text-[11.5px] opacity-70">{m.from_parent ? 'Родител' : ((m.author_id && names[m.author_id]) || 'Учител')} · {when(m.created_at)}{m.from_parent && !m.read_at ? ' · ново' : ''}</span>
          <div className="whitespace-pre-line">{[MSG_LABEL[m.kind], m.body].filter(Boolean).join(' — ')}</div>
        </div>
      ))}
      {canReply && hasParent && (
        <div className="flex gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 border border-slate-200 rounded-xl focus-within:border-[#0f2240]">
            <MessageCircle size={13} className="text-slate-400 shrink-0" />
            <input value={text} onChange={e => setText(e.target.value.slice(0, 500))} placeholder="Отговор към родителя…"
              className="flex-1 min-w-0 text-[13px] focus:outline-none" />
          </div>
          <button type="button" disabled={busy || !text.trim()} onClick={async () => { setBusy(true); if (await onReply(text.trim())) setText(''); setBusy(false) }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-white text-[13px] disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Отговори
          </button>
        </div>
      )}
    </div>
  )
}
