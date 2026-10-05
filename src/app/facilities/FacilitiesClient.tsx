'use client'
// Материална база: подаване на сигнал (помещение · вид · описание · снимка · спешно) и списък.
// Управата/деловодството: филтри и бутони Приет / Поправено / Не може + отговор.
// Колегата: своите сигнали, отговорите и „Не е оправено“.

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Camera, Loader2, Search, AlertTriangle, Send, RotateCcw, Trash2, Check, Clock, Ban, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { resizeImage, uid } from '@/app/portfolio/lib'
import { CATEGORIES, catMeta, STATUS } from './lib'
import type { Issue, IssueEvent, IssueStatus } from './lib'

const fmt = (d: string) => new Date(d).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const isOpen = (s: IssueStatus) => s === 'new' || s === 'accepted'

export default function FacilitiesClient({ meId, handler, issues, events, people, photos, rooms, openAll, unseen }: {
  meId: string; handler: boolean; issues: Issue[]; events: IssueEvent[]
  people: Record<string, string>; photos: Record<string, string>; rooms: string[]
  openAll: { id: string; room: string; category: string; description: string }[]
  unseen: string[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  // ── нов сигнал ──
  const [formOpen, setFormOpen] = useState(!handler && issues.length === 0)
  const [room, setRoom] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const sameRoom = useMemo(() => {
    const r = room.trim().toLowerCase()
    return r.length >= 2 ? openAll.filter(i => i.room.trim().toLowerCase() === r) : []
  }, [room, openAll])

  function pickPhoto(f: File | null) {
    if (preview) URL.revokeObjectURL(preview)
    setPhoto(f); setPreview(f ? URL.createObjectURL(f) : '')
  }
  function resetForm() { setRoom(''); setCategory(''); setDescription(''); setUrgent(false); pickPhoto(null) }

  async function submit() {
    if (!room.trim()) { toast('Напишете помещението', 'error'); return }
    if (!category) { toast('Изберете какво е повредено', 'error'); return }
    if (!description.trim()) { toast('Опишете накратко проблема', 'error'); return }
    setSaving(true)
    const id = uid()
    let photo_path: string | null = null
    try {
      if (photo) {
        let blob: Blob = photo
        try { blob = await resizeImage(photo, 1600) } catch { /* непознат формат — качва се както е */ }
        photo_path = `${id}/${uid()}.jpg`
        const up = await supabase.storage.from('facilities').upload(photo_path, blob, { contentType: 'image/jpeg' })
        if (up.error) throw up.error
      }
      const { error } = await supabase.from('facility_issues').insert({
        id, reporter_id: meId, room: room.trim(), category, description: description.trim(), urgent, photo_path,
      })
      if (error) throw error
      toast('Сигналът е подаден')
      resetForm(); setFormOpen(false); router.refresh()
    } catch (e: any) {
      toast(e?.message?.includes('facility') ? 'Пуснете SQL файла 2026-10-05_facilities.sql' : (e?.message || 'Грешка'), 'error')
    }
    setSaving(false)
  }

  // ── списък ──
  const [tab, setTab] = useState<'open' | 'closed' | 'all'>('open')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const counts = { open: issues.filter(i => isOpen(i.status)).length, closed: issues.filter(i => !isOpen(i.status)).length, all: issues.length }
  const visible = issues
    .filter(i => tab === 'all' || (tab === 'open' ? isOpen(i.status) : !isOpen(i.status)))
    .filter(i => !cat || i.category === cat)
    .filter(i => { const s = q.trim().toLowerCase(); return !s || `${i.room} ${i.description} ${people[i.reporter_id || ''] || ''}`.toLowerCase().includes(s) })
    .sort((a, b) => (isOpen(b.status) && b.urgent ? 1 : 0) - (isOpen(a.status) && a.urgent ? 1 : 0) || b.created_at.localeCompare(a.created_at))
  const evOf = (id: string) => events.filter(e => e.issue_id === id)
  const myList = handler ? visible : issues.slice().sort((a, b) => Number(isOpen(b.status)) - Number(isOpen(a.status)) || b.created_at.localeCompare(a.created_at))

  return (
    <div className="space-y-5">
      {/* ── Нов сигнал ── */}
      {!formOpen ? (
        <button onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white shadow-sm hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
          <Plus size={16} /> Подай сигнал
        </button>
      ) : (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-medium text-slate-800">Нов сигнал</h2>
            <button onClick={() => { resetForm(); setFormOpen(false) }} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Затвори"><X size={16} /></button>
          </div>
          <div className="grid md:grid-cols-[1fr_200px] gap-5">
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">Помещение</label>
                <input value={room} onChange={e => setRoom(e.target.value)} list="facility-rooms" placeholder="напр. Кабинет 12, Физкултурен салон, Коридор ет. 2"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10" />
                <datalist id="facility-rooms">{rooms.map(r => <option key={r} value={r} />)}</datalist>
                {sameRoom.length > 0 && (
                  <div className="mt-2 px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-[12.5px] text-sky-900">
                    Вече има подадено за това помещение:
                    <ul className="mt-1 space-y-0.5">{sameRoom.map(s => <li key={s.id}>• {catMeta(s.category).label} — {s.description.length > 80 ? s.description.slice(0, 80) + '…' : s.description}</li>)}</ul>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[12px] text-slate-600 mb-1.5">Какво е повредено</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(c => {
                    const on = category === c.key; const I = c.icon
                    return (
                      <button key={c.key} type="button" onClick={() => setCategory(c.key)} title={'hint' in c ? c.hint : undefined}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] border transition-colors ${on ? 'bg-[#0f2240] border-[#0f2240] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'}`}>
                        <I size={14} /> {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[12px] text-slate-600 mb-1">Описание</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder="Какво точно не работи? напр. „Бравата заяжда, вратата не се заключва“"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 resize-y" />
              </div>
              {/* спешно — плъзгащ превключвател */}
              <button type="button" onClick={() => setUrgent(u => !u)} className="flex items-center gap-3 text-sm text-left">
                <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${urgent ? 'bg-rose-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${urgent ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </span>
                <span className={urgent ? 'text-rose-700' : 'text-slate-600'}>Спешно <span className="text-slate-400 text-[12px]">— опасно или пречи на работата (тече вода, искри контакт…)</span></span>
              </button>
            </div>
            {/* снимка */}
            <div>
              <label className="block text-[12px] text-slate-600 mb-1">Снимка <span className="text-slate-400">— по желание</span></label>
              {preview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => pickPhoto(null)} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 text-slate-600 hover:text-rose-600 flex items-center justify-center shadow" title="Махни"><X size={14} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0f2240] bg-slate-50/60 flex flex-col items-center justify-center gap-1.5 text-slate-500 hover:text-[#0f2240]">
                  <Camera size={24} /><span className="text-[12.5px]">Снимай / избери</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { pickPhoto(e.target.files?.[0] || null); e.target.value = '' }} />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={submit} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm text-white disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Подай сигнала
            </button>
          </div>
        </section>
      )}

      {/* ── Списък ── */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-slate-100">
          {handler ? (
            <>
              <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-[13px]">
                {([['open', 'Отворени'], ['closed', 'Приключени'], ['all', 'Всички']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-lg ${tab === k ? 'bg-white shadow-sm text-[#0f2240]' : 'text-slate-500 hover:text-slate-700'}`}>
                    {l} <span className="text-slate-400 tabular-nums">{counts[k]}</span>
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Помещение, текст, колега…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-400" />
              </div>
              <select value={cat} onChange={e => setCat(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-teal-400">
                <option value="">Всички видове</option>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </>
          ) : <h2 className="text-sm font-medium text-slate-700">Моите сигнали</h2>}
        </div>

        <div className="divide-y divide-slate-100">
          {myList.map(i => (
            <IssueCard key={i.id} issue={i} events={evOf(i.id)} people={people} photo={i.photo_path ? photos[i.photo_path] : undefined}
              handler={handler} mine={i.reporter_id === meId} fresh={unseen.includes(i.id)} onChanged={() => router.refresh()} />
          ))}
          {myList.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-slate-400">
              {handler ? (tab === 'open' ? 'Няма отворени сигнали.' : 'Няма сигнали.') : 'Нямаш подадени сигнали.'}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function IssueCard({ issue: i, events, people, photo, handler, mine, fresh, onChanged }: {
  issue: Issue; events: IssueEvent[]; people: Record<string, string>; photo?: string
  handler: boolean; mine: boolean; fresh: boolean; onChanged: () => void
}) {
  const { toast } = useToast()
  const supabase = createClient()
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [reopen, setReopen] = useState(false)
  const [reopenText, setReopenText] = useState('')
  const c = catMeta(i.category); const CI = c.icon
  const st = STATUS[i.status]
  const open = isOpen(i.status)

  async function setStatus(s: IssueStatus) {
    if ((s === 'cannot') && !reply.trim()) { toast('Напишете причината за колегата', 'error'); return }
    setBusy(true)
    const { error } = await supabase.rpc('facility_set_status', { p_issue: i.id, p_status: s, p_reply: reply.trim() || null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    setReply(''); toast(s === 'done' ? 'Отбелязано като поправено' : 'Записано'); onChanged()
  }
  async function doReopen() {
    setBusy(true)
    const { error } = await supabase.rpc('facility_reopen', { p_issue: i.id, p_body: reopenText.trim() || null })
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    setReopen(false); setReopenText(''); toast('Сигналът е отворен отново'); onChanged()
  }
  async function remove() {
    if (!confirm('Да се изтрие ли сигналът?')) return
    setBusy(true)
    if (i.photo_path) await supabase.storage.from('facilities').remove([i.photo_path])
    const { error } = await supabase.from('facility_issues').delete().eq('id', i.id)
    setBusy(false)
    if (error) { toast(error.message, 'error'); return }
    onChanged()
  }

  const statusIcon = (s: string | null) => s === 'done' ? <Check size={12} /> : s === 'cannot' ? <Ban size={12} /> : s === 'accepted' ? <Clock size={12} /> : <RotateCcw size={12} />

  return (
    <article className={`px-5 py-4 flex gap-4 ${fresh ? 'bg-emerald-50/40' : ''}`}>
      {photo ? (
        <a href={photo} target="_blank" rel="noreferrer" className="shrink-0 w-24 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200" title="Отвори снимката">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
        </a>
      ) : (
        <div className="shrink-0 w-24 h-20 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300"><CI size={26} /></div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">{i.room}</span>
          <span className="inline-flex items-center gap-1 text-[11.5px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600"><CI size={12} /> {c.label}</span>
          {i.urgent && open && <span className="inline-flex items-center gap-1 text-[11.5px] px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700"><AlertTriangle size={11} /> спешно</span>}
          <span className={`inline-flex items-center gap-1.5 text-[11.5px] px-2 py-0.5 rounded-full border ${st.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}</span>
          {fresh && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-600 text-white">ново</span>}
        </div>
        <p className="text-[14px] text-slate-700 mt-1.5 whitespace-pre-line">{i.description}</p>
        <div className="text-[12px] text-slate-500 mt-1">
          {handler ? <>{people[i.reporter_id || ''] || '—'} · </> : null}{fmt(i.created_at)}
        </div>

        {/* история / отговори */}
        {events.length > 0 && (
          <ul className="mt-2.5 space-y-1 border-l-2 border-slate-200 pl-3">
            {events.map(e => (
              <li key={e.id} className="text-[12.5px] text-slate-600">
                <span className="inline-flex items-center gap-1 text-slate-500">{statusIcon(e.status)} {fmt(e.created_at)} · {people[e.author_id || ''] || '—'}</span>
                {e.kind === 'reopen' ? <span className="text-amber-700"> — не е оправено</span> : e.status ? <span> — {STATUS[e.status as IssueStatus]?.label}</span> : null}
                {e.body && <span className="text-slate-800">: „{e.body}“</span>}
              </li>
            ))}
          </ul>
        )}

        {/* управата: отговор + статус */}
        {handler && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <MessageSquare size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Отговор към колегата (по желание)…"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-[13px] focus:outline-none focus:border-teal-400" />
            </div>
            {i.status === 'new' && (
              <button disabled={busy} onClick={() => setStatus('accepted')} className="px-3 py-2 rounded-xl text-[13px] border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 disabled:opacity-50">Приет</button>
            )}
            {open && (
              <>
                <button disabled={busy} onClick={() => setStatus('done')} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"><Check size={14} /> Поправено</button>
                <button disabled={busy} onClick={() => setStatus('cannot')} className="px-3 py-2 rounded-xl text-[13px] border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50" title="Напишете причината в отговора">Не може</button>
              </>
            )}
            {!open && (
              <button disabled={busy} onClick={() => setStatus('accepted')} className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[13px] border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RotateCcw size={13} /> Отвори отново</button>
            )}
            {busy && <Loader2 size={15} className="animate-spin text-slate-400" />}
          </div>
        )}

        {/* колегата: „Не е оправено“ / изтриване, докато е нов */}
        {!handler && mine && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {!open && !reopen && (
              <button onClick={() => setReopen(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[13px] border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"><RotateCcw size={13} /> Не е оправено</button>
            )}
            {reopen && (
              <>
                <input value={reopenText} onChange={e => setReopenText(e.target.value)} placeholder="Какво още не е наред?" autoFocus
                  className="flex-1 min-w-[220px] px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] focus:outline-none focus:border-[#0f2240]" />
                <button disabled={busy} onClick={doReopen} className="px-3 py-1.5 rounded-xl text-[13px] text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>Изпрати</button>
                <button onClick={() => setReopen(false)} className="px-2 py-1.5 text-[13px] text-slate-500 hover:text-slate-800">Откажи</button>
              </>
            )}
            {i.status === 'new' && (
              <button disabled={busy} onClick={remove} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12.5px] text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={13} /> Изтрий</button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
