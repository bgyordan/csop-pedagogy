'use client'

import { useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  FileText, Upload, Trash2, Download, Plus, X, Check, Search, Pencil, GripVertical, ExternalLink, RefreshCw, Eye, EyeOff, FolderInput,
} from 'lucide-react'
import {
  ACCENT, SITE_URL, SECTIONS, rubricSet, rubricOf, suggestName, Field, INPUT, Toast, Drawer, Switch, Spinner, useFlash, moveItem,
} from './shared'
import type { Doc } from './shared'

type Pending = { file: File; name: string }

const ext = (url: string) => (url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)?.[1] || '').toLowerCase()
const EXT_COLOR: Record<string, string> = { pdf: 'bg-rose-50 text-rose-600', doc: 'bg-sky-50 text-sky-600', docx: 'bg-sky-50 text-sky-600', xls: 'bg-emerald-50 text-emerald-600', xlsx: 'bg-emerald-50 text-emerald-600' }
const storagePath = (url: string) => { const p = url.split('/public-docs/')[1]?.split('?')[0]; return p ? decodeURIComponent(p) : null }
const safeName = (n: string) => n.replace(/[^a-zA-Z0-9.-]/g, '_')

/* ═══════════════ ДОКУМЕНТИ ═══════════════ */
export default function DocumentsManager({ initial, defaultYear, startSection }: { initial: Doc[]; defaultYear: string; startSection?: string }) {
  const supabase = createClient(); const router = useRouter()
  const { notice, flash } = useFlash()
  const [list, setList] = useState<Doc[]>(initial)
  const [section, setSection] = useState(startSection || 'internal')
  const [q, setQ] = useState(''); const [vis, setVis] = useState<'all' | 'on' | 'off'>('all'); const [yearF, setYearF] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editId, setEditId] = useState<string | null>(null); const [editName, setEditName] = useState(''); const [editYear, setEditYear] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | 'bulk' | null>(null)
  const [dragId, setDragId] = useState<string | null>(null); const [dropOver, setDropOver] = useState(false)
  // качване
  const [drawer, setDrawer] = useState(false); const [pending, setPending] = useState<Pending[]>([])
  const [year, setYear] = useState(defaultYear || ''); const [category, setCategory] = useState('rules'); const [onSite, setOnSite] = useState(true)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const replaceFor = useRef<Doc | null>(null); const replaceInput = useRef<HTMLInputElement>(null)

  const cur = SECTIONS.find((s) => s.id === section)!
  const rubrics = rubricSet(section)
  const counts = useMemo(() => { const c: Record<string, number> = {}; list.forEach((d) => { c[d.section] = (c[d.section] || 0) + 1 }); return c }, [list])
  const inSection = useMemo(() => list.filter((d) => d.section === section).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [list, section])
  const years = useMemo(() => Array.from(new Set(inSection.map((d) => d.academic_year).filter(Boolean) as string[])).sort().reverse(), [inSection])
  const filtering = !!q.trim() || vis !== 'all' || yearF !== 'all'
  const shown = inSection
    .filter((d) => (vis === 'all' ? true : vis === 'on' ? d.on_site : !d.on_site))
    .filter((d) => (yearF === 'all' ? true : d.academic_year === yearF))
    .filter((d) => (q.trim() ? d.name.toLowerCase().includes(q.trim().toLowerCase()) : true))

  function pickSection(id: string) { setSection(id); setSelected(new Set()); setEditId(null); setConfirmDel(null); setYearF('all'); setCategory(rubricSet(id)?.[0].key || 'other') }

  /* ---------- качване (много файлове наведнъж) ---------- */
  function openUpload(files?: File[]) {
    setPending((files || []).map((f) => ({ file: f, name: suggestName(f.name) })))
    setCategory(rubrics?.[0].key || 'other'); setOnSite(!cur.internalOnly); setDrawer(true)
  }
  async function uploadAll() {
    if (pending.length === 0) { flash('Изберете поне един файл.', true); return }
    if (pending.some((p) => !p.name.trim())) { flash('Всеки документ трябва да има име.', true); return }
    setProgress({ done: 0, total: pending.length })
    let sort = inSection.reduce((m, d) => Math.max(m, d.sort_order || 0), 0)
    const added: Doc[] = []
    try {
      for (const p of pending) {
        const path = `${section}/${Date.now()}-${safeName(p.file.name)}`
        const { error: upErr } = await supabase.storage.from('public-docs').upload(path, p.file, { contentType: p.file.type || undefined })
        if (upErr) throw upErr
        const url = supabase.storage.from('public-docs').getPublicUrl(path).data.publicUrl
        const { data, error } = await supabase.from('site_documents').insert({
          name: p.name.trim(), file_url: url, academic_year: year.trim() || null, section,
          category: rubrics ? category : null, on_site: cur.internalOnly ? false : onSite, sort_order: ++sort,
        }).select('*').single()
        if (error || !data) throw error || new Error('Грешка при запис')
        added.push(data as Doc); setProgress((x) => (x ? { ...x, done: x.done + 1 } : x))
      }
      setList((prev) => [...prev, ...added]); setDrawer(false); setPending([])
      flash(added.length === 1 ? 'Документът е качен.' : `Качени ${added.length} документа.`); router.refresh()
    } catch (e: unknown) {
      if (added.length) setList((prev) => [...prev, ...added])
      flash(e instanceof Error ? e.message : 'Грешка при качване.', true)
    } finally { setProgress(null) }
  }

  /* ---------- нова версия на файл (връзката към страницата остава) ---------- */
  async function replaceFile(d: Doc, f: File) {
    try {
      flash('Качвам новата версия…')
      const old = storagePath(d.file_url)
      let url: string
      if (old && ext(d.file_url) === (f.name.split('.').pop() || '').toLowerCase()) {
        const { error } = await supabase.storage.from('public-docs').upload(old, f, { upsert: true, contentType: f.type || undefined })
        if (error) throw error
        url = supabase.storage.from('public-docs').getPublicUrl(old).data.publicUrl + `?v=${Date.now()}`
      } else {
        const path = `${d.section}/${Date.now()}-${safeName(f.name)}`
        const { error } = await supabase.storage.from('public-docs').upload(path, f, { contentType: f.type || undefined })
        if (error) throw error
        url = supabase.storage.from('public-docs').getPublicUrl(path).data.publicUrl
        if (old) await supabase.storage.from('public-docs').remove([old])
      }
      await supabase.from('site_documents').update({ file_url: url }).eq('id', d.id)
      setList((p) => p.map((x) => (x.id === d.id ? { ...x, file_url: url } : x))); flash(`„${d.name}“ е заменен с новата версия.`); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка при подмяна.', true) }
  }

  /* ---------- редакция ---------- */
  async function patch(ids: string[], data: Partial<Doc>) {
    setList((p) => p.map((x) => (ids.includes(x.id) ? { ...x, ...data } : x)))
    const { error } = await supabase.from('site_documents').update(data).in('id', ids)
    if (error) flash(error.message, true); else router.refresh()
  }
  function startEdit(d: Doc) { setEditId(d.id); setEditName(d.name); setEditYear(d.academic_year || '') }
  async function saveEdit() { if (!editId || !editName.trim()) return; await patch([editId], { name: editName.trim(), academic_year: editYear.trim() || null }); setEditId(null) }
  async function removeDocs(docs: Doc[]) {
    try {
      const paths = docs.map((d) => storagePath(d.file_url)).filter(Boolean) as string[]
      if (paths.length) await supabase.storage.from('public-docs').remove(paths)
      const ids = docs.map((d) => d.id)
      await supabase.from('site_documents').delete().in('id', ids)
      setList((p) => p.filter((x) => !ids.includes(x.id))); setSelected(new Set()); setConfirmDel(null)
      flash(docs.length === 1 ? `„${docs[0].name}“ е изтрит.` : `Изтрити ${docs.length} документа.`); router.refresh()
    } catch { flash('Грешка при изтриване.', true) }
  }
  async function moveTo(target: string) {
    const ids = Array.from(selected); if (!ids.length || target === section) return
    const base = list.filter((d) => d.section === target).reduce((m, d) => Math.max(m, d.sort_order || 0), 0)
    const tgt = SECTIONS.find((s) => s.id === target)!
    setList((p) => p.map((x) => (ids.includes(x.id) ? { ...x, section: target, sort_order: base + ids.indexOf(x.id) + 1, category: rubricSet(target) ? rubricSet(target)![0].key : null, on_site: tgt.internalOnly ? false : x.on_site } : x)))
    for (let i = 0; i < ids.length; i++) { const id = ids[i]
      await supabase.from('site_documents').update({ section: target, sort_order: base + i + 1, category: rubricSet(target) ? rubricSet(target)![0].key : null, ...(tgt.internalOnly ? { on_site: false } : {}) }).eq('id', id)
    }
    setSelected(new Set()); flash(`Преместени в „${tgt.label}“.`); router.refresh()
  }

  /* ---------- пренареждане с влачене ---------- */
  async function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return
    const from = inSection.findIndex((d) => d.id === dragId); const to = inSection.findIndex((d) => d.id === targetId)
    const reordered = moveItem(inSection, from, to).map((d, i) => ({ ...d, sort_order: i + 1 }))
    setList((p) => p.map((x) => reordered.find((r) => r.id === x.id) ?? x)); setDragId(null)
    const changed = reordered.filter((r) => inSection.find((d) => d.id === r.id)?.sort_order !== r.sort_order)
    for (const r of changed) await supabase.from('site_documents').update({ sort_order: r.sort_order }).eq('id', r.id)
    router.refresh()
  }

  const allChecked = shown.length > 0 && shown.every((d) => selected.has(d.id))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(shown.map((d) => d.id)))
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const selDocs = list.filter((d) => selected.has(d.id))

  return (
    <div className="grid grid-cols-1 md:grid-cols-[230px_1fr] gap-5">
      {/* раздели */}
      <nav className="bg-white border border-slate-200 rounded-2xl shadow-sm p-2 h-fit" aria-label="Раздели с документи">
        <div className="text-[11px] font-semibold text-slate-400 px-2.5 pt-2 pb-1.5">Раздели на сайта</div>
        {SECTIONS.map((s) => {
          const on = section === s.id
          return (
            <button key={s.id} onClick={() => pickSection(s.id)}
              className={`flex items-center justify-between gap-2 w-full text-left px-2.5 py-2.5 rounded-xl text-[13.5px] transition-colors ${on ? 'text-white' : 'text-slate-700 hover:bg-slate-50'}`}
              style={on ? { backgroundColor: ACCENT } : {}}>
              <span className="truncate">{s.label}</span>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 min-w-[24px] text-center ${on ? 'bg-white/20 text-white' : s.internalOnly ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{counts[s.id] || 0}</span>
            </button>
          )
        })}
      </nav>

      {/* списък */}
      <section
        className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-colors ${dropOver ? 'border-emerald-400 ring-4 ring-emerald-100' : 'border-slate-200'}`}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropOver(true) } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDropOver(false) }}
        onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDropOver(false); openUpload(Array.from(e.dataTransfer.files)) } }}>
        <div className="px-5 pt-4 pb-3.5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: ACCENT }}>{cur.label}</h2>
              <div className="text-slate-500 text-[12.5px] mt-0.5 flex items-center gap-2 flex-wrap">
                {cur.internalOnly ? cur.note : <>На сайта: {cur.note}{section === 'internal' && ' · виждат се и в ЕИС → Нормативни документи'}
                  {cur.path && <a href={SITE_URL + cur.path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">виж страницата <ExternalLink size={12} /></a>}</>}
              </div>
            </div>
            <button onClick={() => openUpload()} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Качи документи</button>
          </div>
          <div className="flex gap-2.5 items-center flex-wrap mt-3.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси документ…" className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[13px] bg-slate-50 focus:outline-none focus:bg-white focus:border-slate-400" />
            </div>
            {years.length > 1 && (
              <select value={yearF} onChange={(e) => setYearF(e.target.value)} className="border border-slate-200 rounded-xl px-2.5 py-2 text-[12.5px] bg-white focus:outline-none" aria-label="Година">
                <option value="all">Всички години</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {!cur.internalOnly && (
              <div className="inline-flex bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                {([['all', 'Всички'], ['on', 'На сайта'], ['off', 'Скрити']] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setVis(k)} className={`text-[12.5px] px-3 py-1.5 rounded-lg ${vis === k ? 'bg-white shadow-sm font-medium' : 'text-slate-500'}`} style={vis === k ? { color: ACCENT } : {}}>{lbl}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* общи действия */}
        {selected.size > 0 && (
          <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap text-[12.5px] border-b border-slate-100" style={{ backgroundColor: '#eef2f8' }}>
            <span className="font-semibold" style={{ color: ACCENT }}>Избрани: {selected.size}</span>
            <span className="flex-1" />
            {!cur.internalOnly && <>
              <button onClick={() => patch(Array.from(selected), { on_site: true })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50"><Eye size={13} /> Покажи на сайта</button>
              <button onClick={() => patch(Array.from(selected), { on_site: false })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50"><EyeOff size={13} /> Скрий</button>
            </>}
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 cursor-pointer">
              <FolderInput size={13} />
              <select value="" onChange={(e) => moveTo(e.target.value)} className="bg-transparent focus:outline-none cursor-pointer" aria-label="Премести в раздел">
                <option value="">Премести в…</option>{SECTIONS.filter((s) => s.id !== section).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            {confirmDel === 'bulk' ? (
              <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5">
                <button onClick={() => removeDocs(selDocs)} className="px-2 py-1 font-bold text-rose-700 hover:bg-rose-100 rounded">Изтрий {selected.size}</button>
                <button onClick={() => setConfirmDel(null)} className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded">Отказ</button>
              </span>
            ) : <button onClick={() => setConfirmDel('bulk')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 size={13} /> Изтрий</button>}
            <button onClick={() => setSelected(new Set())} className="p-1.5 rounded-lg text-slate-400 hover:bg-white" title="Откажи избора"><X size={14} /></button>
          </div>
        )}

        {shown.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <FileText size={30} className="text-slate-200 mx-auto mb-2.5" />
            <div className="text-slate-700 font-semibold text-[15px] mb-1">{filtering ? 'Няма съвпадение' : 'Още няма документи тук'}</div>
            <p className="text-sm text-slate-500 max-w-xs mx-auto mb-4">{filtering ? 'Променете търсенето или филтъра.' : 'Пуснете файлове тук или ги изберете от компютъра.'}</p>
            {!filtering && <button onClick={() => openUpload()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Upload size={15} /> Избери файлове</button>}
          </div>
        ) : (
          <><div className="overflow-x-auto"><div role="list" className={rubrics ? 'min-w-[680px]' : 'min-w-[520px]'}>
            <div className="grid items-center gap-3 px-5 py-2 text-[11px] font-semibold text-slate-400 border-b border-slate-100"
              style={{ gridTemplateColumns: rubrics ? '20px 1fr 92px 160px 64px 112px' : '20px 1fr 92px 64px 112px' }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Избери всички" className="accent-[#0f2240]" />
              <span>Документ</span><span>Година</span>{rubrics && <span>Рубрика</span>}<span>{cur.internalOnly ? '' : 'На сайта'}</span><span />
            </div>
            {shown.map((d) => {
              const rub = rubricOf(section, d.category); const editing = editId === d.id; const x = ext(d.file_url)
              return (
                <div key={d.id} role="listitem"
                  draggable={!filtering && !editing}
                  onDragStart={(e) => { setDragId(d.id); e.dataTransfer.effectAllowed = 'move' }}
                  onDragOver={(e) => { if (dragId) e.preventDefault() }}
                  onDrop={(e) => { if (dragId) { e.preventDefault(); e.stopPropagation(); dropOn(d.id) } }}
                  onDragEnd={() => setDragId(null)}
                  className={`group grid items-center gap-3 px-5 py-2.5 border-b border-slate-50 last:border-0 transition-colors hover:bg-blue-50/40 ${dragId === d.id ? 'opacity-40' : ''} ${selected.has(d.id) ? 'bg-blue-50/60' : ''}`}
                  style={{ gridTemplateColumns: rubrics ? '20px 1fr 92px 160px 64px 112px' : '20px 1fr 92px 64px 112px' }}>
                  <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleOne(d.id)} aria-label={`Избери ${d.name}`} className="accent-[#0f2240]" />
                  <div className="flex items-center gap-2.5 min-w-0">
                    {!filtering && <GripVertical size={15} className="text-slate-300 cursor-grab shrink-0 -ml-1" aria-hidden />}
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold uppercase ${EXT_COLOR[x] || 'bg-slate-100 text-slate-500'}`}>{x || <FileText size={15} />}</span>
                    {editing
                      ? <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }} className="flex-1 min-w-0 text-[13.5px] border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-[#0f2240]" />
                      : <a href={d.file_url} target="_blank" rel="noopener noreferrer" title={d.name} onDoubleClick={(e) => { e.preventDefault(); startEdit(d) }} className="flex-1 min-w-0 text-[13.5px] font-medium text-slate-800 hover:text-[#0f2240] truncate">{d.name}</a>}
                  </div>
                  {editing
                    ? <input value={editYear} onChange={(e) => setEditYear(e.target.value)} placeholder="година" className="text-[12.5px] border border-slate-300 rounded-lg px-2 py-1 w-full focus:outline-none focus:border-[#0f2240]" />
                    : <div className="text-[12.5px] text-slate-500">{d.academic_year || '—'}</div>}
                  {rubrics && (
                    <select value={d.category || rubrics[0].key} onChange={(e) => patch([d.id], { category: e.target.value })} aria-label="Рубрика"
                      className="w-full text-[11.5px] rounded-lg border px-2 py-1 cursor-pointer focus:outline-none" style={{ color: rub.color, borderColor: rub.color + '55', backgroundColor: rub.color + '12' }}>
                      {rubrics.map((c) => <option key={c.key} value={c.key} style={{ color: '#1f2a3d' }}>{c.title}</option>)}
                    </select>
                  )}
                  <div>{cur.internalOnly ? <span className="text-[11px] text-slate-400">—</span> : <Switch on={d.on_site} onClick={() => patch([d.id], { on_site: !d.on_site })} />}</div>
                  <div className="flex items-center gap-0.5 justify-end">
                    {editing ? (<>
                      <button onClick={saveEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50" title="Запази"><Check size={16} /></button>
                      <button onClick={() => setEditId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" title="Отказ"><X size={16} /></button>
                    </>) : confirmDel === d.id ? (
                      <span className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5">
                        <button onClick={() => removeDocs([d])} className="px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 rounded">Изтрий</button>
                        <button onClick={() => setConfirmDel(null)} className="px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 rounded">Отказ</button>
                      </span>
                    ) : (<>
                      <button onClick={() => startEdit(d)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-[#0f2240]" title="Преименувай"><Pencil size={14} /></button>
                      <button onClick={() => { replaceFor.current = d; replaceInput.current?.click() }} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-[#0f2240]" title="Качи нова версия"><RefreshCw size={14} /></button>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer" download className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-[#0f2240]" title="Свали"><Download size={15} /></a>
                      <button onClick={() => setConfirmDel(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-600" title="Изтрий"><Trash2 size={14} /></button>
                    </>)}
                  </div>
                </div>
              )
            })}
          </div></div>
            <div className="px-5 py-3 border-t border-slate-100 text-[12px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <span>{shown.length} {shown.length === 1 ? 'документ' : 'документа'}</span>
              {!filtering && <span>Редът се сменя с влачене. Двоен клик върху името го преименува. Файлове могат да се пускат направо тук.</span>}
            </div>
          </>
        )}
      </section>

      <input ref={replaceInput} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && replaceFor.current) replaceFile(replaceFor.current, f); e.currentTarget.value = '' }} />

      <Toast notice={notice} />
      <Drawer open={drawer} onClose={() => !progress && setDrawer(false)} title="Качи документи" width={560}
        footer={<>
          <button onClick={() => setDrawer(false)} disabled={!!progress} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Отказ</button>
          <button onClick={uploadAll} disabled={!!progress || pending.length === 0} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>
            {progress ? <><Spinner /> {progress.done} от {progress.total}</> : <><Upload size={15} /> Качи {pending.length > 1 ? `${pending.length} документа` : 'документа'}</>}
          </button>
        </>}>
        <Field label="Раздел"><select value={section} onChange={(e) => pickSection(e.target.value)} className={INPUT}>{SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}{s.internalOnly ? ' (не на сайта)' : ''}</option>)}</select></Field>
        <label
          className="block border-[1.5px] border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const fs = Array.from(e.dataTransfer.files); setPending((p) => [...p, ...fs.map((f) => ({ file: f, name: suggestName(f.name) }))]) }}>
          <input type="file" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files || []); setPending((p) => [...p, ...fs.map((f) => ({ file: f, name: suggestName(f.name) }))]); e.currentTarget.value = '' }} />
          <Upload size={18} className="mx-auto mb-1.5 text-slate-400" />
          <span className="block text-[13.5px] font-medium text-slate-700">Изберете или пуснете файлове тук</span>
          <span className="block text-[12px] text-slate-400 mt-0.5">PDF, Word, Excel · може много наведнъж</span>
        </label>
        {pending.length > 0 && (
          <Field label="Име на всеки документ на сайта">
            <div className="space-y-2">
              {pending.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[9.5px] font-bold uppercase ${EXT_COLOR[(p.file.name.split('.').pop() || '').toLowerCase()] || 'bg-slate-100 text-slate-500'}`}>{p.file.name.split('.').pop()}</span>
                  <input value={p.name} onChange={(e) => setPending((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={INPUT + ' !py-2'} aria-label={`Име за ${p.file.name}`} />
                  <button type="button" onClick={() => setPending((arr) => arr.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Махни"><X size={14} /></button>
                </div>
              ))}
            </div>
          </Field>
        )}
        {rubrics && <Field label="Рубрика"><select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>{rubrics.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}</select></Field>}
        <Field label="Година (по избор)"><input value={year} onChange={(e) => setYear(e.target.value)} placeholder="напр. 2026 или 2025/2026" className={INPUT} /></Field>
        {!cur.internalOnly && <Switch on={onSite} onClick={() => setOnSite((v) => !v)} label="Показвай на сайта веднага" />}
      </Drawer>
    </div>
  )
}
