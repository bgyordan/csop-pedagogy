'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  FileText, Upload, Loader2, Trash2, Download, Plus, X, Check,
  Search, Pencil, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft,
  Newspaper, CalendarDays, Images, LayoutTemplate, EyeOff, Star, MapPin, Clock,
} from 'lucide-react'

const ACCENT = '#0f2240'
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('bg-BG') : '')
const MONTHS_SHORT = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек']

/* ═══════════════ типове ═══════════════ */
interface Doc { id: string; name: string; file_url: string; academic_year: string | null; section: string; category: string | null; on_site: boolean; sort_order: number }
interface News { id: string; title: string; excerpt: string | null; content: string | null; cover_url: string | null; category: string; status: string; published_at: string | null; created_at: string }
interface Ev { id: string; title: string; event_date: string; event_time: string | null; location: string | null; description: string | null }
interface Album { id: string; title: string; cover_url: string | null; event_date: string | null; sort_order: number }
interface Photo { id: string; album_id: string; photo_url: string; caption: string | null; sort_order: number }

const SECTIONS: { id: string; label: string; note: string; internalOnly?: boolean }[] = [
  { id: 'internal', label: 'Вътрешни документи', note: 'За нас · Вътрешни правила' },
  { id: 'budget', label: 'Бюджет и финанси', note: 'За нас · Бюджет и финанси' },
  { id: 'admission', label: 'Декларации за прием', note: 'Прием · Процедура' },
  { id: 'zdoi', label: 'Достъп до информация', note: 'ЗДОИ' },
  { id: 'privacy', label: 'Лични данни', note: 'ЗЗЛД' },
  { id: 'signali', label: 'Сигнали', note: 'ЗЗЛПСПОИН' },
  { id: 'eis', label: 'Само за деловодство', note: 'Не се показва на сайта', internalOnly: true },
]
const RUBRICS = [
  { key: 'strategy', title: 'Стратегия и планове', color: '#7c3aed' },
  { key: 'rules', title: 'Правилници и вътрешни правила', color: '#0d9488' },
  { key: 'programs', title: 'Програми', color: '#2563eb' },
  { key: 'ethics', title: 'Етика и приобщаване', color: '#db2777' },
  { key: 'safety', title: 'Безопасност', color: '#ea580c' },
  { key: 'data', title: 'Защита на данните', color: '#475569' },
  { key: 'other', title: 'Общи', color: '#64748b' },
]
const rubricOf = (k: string | null) => RUBRICS.find((r) => r.key === k) || RUBRICS[RUBRICS.length - 1]
const NEWS_CATS = ['Новини', 'Събития', 'Публикации', 'Моменти']

const TABS = [
  { id: 'docs', label: 'Документи', icon: FileText },
  { id: 'news', label: 'Новини', icon: Newspaper },
  { id: 'events', label: 'Събития', icon: CalendarDays },
  { id: 'gallery', label: 'Галерия', icon: Images },
  { id: 'hero', label: 'Начална страница', icon: LayoutTemplate },
]

/* ═══════════════ малки помощници за UI ═══════════════ */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[12.5px] font-medium text-slate-600 mb-1.5">{label}</label>{children}</div>
}
const INPUT = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13.5px] bg-slate-50 focus:outline-none focus:border-slate-500 focus:bg-white'
function Toast({ notice }: { notice: { msg: string; err?: boolean } | null }) {
  if (!notice) return null
  return <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl text-sm shadow-lg ${notice.err ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'}`}>{notice.msg}</div>
}
function Drawer({ open, onClose, title, children, footer, width = 500 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer: React.ReactNode; width?: number }) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-[#0f2240]/25 backdrop-blur-[2px] z-40" onClick={onClose} />}
      <div className="fixed top-0 right-0 bottom-0 bg-white z-50 shadow-2xl flex flex-col transition-transform duration-200"
        style={{ width: `min(${width}px,94vw)`, transform: open ? 'translateX(0)' : 'translateX(100%)' }}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <h3 className="text-base font-semibold flex-1" style={{ color: ACCENT }}>{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-4">{children}</div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-2.5">{footer}</div>
      </div>
    </>
  )
}

/* ═══════════════ обвивка ═══════════════ */
export default function SiteDocsClient({
  docs = [], defaultYear, news = [], authorId, events = [], albums = [], photos = [], heroPhotos = [],
}: {
  docs: Doc[]; defaultYear: string; news?: News[]; authorId: string | null
  events?: Ev[]; albums?: Album[]; photos?: Photo[]; heroPhotos?: string[]
}) {
  const [tab, setTab] = useState('docs')
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Hero с лек нюанс */}
      <div className="-mx-4 md:-mx-8 px-4 md:px-8 pt-4 pb-5 rounded-b-[28px]"
        style={{ background: 'linear-gradient(180deg, rgba(15,34,64,.05), rgba(15,34,64,0))' }}>
        <div className="text-center">
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-tight" style={{ color: ACCENT }}>Сайт</h1>
          <p className="text-slate-500 text-sm md:text-[15px] mt-2 max-w-lg mx-auto">
            Съдържанието на публичния сайт — новини, документи, събития и галерия, от едно място.
          </p>
          <a href="https://csop-varna.bg" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[12.5px] text-slate-500 bg-white border border-slate-200 rounded-full px-3.5 py-2 hover:text-slate-700 mt-4 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span> csop-varna.bg
          </a>
        </div>
      </div>

      {/* Секции */}
      <div className="flex flex-wrap justify-center items-end border-b border-slate-200 mb-7 mt-1">
        {TABS.map((t) => {
          const Icon = t.icon; const on = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-1.5 px-3 sm:px-3.5 h-11 text-[13px] sm:text-sm font-medium leading-none rounded-t-lg transition-colors ${on ? '' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              style={on ? { color: ACCENT } : {}}>
              <Icon size={15} className="shrink-0" /> <span className="whitespace-nowrap">{t.label}</span>
              {on && <span className="absolute left-2 right-2 -bottom-px h-[2.5px] rounded" style={{ backgroundColor: ACCENT }} />}
            </button>
          )
        })}
      </div>

      {tab === 'docs' && <DocumentsManager initial={docs} defaultYear={defaultYear} />}
      {tab === 'news' && <NewsManager initial={news} authorId={authorId} />}
      {tab === 'events' && <EventsManager initial={events} />}
      {tab === 'gallery' && <GalleryManager initialAlbums={albums} initialPhotos={photos} />}
      {tab === 'hero' && <HeroManager photos={photos} albums={albums} initialSelected={heroPhotos} />}
    </div>
  )
}

/* ═══════════════ ДОКУМЕНТИ ═══════════════ */
function DocumentsManager({ initial, defaultYear }: { initial: Doc[]; defaultYear: string }) {
  const supabase = createClient(); const router = useRouter()
  const [list, setList] = useState<Doc[]>(initial)
  const [section, setSection] = useState('internal')
  const [q, setQ] = useState(''); const [visFilter, setVisFilter] = useState<'all' | 'on' | 'off'>('all')
  const [drawer, setDrawer] = useState(false); const [busy, setBusy] = useState(false)
  const [name, setName] = useState(''); const [year, setYear] = useState(defaultYear || '2025/2026')
  const [category, setCategory] = useState('rules'); const [onSite, setOnSite] = useState(true); const [file, setFile] = useState<File | null>(null)
  const [editId, setEditId] = useState<string | null>(null); const [editName, setEditName] = useState(''); const [editYear, setEditYear] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }

  const curSection = SECTIONS.find((s) => s.id === section)!
  const isInternal = section === 'internal'
  const counts = useMemo(() => { const c: Record<string, number> = {}; list.forEach((d) => { c[d.section] = (c[d.section] || 0) + 1 }); return c }, [list])
  const sectionDocs = useMemo(() => list.filter((d) => d.section === section)
    .filter((d) => (visFilter === 'all' ? true : visFilter === 'on' ? d.on_site : !d.on_site))
    .filter((d) => (q.trim() ? d.name.toLowerCase().includes(q.trim().toLowerCase()) : true))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), [list, section, visFilter, q])

  async function upload() {
    if (!name.trim() || !file) { flash('Посочете наименование и изберете файл.', true); return }
    try {
      setBusy(true)
      const path = `${section}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('public-docs').upload(path, file); if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('public-docs').getPublicUrl(path)
      const sort = list.filter((d) => d.section === section).reduce((m, d) => Math.max(m, d.sort_order || 0), 0) + 1
      const { data, error } = await supabase.from('site_documents').insert({
        name: name.trim(), file_url: pub.publicUrl, academic_year: year.trim() || null, section,
        category: isInternal ? category : null, on_site: onSite, sort_order: sort,
      }).select('*').single()
      if (error || !data) throw error || new Error('Грешка при запис')
      setList((prev) => [...prev, data as Doc]); setName(''); setFile(null); setCategory('rules'); setDrawer(false)
      flash('Документът е качен.'); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка при качване.', true) } finally { setBusy(false) }
  }
  async function toggleSite(d: Doc) { const next = !d.on_site; setList((p) => p.map((x) => x.id === d.id ? { ...x, on_site: next } : x)); await supabase.from('site_documents').update({ on_site: next }).eq('id', d.id); router.refresh() }
  async function changeCategory(d: Doc, cat: string) { setList((p) => p.map((x) => x.id === d.id ? { ...x, category: cat } : x)); await supabase.from('site_documents').update({ category: cat }).eq('id', d.id); router.refresh() }
  function startEdit(d: Doc) { setEditId(d.id); setEditName(d.name); setEditYear(d.academic_year || '') }
  async function saveEdit() { if (!editId || !editName.trim()) return; const patch = { name: editName.trim(), academic_year: editYear.trim() || null }; setList((p) => p.map((x) => x.id === editId ? { ...x, ...patch } : x)); await supabase.from('site_documents').update(patch).eq('id', editId); setEditId(null); router.refresh() }
  async function move(d: Doc, dir: -1 | 1) {
    const arr = sectionDocs; const i = arr.findIndex((x) => x.id === d.id); const j = i + dir; if (j < 0 || j >= arr.length) return
    const other = arr[j]; const a = d.sort_order, b = other.sort_order
    setList((p) => p.map((x) => x.id === d.id ? { ...x, sort_order: b } : x.id === other.id ? { ...x, sort_order: a } : x))
    await supabase.from('site_documents').update({ sort_order: b }).eq('id', d.id)
    await supabase.from('site_documents').update({ sort_order: a }).eq('id', other.id); router.refresh()
  }
  async function remove(d: Doc) {
    try {
      const sp = d.file_url.split('/public-docs/')[1]?.split('?')[0]
      if (sp) await supabase.storage.from('public-docs').remove([decodeURIComponent(sp)])
      await supabase.from('site_documents').delete().eq('id', d.id)
      setList((p) => p.filter((x) => x.id !== d.id)); setDeletingId(null); flash(`„${d.name}“ беше изтрит.`); router.refresh()
    } catch { flash('Грешка при изтриване.', true) }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[230px_1fr] gap-5">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-2 h-fit">
        <div className="text-[11px] font-semibold text-slate-400 px-2.5 pt-2 pb-1.5">Раздели на сайта</div>
        {SECTIONS.map((s) => {
          const on = section === s.id
          return (
            <button key={s.id} onClick={() => { setSection(s.id); setEditId(null); setDeletingId(null) }}
              className={`flex items-center justify-between gap-2 w-full text-left px-2.5 py-2.5 rounded-xl text-[13.5px] transition-colors ${on ? 'text-white' : 'text-slate-700 hover:bg-slate-50'}`}
              style={on ? { backgroundColor: ACCENT } : {}}>
              <span className="truncate">{s.label}</span>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 min-w-[24px] text-center ${on ? 'bg-white/20 text-white' : s.internalOnly ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{counts[s.id] || 0}</span>
            </button>
          )
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3.5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: ACCENT }}>{curSection.label}</h2>
              <div className="text-slate-500 text-[12.5px] mt-0.5">{curSection.internalOnly ? 'Само в ЕИС · не се показва на сайта' : `На сайта в раздел „${curSection.note}“`}</div>
            </div>
            <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Качи документ</button>
          </div>
          <div className="flex gap-2.5 items-center flex-wrap mt-3.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси документ…" className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[13px] bg-slate-50 focus:outline-none focus:bg-white focus:border-slate-400" />
            </div>
            {!curSection.internalOnly && (
              <div className="inline-flex bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                {([['all', 'Всички'], ['on', 'На сайта'], ['off', 'Скрити']] as const).map(([k, lbl]) => (
                  <button key={k} onClick={() => setVisFilter(k)} className={`text-[12.5px] px-3 py-1.5 rounded-lg ${visFilter === k ? 'bg-white shadow-sm font-medium' : 'text-slate-500'}`} style={visFilter === k ? { color: ACCENT } : {}}>{lbl}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {sectionDocs.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <FileText size={30} className="text-slate-200 mx-auto mb-2.5" />
            <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма документи тук</div>
            <p className="text-sm text-slate-500 max-w-xs mx-auto mb-4">{q.trim() ? 'Няма съвпадение с търсенето.' : 'Качи първия документ за този раздел.'}</p>
            {!q.trim() && <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Качи документ</button>}
          </div>
        ) : (
          <div>
            {sectionDocs.map((d, idx) => {
              const rub = rubricOf(d.category); const editing = editId === d.id; const confirming = deletingId === d.id
              return (
                <div key={d.id} className={`group grid items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0 transition-colors ${idx % 2 ? 'bg-slate-50/40' : ''} hover:bg-blue-50/40`}
                  style={{ gridTemplateColumns: isInternal ? '1fr 100px 170px 92px 78px' : '1fr 110px 96px 78px' }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex flex-col -my-1">
                      <button onClick={() => move(d, -1)} disabled={idx === 0} className="w-5 h-4 flex items-center justify-center text-slate-300 hover:text-[#0f2240] disabled:opacity-0"><ChevronUp size={14} /></button>
                      <button onClick={() => move(d, 1)} disabled={idx === sectionDocs.length - 1} className="w-5 h-4 flex items-center justify-center text-slate-300 hover:text-[#0f2240] disabled:opacity-0"><ChevronDown size={14} /></button>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0"><FileText size={16} /></div>
                    {editing
                      ? <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null) }} className="flex-1 min-w-0 text-[13.5px] border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-[#0f2240]" />
                      : <a href={d.file_url} target="_blank" rel="noopener noreferrer" title={d.name} className="flex-1 min-w-0 text-[13.5px] font-medium text-slate-800 hover:text-[#0f2240] truncate">{d.name}</a>}
                  </div>
                  {editing
                    ? <input value={editYear} onChange={(e) => setEditYear(e.target.value)} placeholder="година" className="text-[12.5px] border border-slate-300 rounded-lg px-2 py-1 w-full focus:outline-none focus:border-[#0f2240]" />
                    : <div className="text-[12.5px] text-slate-500">{d.academic_year || '—'}</div>}
                  {isInternal && (
                    <div>
                      <select value={d.category || 'other'} onChange={(e) => changeCategory(d, e.target.value)} className="w-full text-[11.5px] rounded-lg border px-2 py-1 cursor-pointer focus:outline-none" style={{ color: rub.color, borderColor: rub.color + '55', backgroundColor: rub.color + '12' }}>
                        {RUBRICS.map((c) => <option key={c.key} value={c.key} style={{ color: '#1f2a3d' }}>{c.title}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    {curSection.internalOnly ? <span className="text-[11px] text-slate-400">—</span> : (
                      <button onClick={() => toggleSite(d)} className="inline-flex items-center" title={d.on_site ? 'Показва се на сайта' : 'Скрит'}>
                        <span className={`w-[34px] h-[19px] rounded-full relative transition-colors ${d.on_site ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 w-[15px] h-[15px] rounded-full bg-white shadow transition-all ${d.on_site ? 'left-[17px]' : 'left-0.5'}`} /></span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                    {editing ? (<>
                      <button onClick={saveEdit} className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50" title="Запази"><Check size={16} /></button>
                      <button onClick={() => setEditId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100" title="Отказ"><X size={16} /></button>
                    </>) : confirming ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5">
                        <button onClick={() => remove(d)} className="px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 rounded">Изтрий</button>
                        <button onClick={() => setDeletingId(null)} className="px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 rounded">Отказ</button>
                      </div>
                    ) : (<>
                      <button onClick={() => startEdit(d)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-[#0f2240]" title="Преименувай"><Pencil size={14} /></button>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer" download className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-[#0f2240]" title="Свали"><Download size={15} /></a>
                      <button onClick={() => setDeletingId(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Изтрий"><Trash2 size={14} /></button>
                    </>)}
                  </div>
                </div>
              )
            })}
            <div className="px-5 py-3 border-t border-slate-100 text-[12.5px] text-slate-500">{sectionDocs.length} {sectionDocs.length === 1 ? 'документ' : 'документа'}</div>
          </div>
        )}
      </div>

      <Toast notice={notice} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Качи документ"
        footer={<>
          <button onClick={() => setDrawer(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Отказ</button>
          <button onClick={upload} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Качи документа</button>
        </>}>
        <Field label="Раздел"><select value={section} onChange={(e) => setSection(e.target.value)} className={INPUT}>{SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}{s.internalOnly ? ' (не на сайта)' : ''}</option>)}</select></Field>
        <Field label="Наименование"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Правилник за дейността на ЦСОП" className={INPUT} /></Field>
        {isInternal && <Field label="Рубрика"><select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>{RUBRICS.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}</select></Field>}
        <Field label="Учебна година"><input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2025/2026" className={INPUT} /></Field>
        <Field label="Файл">
          <label className="block border-[1.5px] border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors">
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Upload size={18} className="mx-auto mb-1.5 text-slate-400" />
            <span className="block text-[13.5px] font-medium text-slate-700">{file ? file.name : 'Избери файл'}</span>
            <span className="block text-[12px] text-slate-400 mt-0.5">PDF, Word · до 10 MB</span>
          </label>
        </Field>
        {!curSection.internalOnly && (
          <button onClick={() => setOnSite((v) => !v)} className="inline-flex items-center gap-2">
            <span className={`w-[34px] h-[19px] rounded-full relative transition-colors ${onSite ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 w-[15px] h-[15px] rounded-full bg-white shadow transition-all ${onSite ? 'left-[17px]' : 'left-0.5'}`} /></span>
            <span className="text-[12.5px] text-slate-600">Показвай на сайта веднага</span>
          </button>
        )}
      </Drawer>
    </div>
  )
}

/* ═══════════════ НОВИНИ ═══════════════ */
function NewsManager({ initial, authorId }: { initial: News[]; authorId: string | null }) {
  const supabase = createClient(); const router = useRouter()
  const [list, setList] = useState<News[]>(initial)
  const [q, setQ] = useState(''); const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [perPage, setPerPage] = useState(12); const [page, setPage] = useState(1)
  const [drawer, setDrawer] = useState(false); const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState(''); const [category, setCategory] = useState('Новини')
  const [excerpt, setExcerpt] = useState(''); const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null); const [existingCover, setExistingCover] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }

  const shown = useMemo(() => list.filter((n) => (statusFilter === 'all' ? true : n.status === statusFilter)).filter((n) => (q.trim() ? n.title.toLowerCase().includes(q.trim().toLowerCase()) : true)), [list, statusFilter, q])
  const pageCount = Math.max(1, Math.ceil(shown.length / perPage))
  const curPage = Math.min(page, pageCount)
  const paged = perPage >= 9999 ? shown : shown.slice((curPage - 1) * perPage, curPage * perPage)
  const draftCount = list.filter((n) => n.status !== 'published').length

  function openNew() { setEditId(null); setTitle(''); setCategory('Новини'); setExcerpt(''); setContent(''); setFile(null); setExistingCover(null); setDrawer(true) }
  function openEdit(n: News) { setEditId(n.id); setTitle(n.title); setCategory(n.category); setExcerpt(n.excerpt || ''); setContent(n.content || ''); setFile(null); setExistingCover(n.cover_url); setDrawer(true) }

  async function save(status: 'draft' | 'published') {
    if (!title.trim()) { flash('Въведете заглавие.', true); return }
    try {
      setBusy(true); let coverUrl = existingCover
      if (file) {
        const ext = file.name.split('.').pop()
        const path = `news/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('public-media').upload(path, file); if (upErr) throw upErr
        coverUrl = supabase.storage.from('public-media').getPublicUrl(path).data.publicUrl
      }
      const payload = { title: title.trim(), excerpt: excerpt.trim() || null, content: content.trim() || null, cover_url: coverUrl, category, status, author_id: authorId, published_at: status === 'published' ? new Date().toISOString() : null }
      if (editId) { const { data, error } = await supabase.from('site_news').update(payload).eq('id', editId).select('*').single(); if (error) throw error; setList((p) => p.map((x) => x.id === editId ? (data as News) : x)) }
      else { const { data, error } = await supabase.from('site_news').insert(payload).select('*').single(); if (error) throw error; setList((p) => [data as News, ...p]) }
      setDrawer(false); flash(status === 'published' ? 'Публикувано.' : 'Запазено като чернова.'); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка при запис.', true) } finally { setBusy(false) }
  }
  async function togglePublish(n: News) { const next = n.status === 'published' ? 'draft' : 'published'; const published_at = next === 'published' ? new Date().toISOString() : null; setList((p) => p.map((x) => x.id === n.id ? { ...x, status: next, published_at } : x)); await supabase.from('site_news').update({ status: next, published_at }).eq('id', n.id); router.refresh() }
  async function remove(n: News) { if (!confirm(`Изтриване на „${n.title}“?`)) return; await supabase.from('site_news').delete().eq('id', n.id); setList((p) => p.filter((x) => x.id !== n.id)); flash('Изтрито.'); router.refresh() }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Новини</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5">{list.length} общо · {draftCount} чернови</div>
        </div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Търси новина…" className="border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[13px] bg-white w-[180px] focus:outline-none focus:border-slate-400" />
          </div>
          <div className="inline-flex bg-white border border-slate-200 rounded-xl p-0.5">
            {([['all', 'Всички'], ['published', 'Публикувани'], ['draft', 'Чернови']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => { setStatusFilter(k); setPage(1) }} className={`text-[12.5px] px-3 py-1.5 rounded-lg ${statusFilter === k ? 'text-white font-medium' : 'text-slate-500'}`} style={statusFilter === k ? { backgroundColor: ACCENT } : {}}>{lbl}</button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
            <span>Покажи</span>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1) }} className="border border-slate-200 rounded-lg px-2 py-1.5 text-[12.5px] bg-white cursor-pointer focus:outline-none">
              <option value={5}>5</option><option value={12}>12</option><option value={24}>24</option><option value={9999}>всички</option>
            </select>
          </div>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Нова новина</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <Newspaper size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма новини</div>
          <p className="text-sm text-slate-500 mb-4">{q.trim() ? 'Няма съвпадение с търсенето.' : 'Създай първата новина за сайта.'}</p>
          {!q.trim() && <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Нова новина</button>}
        </div>
      ) : (<>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))' }}>
          {paged.map((n) => {
            const draft = n.status !== 'published'
            return (
              <div key={n.id} className={`rounded-2xl border overflow-hidden shadow-sm flex flex-col ${draft ? 'border-dashed border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-white'}`}>
                <div className="h-[140px] relative flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-100">
                  {n.cover_url ? <img src={n.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[13px] font-bold text-slate-300 tracking-widest">ЦСОП</span>}
                  <span className={`absolute top-2.5 left-2.5 text-[10.5px] font-semibold px-2.5 py-1 rounded-full ${draft ? 'bg-white text-amber-700 border border-amber-200' : 'bg-emerald-500 text-white'}`}>{draft ? 'Чернова' : 'Публикувана'}</span>
                </div>
                <div className="p-3.5 flex-1">
                  <div className="text-[11px] font-semibold text-teal-600">{n.category}</div>
                  <h4 className="text-[15px] font-semibold mt-1 mb-1.5 leading-snug tracking-tight" style={{ color: ACCENT }}>{n.title}</h4>
                  {n.excerpt && <p className="text-[12.5px] text-slate-500 leading-relaxed line-clamp-2">{n.excerpt}</p>}
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-slate-100">
                  {draft ? <button onClick={() => togglePublish(n)} className="text-[12px] font-semibold text-teal-600 hover:text-teal-700">Публикувай →</button> : <span className="text-[11.5px] text-slate-400">{fmtDate(n.published_at || n.created_at)}</span>}
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => openEdit(n)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-[#0f2240]" title="Редактирай"><Pencil size={14} /></button>
                    {!draft && <button onClick={() => togglePublish(n)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-[#0f2240]" title="Върни в чернова"><EyeOff size={14} /></button>}
                    <button onClick={() => remove(n)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Изтрий"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
            <div className="text-[12.5px] text-slate-500">Показани {(curPage - 1) * perPage + 1}–{Math.min(curPage * perPage, shown.length)} от {shown.length}</div>
            <div className="flex gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={curPage === 1} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={15} /></button>
              {Array.from({ length: pageCount }).map((_, i) => (
                <button key={i} onClick={() => setPage(i + 1)} className={`min-w-8 h-8 px-2 rounded-lg border text-[12.5px] ${curPage === i + 1 ? 'text-white border-transparent' : 'bg-white border-slate-200 hover:bg-slate-50'}`} style={curPage === i + 1 ? { backgroundColor: ACCENT } : {}}>{i + 1}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={curPage === pageCount} className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </>)}

      <Toast notice={notice} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={editId ? 'Редактирай новина' : 'Нова новина'}
        footer={<>
          <button onClick={() => save('draft')} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">{busy ? '…' : 'Запази чернова'}</button>
          <button onClick={() => save('published')} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Публикувай</button>
        </>}>
        <Field label="Заглавие"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Открит урок по приобщаващо образование" className={INPUT} /></Field>
        <Field label="Категория"><select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>{NEWS_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Кратък текст (откъс)"><textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} placeholder="Едно-две изречения за списъка на сайта." className={INPUT + ' resize-y'} /></Field>
        <Field label="Съдържание"><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="Пълният текст на новината…" className={INPUT + ' resize-y leading-relaxed'} /></Field>
        <Field label="Корица (по избор)">
          {existingCover && !file && <img src={existingCover} alt="" className="w-full h-32 object-cover rounded-xl mb-2" />}
          <label className="block border-[1.5px] border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Upload size={18} className="mx-auto mb-1.5 text-slate-400" />
            <span className="block text-[13px] font-medium text-slate-700">{file ? file.name : existingCover ? 'Смени снимката' : 'Избери снимка'}</span>
            <span className="block text-[12px] text-slate-400 mt-0.5">JPG, PNG</span>
          </label>
        </Field>
      </Drawer>
    </div>
  )
}

/* ═══════════════ СЪБИТИЯ ═══════════════ */
function EventsManager({ initial }: { initial: Ev[] }) {
  const supabase = createClient(); const router = useRouter()
  const [list, setList] = useState<Ev[]>(initial)
  const [q, setQ] = useState(''); const [when, setWhen] = useState<'all' | 'upcoming' | 'past'>('all')
  const [drawer, setDrawer] = useState(false); const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState(''); const [date, setDate] = useState(''); const [time, setTime] = useState('')
  const [location, setLocation] = useState(''); const [description, setDescription] = useState('')
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }
  const today = new Date().toISOString().split('T')[0]

  const shown = useMemo(() => list
    .filter((e) => (when === 'all' ? true : when === 'upcoming' ? e.event_date >= today : e.event_date < today))
    .filter((e) => (q.trim() ? e.title.toLowerCase().includes(q.trim().toLowerCase()) : true))
    .sort((a, b) => b.event_date.localeCompare(a.event_date)), [list, when, q, today])

  function openNew() { setEditId(null); setTitle(''); setDate(''); setTime(''); setLocation(''); setDescription(''); setDrawer(true) }
  function openEdit(e: Ev) { setEditId(e.id); setTitle(e.title); setDate(e.event_date); setTime(e.event_time || ''); setLocation(e.location || ''); setDescription(e.description || ''); setDrawer(true) }
  async function save() {
    if (!title.trim() || !date) { flash('Попълнете заглавие и дата.', true); return }
    try {
      setBusy(true)
      const payload = { title: title.trim(), event_date: date, event_time: time.trim() || null, location: location.trim() || null, description: description.trim() || null }
      if (editId) { const { data, error } = await supabase.from('site_events').update(payload).eq('id', editId).select('*').single(); if (error) throw error; setList((p) => p.map((x) => x.id === editId ? (data as Ev) : x)) }
      else { const { data, error } = await supabase.from('site_events').insert(payload).select('*').single(); if (error) throw error; setList((p) => [data as Ev, ...p]) }
      setDrawer(false); flash('Записано.'); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка.', true) } finally { setBusy(false) }
  }
  async function remove(e: Ev) { if (!confirm(`Изтриване на „${e.title}“?`)) return; await supabase.from('site_events').delete().eq('id', e.id); setList((p) => p.filter((x) => x.id !== e.id)); flash('Изтрито.'); router.refresh() }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div><h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Събития</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5">Предстоящи и минали · показват се в календара на сайта</div></div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси събитие…" className="border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[13px] bg-white w-[180px] focus:outline-none focus:border-slate-400" /></div>
          <div className="inline-flex bg-white border border-slate-200 rounded-xl p-0.5">
            {([['all', 'Всички'], ['upcoming', 'Предстоящи'], ['past', 'Минали']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => setWhen(k)} className={`text-[12.5px] px-3 py-1.5 rounded-lg ${when === k ? 'text-white font-medium' : 'text-slate-500'}`} style={when === k ? { backgroundColor: ACCENT } : {}}>{lbl}</button>
            ))}
          </div>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Ново събитие</button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <CalendarDays size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма събития</div>
          <p className="text-sm text-slate-500 mb-4">{q.trim() ? 'Няма съвпадение.' : 'Добави първото събитие.'}</p>
          {!q.trim() && <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Ново събитие</button>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {shown.map((e) => {
            const d = new Date(e.event_date + 'T00:00'); const past = e.event_date < today
            return (
              <div key={e.id} className="group flex gap-4 items-center px-5 py-4 border-b border-slate-50 last:border-0 hover:bg-blue-50/40">
                <div className="w-14 text-center shrink-0">
                  <div className={`text-[22px] font-bold leading-none ${past ? 'text-slate-300' : ''}`} style={past ? {} : { color: ACCENT }}>{d.getDate()}</div>
                  <div className="text-[11px] text-slate-500">{MONTHS_SHORT[d.getMonth()]}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-[14.5px] font-medium text-slate-800">{e.title}</b>
                  <div className="text-[12px] text-slate-500 mt-0.5 flex gap-3 flex-wrap">
                    {e.event_time && <span className="inline-flex items-center gap-1"><Clock size={12} /> {e.event_time}</span>}
                    {e.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {e.location}</span>}
                  </div>
                </div>
                <span className={`text-[10.5px] px-2.5 py-1 rounded-full font-semibold shrink-0 ${past ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>{past ? 'минало' : 'предстои'}</span>
                <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(e)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-[#0f2240]" title="Редактирай"><Pencil size={14} /></button>
                  <button onClick={() => remove(e)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Изтрий"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toast notice={notice} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={editId ? 'Редактирай събитие' : 'Ново събитие'}
        footer={<>
          <button onClick={() => setDrawer(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Отказ</button>
          <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази</button>
        </>}>
        <Field label="Заглавие"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Родителска среща" className={INPUT} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} /></Field>
          <Field label="Час (по избор)"><input value={time} onChange={(e) => setTime(e.target.value)} placeholder="18:00" className={INPUT} /></Field>
        </div>
        <Field label="Място (по избор)"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Актова зала" className={INPUT} /></Field>
        <Field label="Описание (по избор)"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={INPUT + ' resize-y'} /></Field>
      </Drawer>
    </div>
  )
}

/* ═══════════════ ГАЛЕРИЯ ═══════════════ */
function GalleryManager({ initialAlbums, initialPhotos }: { initialAlbums: Album[]; initialPhotos: Photo[] }) {
  const supabase = createClient(); const router = useRouter()
  const [albums, setAlbums] = useState<Album[]>(initialAlbums)
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [openId, setOpenId] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false); const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState(''); const [evDate, setEvDate] = useState('')
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }

  const openAlbum = albums.find((a) => a.id === openId)
  const openPhotos = photos.filter((p) => p.album_id === openId).sort((a, b) => a.sort_order - b.sort_order)

  async function createAlbum() {
    if (!title.trim()) { flash('Въведете заглавие на албума.', true); return }
    try {
      setBusy(true)
      const { data, error } = await supabase.from('gallery_albums').insert({ title: title.trim(), event_date: evDate || null, sort_order: albums.length + 1 }).select('*').single()
      if (error) throw error
      setAlbums((p) => [...p, data as Album]); setTitle(''); setEvDate(''); setDrawer(false); flash('Албумът е създаден.'); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка.', true) } finally { setBusy(false) }
  }
  async function deleteAlbum(a: Album) {
    if (!confirm(`Изтриване на албума „${a.title}“ и всичките му снимки?`)) return
    await supabase.from('gallery_albums').delete().eq('id', a.id)
    setAlbums((p) => p.filter((x) => x.id !== a.id)); setPhotos((p) => p.filter((x) => x.album_id !== a.id))
    if (openId === a.id) setOpenId(null); flash('Албумът е изтрит.'); router.refresh()
  }
  async function uploadPhotos(albumId: string, files: FileList) {
    setBusy(true)
    const existing = photos.filter((p) => p.album_id === albumId).length
    const added: Photo[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]; const ext = f.name.split('.').pop()
      const path = `gallery/${albumId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('public-media').upload(path, f); if (upErr) continue
      const url = supabase.storage.from('public-media').getPublicUrl(path).data.publicUrl
      const { data } = await supabase.from('gallery_photos').insert({ album_id: albumId, photo_url: url, sort_order: existing + i + 1 }).select('*').single()
      if (data) added.push(data as Photo)
    }
    setPhotos((p) => [...p, ...added])
    // ако албумът няма корица — сложи първата качена
    if (added.length && openAlbum && !openAlbum.cover_url) await setCover(albumId, added[0].photo_url)
    setBusy(false); flash(`Качени ${added.length} снимки.`); router.refresh()
  }
  async function setCover(albumId: string, url: string) { setAlbums((p) => p.map((a) => a.id === albumId ? { ...a, cover_url: url } : a)); await supabase.from('gallery_albums').update({ cover_url: url }).eq('id', albumId); router.refresh() }
  async function deletePhoto(p: Photo) { await supabase.from('gallery_photos').delete().eq('id', p.id); setPhotos((prev) => prev.filter((x) => x.id !== p.id)); router.refresh() }

  // Изглед на един албум
  if (openAlbum) {
    return (
      <div>
        <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"><ArrowLeft size={15} /> Всички албуми</button>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div><h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>{openAlbum.title}</h2>
            <div className="text-slate-500 text-[12.5px] mt-0.5">{openPhotos.length} снимки{openAlbum.event_date ? ` · ${fmtDate(openAlbum.event_date)}` : ''}</div></div>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90 cursor-pointer" style={{ backgroundColor: ACCENT }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Качи снимки
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) uploadPhotos(openAlbum.id, e.target.files); e.currentTarget.value = '' }} />
          </label>
        </div>
        {openPhotos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
            <Images size={30} className="text-slate-200 mx-auto mb-2.5" />
            <div className="text-slate-700 font-semibold text-[15px] mb-1">Празен албум</div>
            <p className="text-sm text-slate-500">Качи първите снимки.</p>
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
            {openPhotos.map((p) => {
              const isCover = openAlbum.cover_url === p.photo_url
              return (
                <div key={p.id} className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-square">
                  <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                  {isCover && <span className="absolute top-2 left-2 text-[10px] font-semibold bg-amber-400 text-white px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Star size={10} /> корица</span>}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {!isCover && <button onClick={() => setCover(openAlbum.id, p.photo_url)} className="px-2.5 py-1.5 rounded-lg bg-white/90 text-[11px] font-medium text-slate-700 hover:bg-white inline-flex items-center gap-1"><Star size={12} /> Корица</button>}
                    <button onClick={() => deletePhoto(p)} className="w-8 h-8 rounded-lg bg-white/90 text-rose-600 hover:bg-white flex items-center justify-center"><Trash2 size={14} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <Toast notice={notice} />
      </div>
    )
  }

  // Списък с албуми
  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div><h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Галерия</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5">{albums.length} албума · {photos.length} снимки</div></div>
        <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90" style={{ backgroundColor: ACCENT }}><Plus size={15} /> Нов албум</button>
      </div>

      {albums.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <Images size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма албуми</div>
          <p className="text-sm text-slate-500 mb-4">Създай първия албум.</p>
          <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Нов албум</button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
          {albums.map((a) => {
            const count = photos.filter((p) => p.album_id === a.id).length
            return (
              <div key={a.id} className="group rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                <div className="h-[120px] bg-gradient-to-br from-slate-200 to-slate-100 relative cursor-pointer flex items-center justify-center" onClick={() => setOpenId(a.id)}>
                  {a.cover_url ? <img src={a.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[13px] font-bold text-slate-300 tracking-widest">ЦСОП</span>}
                  <span className="absolute bottom-2 right-2 text-[11px] bg-[#0f2240]/75 text-white px-2 py-0.5 rounded-full">{count} снимки</span>
                </div>
                <div className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 cursor-pointer" onClick={() => setOpenId(a.id)}>
                    <b className="text-[13.5px] font-medium text-slate-800 block truncate">{a.title}</b>
                    <span className="text-[11.5px] text-slate-400">{a.event_date ? fmtDate(a.event_date) : 'без дата'}</span>
                  </div>
                  <button onClick={() => deleteAlbum(a)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Изтрий албума"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toast notice={notice} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Нов албум" width={420}
        footer={<>
          <button onClick={() => setDrawer(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Отказ</button>
          <button onClick={createAlbum} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Създай</button>
        </>}>
        <Field label="Заглавие"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Спортен празник 2026" className={INPUT} /></Field>
        <Field label="Дата на събитието (по избор)"><input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} className={INPUT} /></Field>
        <p className="text-[12px] text-slate-400">Снимките се качват след създаване, отвътре в албума.</p>
      </Drawer>
    </div>
  )
}

/* ═══════════════ НАЧАЛНА (HERO) ═══════════════ */
function HeroManager({ photos, albums, initialSelected }: { photos: Photo[]; albums: Album[]; initialSelected: string[] }) {
  const supabase = createClient(); const router = useRouter()
  const [selected, setSelected] = useState<string[]>(initialSelected || [])
  const [filterAlbum, setFilterAlbum] = useState<string>('all')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ msg: string; err?: boolean } | null>(null)
  const flash = (msg: string, err = false) => { setNotice({ msg, err }); setTimeout(() => setNotice((p) => (p?.msg === msg ? null : p)), 3500) }

  const shownPhotos = filterAlbum === 'all' ? photos : photos.filter((p) => p.album_id === filterAlbum)
  const toggle = (url: string) => setSelected((prev) => prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url])
  const albumTitle = (id: string) => albums.find((a) => a.id === id)?.title || 'албум'

  async function save() {
    try {
      setBusy(true)
      const { error } = await supabase.from('site_settings').update({ value: selected, updated_at: new Date().toISOString() }).eq('key', 'hero_photos')
      if (error) throw error
      flash('Началната въртележка е обновена.'); router.refresh()
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Грешка при запис.', true) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div><h2 className="text-[18px] font-semibold tracking-tight" style={{ color: ACCENT }}>Начална страница</h2>
          <div className="text-slate-500 text-[12.5px] mt-0.5">Избери кои снимки от галерията да се въртят в началото на сайта</div></div>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: ACCENT }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази ({selected.length})</button>
      </div>

      {selected.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-5">
          <div className="text-[12px] font-semibold text-slate-500 mb-2.5">Избрани за въртележката ({selected.length})</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selected.map((url) => (
              <div key={url} className="relative shrink-0">
                <img src={url} alt="" className="w-24 h-16 object-cover rounded-lg border border-slate-200" />
                <button onClick={() => toggle(url)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow"><X size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-14 text-center">
          <Images size={30} className="text-slate-200 mx-auto mb-2.5" />
          <div className="text-slate-700 font-semibold text-[15px] mb-1">Няма снимки в галерията</div>
          <p className="text-sm text-slate-500">Първо качи снимки в раздел „Галерия", после ги избери тук.</p>
        </div>
      ) : (<>
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button onClick={() => setFilterAlbum('all')} className={`text-[12.5px] px-3 py-1.5 rounded-lg border ${filterAlbum === 'all' ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} style={filterAlbum === 'all' ? { backgroundColor: ACCENT } : {}}>Всички</button>
          {albums.map((a) => {
            const cnt = photos.filter((p) => p.album_id === a.id).length; if (!cnt) return null
            return <button key={a.id} onClick={() => setFilterAlbum(a.id)} className={`text-[12.5px] px-3 py-1.5 rounded-lg border ${filterAlbum === a.id ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`} style={filterAlbum === a.id ? { backgroundColor: ACCENT } : {}}>{a.title} ({cnt})</button>
          })}
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}>
          {shownPhotos.map((p) => {
            const on = selected.includes(p.photo_url)
            return (
              <button key={p.id} onClick={() => toggle(p.photo_url)} className={`relative rounded-xl overflow-hidden border-2 aspect-square transition-all ${on ? '' : 'border-transparent hover:border-slate-300'}`} style={on ? { borderColor: ACCENT } : {}}>
                <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                {on && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white shadow" style={{ backgroundColor: ACCENT }}><Check size={14} /></span>}
                <span className="absolute bottom-0 inset-x-0 bg-black/45 text-white text-[10px] px-1.5 py-0.5 truncate text-left">{albumTitle(p.album_id)}</span>
              </button>
            )
          })}
        </div>
      </>)}

      <Toast notice={notice} />
    </div>
  )
}
