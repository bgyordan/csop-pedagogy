'use client'
// Запис в професионалното портфолио: раздел, заглавие, дати, описание, рефлексия, данни според раздела
// (квалификация — вид, часове, кредити, удостоверение; изяви — ниво и роля), файлове, линк и видимост.
import { useState } from 'react'
import { Loader2, Paperclip, Trash2, Upload, X, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import DateInput from '@/components/ui/DateInput'
import {
  SECTIONS, Q_KINDS, LEVELS, PART_ROLES, VIS, HOURS_PER_CREDIT, safeName,
  type PPItem, type PPFile, type SectionKey, type Visibility,
} from '@/lib/pro-portfolio'

export type WallPost = { id: string; kind: string; title: string; body: string | null; event_date: string | null; created_at: string }
const POST_SECTION: Record<string, SectionKey> = { cabinet: 'practice', project: 'practice', event: 'events', material: 'creative' }

type Draft = Partial<PPItem> & { section: SectionKey; title: string; visibility: Visibility }

export default function ItemEditor({ staffId, item, section, posts, onClose, onSaved }: {
  staffId: string; item: PPItem | null; section?: SectionKey; posts: WallPost[]
  onClose: () => void; onSaved: () => void
}) {
  const { toast } = useToast()
  const [d, setD] = useState<Draft>(() => item ? { ...item } : { section: section || 'practice', title: '', visibility: 'managers', featured: false })
  const [files, setFiles] = useState<PPFile[]>(item?.files || [])
  const [pending, setPending] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Draft>) => setD(x => ({ ...x, ...patch }))
  const isQ = d.section === 'qualification'
  const hasLevel = ['events', 'creative', 'policy', 'achievements', 'practice', 'interaction'].includes(d.section)
  const numOr = (v: string) => (v === '' ? null : Number(v.replace(',', '.')))

  function fromPost(id: string) {
    const p = posts.find(x => x.id === id)
    if (!p) { set({ post_id: null }); return }
    set({
      post_id: p.id, title: d.title || p.title, body: d.body || p.body,
      date_from: d.date_from || p.event_date || p.created_at.slice(0, 10), section: item ? d.section : (POST_SECTION[p.kind] || d.section),
    })
  }

  async function save() {
    if (!d.title.trim()) { toast('Напишете заглавие', 'error'); return }
    setBusy(true)
    const supabase = createClient()
    const row = {
      staff_id: staffId, section: d.section, title: d.title.trim(), body: d.body || null, reflection: d.reflection || null,
      date_from: d.date_from || null, date_to: d.date_to || null, kind: d.kind || null, level: d.level || null,
      part_role: d.part_role || null, provider: d.provider || null, doc_no: d.doc_no || null,
      hours: d.hours ?? null, credits: d.credits ?? null, url: d.url || null, post_id: d.post_id || null,
      visibility: d.visibility, featured: !!d.featured, updated_at: new Date().toISOString(),
    }
    let id = item?.id
    if (id) {
      const { error } = await supabase.from('pp_items').update(row).eq('id', id)
      if (error) { setBusy(false); toast(error.message, 'error'); return }
    } else {
      const { data, error } = await supabase.from('pp_items').insert(row).select('id').single()
      if (error || !data) { setBusy(false); toast(error?.message || 'Записът не е запазен', 'error'); return }
      id = data.id
    }
    for (const f of pending) {
      const path = `${staffId}/${id}/${Date.now()}_${safeName(f.name)}`
      const { error } = await supabase.storage.from('pro-portfolio').upload(path, f)
      if (error) { toast(`${f.name}: ${error.message}`, 'error'); continue }
      const { error: e2 } = await supabase.from('pp_files').insert({ item_id: id, staff_id: staffId, name: f.name, path, mime: f.type || null, size: f.size })
      if (e2) toast(e2.message, 'error')
    }
    setBusy(false)
    toast('Записано')
    onSaved()
  }

  async function removeFile(f: PPFile) {
    if (!(await confirmDialog(`Да се изтрие ли „${f.name}“?`))) return
    const supabase = createClient()
    await supabase.storage.from('pro-portfolio').remove([f.path])
    const { error } = await supabase.from('pp_files').delete().eq('id', f.id)
    if (error) { toast(error.message, 'error'); return }
    setFiles(x => x.filter(y => y.id !== f.id))
  }

  const meta = SECTIONS.find(s => s.key === d.section)
  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-0 md:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full md:max-w-2xl md:rounded-2xl shadow-xl max-h-[100vh] md:max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-3.5 flex items-center gap-2 z-10">
          <h2 className="text-base font-semibold text-slate-800 flex-1">{item ? 'Редакция на записа' : 'Нов запис в портфолиото'}</h2>
          <button type="button" aria-label="Затвори" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
        </div>
        <div className="p-5 space-y-4 text-[13px]">
          <label className="block"><span className="label">Раздел</span>
            <select value={d.section} onChange={e => set({ section: e.target.value as SectionKey })} className="input">
              {SECTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            {meta && <span className="block mt-1 text-[12px] text-slate-500">{meta.hint}</span>}
          </label>

          {posts.length > 0 && !isQ && (
            <label className="block"><span className="label">От стената „Портфолио“ (по желание)</span>
              <select value={d.post_id || ''} onChange={e => fromPost(e.target.value)} className="input">
                <option value="">— без връзка —</option>
                {posts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
          )}

          <label className="block"><span className="label">Заглавие</span>
            <input value={d.title} onChange={e => set({ title: e.target.value })} className="input" placeholder={isQ ? 'напр. „Работа с деца с РАС — ABA подход“' : 'напр. „Проект „Сензорна стая““'} /></label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">{isQ ? 'Начало' : 'Дата / от'}</span><DateInput value={d.date_from || ''} onChange={v => set({ date_from: v || null })} /></label>
            <label className="block"><span className="label">{isQ ? 'Край / дата на удостоверението' : 'до (по желание)'}</span><DateInput value={d.date_to || ''} onChange={v => set({ date_to: v || null })} /></label>
          </div>

          {isQ && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
              <label className="block"><span className="label">Вид квалификация</span>
                <select value={d.kind || ''} onChange={e => set({ kind: e.target.value || null })} className="input">
                  <option value="">—</option>
                  {Q_KINDS.map(k => <option key={k.key} value={k.key}>{k.label} — {k.hint}</option>)}
                </select></label>
              <label className="block"><span className="label">Обучаваща организация / висше училище</span><input value={d.provider || ''} onChange={e => set({ provider: e.target.value })} className="input" /></label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block"><span className="label">Акад. часа</span><input type="number" min={0} step="0.5" value={d.hours ?? ''} onChange={e => set({ hours: numOr(e.target.value) })} className="input" /></label>
                <label className="block"><span className="label">Кредити</span><input type="number" min={0} step="0.5" value={d.credits ?? ''} onChange={e => set({ credits: numOr(e.target.value) })} className="input" placeholder={d.hours ? String(Math.floor(Number(d.hours) / HOURS_PER_CREDIT)) : ''} /></label>
                <label className="block"><span className="label">№ удостоверение</span><input value={d.doc_no || ''} onChange={e => set({ doc_no: e.target.value })} className="input" /></label>
              </div>
              <p className="text-[12px] text-slate-500">1 кредит = {HOURS_PER_CREDIT} академични часа. Часовете и кредитите се събират автоматично за раздел А на атестационната карта.</p>
            </div>
          )}

          {hasLevel && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">Ниво</span>
                <select value={d.level || ''} onChange={e => set({ level: e.target.value || null })} className="input"><option value="">—</option>{LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}</select></label>
              <label className="block"><span className="label">Моята роля</span>
                <input list="pp-roles" value={d.part_role || ''} onChange={e => set({ part_role: e.target.value })} className="input" />
                <datalist id="pp-roles">{PART_ROLES.map(r => <option key={r} value={r} />)}</datalist></label>
              {d.section !== 'practice' && <label className="block col-span-2"><span className="label">Организатор / издание / партньор</span><input value={d.provider || ''} onChange={e => set({ provider: e.target.value })} className="input" /></label>}
            </div>
          )}

          <label className="block"><span className="label">Описание</span>
            <textarea rows={4} value={d.body || ''} onChange={e => set({ body: e.target.value })} className="input" placeholder="Какво е, с кого, какви дейности…" /></label>
          <label className="block"><span className="label">Рефлексия — какво постигнах, какво научих, какво ще променя</span>
            <textarea rows={3} value={d.reflection || ''} onChange={e => set({ reflection: e.target.value })} className="input" /></label>
          <label className="block"><span className="label">Линк (по желание)</span><input value={d.url || ''} onChange={e => set({ url: e.target.value })} className="input" placeholder="https://…" /></label>

          <div>
            <span className="label">Файлове (сертификат, снимки, разработка, грамота…)</span>
            <div className="space-y-1">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-2"><Paperclip size={13} className="text-slate-400" /><span className="truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => removeFile(f)} className="p-1 text-slate-400 hover:text-rose-600" aria-label="Изтрий"><Trash2 size={13} /></button></div>
              ))}
              {pending.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-600"><Upload size={13} className="text-emerald-600" /><span className="truncate flex-1">{f.name}</span>
                  <button type="button" onClick={() => setPending(x => x.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-rose-600" aria-label="Махни"><X size={13} /></button></div>
              ))}
            </div>
            <label className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"><Upload size={14} /> Добави файлове
              <input type="file" multiple className="hidden" onChange={e => { const l = e.target.files; if (l?.length) setPending(x => [...x, ...Array.from(l)]); e.target.value = '' }} /></label>
            <p className="mt-1 text-[12px] text-slate-500">Без лични данни на децата — снимки и резултати само със съгласие на родителите или обобщено.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block"><span className="label">Кой го вижда</span>
              <select value={d.visibility} onChange={e => set({ visibility: e.target.value as Visibility })} className="input">
                {(Object.keys(VIS) as Visibility[]).map(v => <option key={v} value={v}>{VIS[v].label}</option>)}
              </select><span className="block mt-1 text-[12px] text-slate-500">{VIS[d.visibility].hint}</span></label>
            <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={!!d.featured} onChange={e => set({ featured: e.target.checked })} /><Star size={14} className="text-amber-500" /> Избрано — показва се в началото и в документа</label>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Отказ</button>
          <button type="button" disabled={busy} onClick={save} className="btn-primary inline-flex items-center gap-1.5">{busy && <Loader2 size={14} className="animate-spin" />} Запази</button>
        </div>
      </div>
    </div>
  )
}
