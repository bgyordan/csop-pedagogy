'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FileText, Upload, Loader2, Trash2, Download, Globe, EyeOff, Plus } from 'lucide-react'

interface Doc { id: string; name: string; file_url: string; academic_year: string | null; category: string | null; on_site: boolean; sort_order: number }

const CATEGORIES: { key: string; title: string; color: string }[] = [
  { key: 'strategy', title: 'Стратегическо планиране', color: '#7c3aed' },
  { key: 'annual', title: 'Годишно планиране', color: '#2563eb' },
  { key: 'rules', title: 'Правилници и вътрешни правила', color: '#0d9488' },
  { key: 'edu', title: 'Образователна и терапевтична дейност', color: '#db2777' },
  { key: 'safety', title: 'Безопасност и сигурност', color: '#ea580c' },
  { key: 'data', title: 'Защита на данните и информацията', color: '#475569' },
  { key: 'other', title: 'Други документи', color: '#64748b' },
]
const catOf = (k: string | null) => CATEGORIES.find(c => c.key === k) || CATEGORIES[6]

export default function SiteDocsClient({ docs, defaultYear }: { docs: Doc[]; defaultYear: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [list, setList] = useState<Doc[]>(docs)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [year, setYear] = useState(defaultYear)
  const [category, setCategory] = useState('rules')
  const [onSite, setOnSite] = useState(true)
  const [file, setFile] = useState<File | null>(null)

  async function upload() {
    if (!name.trim() || !file) { alert('Име и файл са задължителни'); return }
    setBusy(true)
    const ext = file.name.split('.').pop()
    const path = `internal/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: upErr } = await supabase.storage.from('public-docs').upload(path, file)
    if (upErr) { alert('Грешка при качване: ' + upErr.message); setBusy(false); return }
    const { data: pub } = supabase.storage.from('public-docs').getPublicUrl(path)
    const sort = (list.reduce((m, d) => Math.max(m, d.sort_order), 0)) + 1
    const { data, error } = await supabase.from('site_documents').insert({
      name: name.trim(), file_url: pub.publicUrl, academic_year: year.trim() || null,
      section: 'internal', category, on_site: onSite, sort_order: sort,
    }).select('*').single()
    setBusy(false)
    if (error || !data) { alert('Грешка при запис: ' + (error?.message || '')); return }
    setList(prev => [...prev, data as Doc])
    setName(''); setFile(null); setOpen(false)
    const fi = document.getElementById('sd-file') as HTMLInputElement; if (fi) fi.value = ''
    router.refresh()
  }

  async function toggleSite(d: Doc) {
    const next = !d.on_site
    setList(prev => prev.map(x => x.id === d.id ? { ...x, on_site: next } : x))
    await supabase.from('site_documents').update({ on_site: next }).eq('id', d.id)
    router.refresh()
  }
  async function changeCategory(d: Doc, cat: string) {
    setList(prev => prev.map(x => x.id === d.id ? { ...x, category: cat } : x))
    await supabase.from('site_documents').update({ category: cat }).eq('id', d.id)
    router.refresh()
  }
  async function remove(d: Doc) {
    if (!confirm(`Изтриване на „${d.name}"?`)) return
    const m = d.file_url.split('/public-docs/')[1]
    if (m) await supabase.storage.from('public-docs').remove([m])
    await supabase.from('site_documents').delete().eq('id', d.id)
    setList(prev => prev.filter(x => x.id !== d.id)); router.refresh()
  }

  const inputCls = "w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:border-slate-400"

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><FileText size={20} className="text-white" /></div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Нормативни документи</h1>
            <p className="text-slate-500 text-sm mt-0.5">Управление от деловодството · тогълът „За сайта" решава дали се показват публично</p>
          </div>
        </div>
        <button onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
          <Plus size={16} className={open ? 'rotate-45 transition-transform' : 'transition-transform'} /> {open ? 'Затвори' : 'Качи документ'}
        </button>
      </div>

      {open && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Име на документа</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="напр. Етичен кодекс 2025/2026" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Категория</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls + ' cursor-pointer'}>
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Учебна година</label>
              <input value={year} onChange={e => setYear(e.target.value)} placeholder="2025/2026" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Файл (PDF)</label>
              <input id="sd-file" type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={onSite} onChange={e => setOnSite(e.target.checked)} className="rounded border-slate-300" />
            <Globe size={15} className="text-slate-400" /> Показвай и на публичния сайт
          </label>
          <div className="flex justify-end">
            <button onClick={upload} disabled={busy || !name.trim() || !file}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Качи
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {CATEGORIES.map(cat => {
          const items = list.filter(d => (d.category || 'other') === cat.key)
          if (items.length === 0) return null
          return (
            <div key={cat.key}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{cat.title}</span>
                <span className="text-[10px] text-slate-400">({items.length})</span>
              </div>
              <div className="space-y-1.5">
                {items.map(d => (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 bg-white" style={{ borderLeft: `3px solid ${cat.color}` }}>
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 group">
                      <div className="text-sm font-medium text-slate-700 group-hover:text-[#0f2240] truncate">{d.name}</div>
                      {d.academic_year && <div className="text-[10px] text-slate-400">{d.academic_year}</div>}
                    </a>
                    <select value={d.category || 'other'} onChange={e => changeCategory(d, e.target.value)}
                      className="text-[11px] rounded-lg border border-slate-200 px-1.5 py-1 bg-white cursor-pointer hidden md:block" title="Категория">
                      {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.title}</option>)}
                    </select>
                    <button onClick={() => toggleSite(d)} title={d.on_site ? 'Показва се на сайта — изключи' : 'Само в деловодството — покажи на сайта'}
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border transition-colors ${d.on_site ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                      {d.on_site ? <><Globe size={12} /> За сайта</> : <><EyeOff size={12} /> Само ЕИС</>}
                    </button>
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-[#0f2240]" title="Отвори"><Download size={15} /></a>
                    <button onClick={() => remove(d)} className="p-1.5 text-slate-400 hover:text-rose-500" title="Изтрий"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        {list.length === 0 && <div className="text-center py-12 text-sm text-slate-400">Още няма качени документи.</div>}
      </div>
    </div>
  )
}
