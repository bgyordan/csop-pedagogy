'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FileText, Upload, Loader2, Trash2, Download, Globe, EyeOff, Plus, X, Check } from 'lucide-react'

interface Doc {
  id: string
  name: string
  file_url: string
  academic_year: string | null
  section: string
  category: string | null
  on_site: boolean
  sort_order: number
}

const SECTIONS: { id: string; label: string }[] = [
  { id: 'internal', label: 'Нормативни документи' },
  { id: 'budget', label: 'Бюджет и финанси' },
  { id: 'admission', label: 'Прием' },
  { id: 'zdoi', label: 'Достъп до информация (ЗДОИ)' },
  { id: 'privacy', label: 'Лични данни (ЗЗЛД)' },
  { id: 'signali', label: 'Сигнали (ЗЗЛПСПОИН)' },
]

const RUBRICS: { key: string; title: string; color: string }[] = [
  { key: 'strategy', title: 'Стратегия и планове', color: '#7c3aed' },
  { key: 'rules', title: 'Правилници и вътрешни правила', color: '#0d9488' },
  { key: 'programs', title: 'Програми', color: '#2563eb' },
  { key: 'ethics', title: 'Етика и приобщаване', color: '#db2777' },
  { key: 'safety', title: 'Безопасност', color: '#ea580c' },
  { key: 'data', title: 'Защита на данните', color: '#475569' },
  { key: 'other', title: 'Общи', color: '#64748b' },
]

function suggestName(filename: string): string {
  const clean = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Нов документ'
}

export default function SiteDocsClient({ docs = [], defaultYear }: { docs: Doc[]; defaultYear: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [list, setList] = useState<Doc[]>(docs)
  const [tab, setTab] = useState('internal')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('rules')
  const [onSite, setOnSite] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ msg: string; isError?: boolean } | null>(null)

  const isInternal = tab === 'internal'
  const sectionDocs = list.filter((d) => d.section === tab)

  const flashNotice = (msg: string, isError = false) => {
    setNotice({ msg, isError })
    setTimeout(() => setNotice((prev) => (prev?.msg === msg ? null : prev)), 3500)
  }

  async function upload() {
    if (!name.trim() || !file) {
      flashNotice('Посочете наименование и изберете PDF файл.', true)
      return
    }
    try {
      setBusy(true)
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const path = `${tab}/${Date.now()}-${cleanName}`

      const { error: upErr } = await supabase.storage.from('public-docs').upload(path, file)
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('public-docs').getPublicUrl(path)
      const sort = list.filter((d) => d.section === tab).reduce((m, d) => Math.max(m, d.sort_order || 0), 0) + 1

      const { data, error: dbErr } = await supabase
        .from('site_documents')
        .insert({
          name: name.trim(),
          file_url: pub.publicUrl,
          academic_year: defaultYear || null,
          section: tab,
          category: isInternal ? category : null,
          on_site: onSite,
          sort_order: sort,
        })
        .select('*')
        .single()

      if (dbErr || !data) throw dbErr || new Error('Грешка при запис')

      setList((prev) => [...prev, data as Doc])
      setName('')
      setFile(null)
      setCategory('rules')
      setOpen(false)
      flashNotice('Документът е качен успешно!')
      router.refresh()
    } catch (err: unknown) {
      flashNotice(err instanceof Error ? err.message : 'Възникна грешка при качване.', true)
    } finally {
      setBusy(false)
    }
  }

  async function toggleSite(d: Doc) {
    const next = !d.on_site
    setList((prev) => prev.map((x) => (x.id === d.id ? { ...x, on_site: next } : x)))
    await supabase.from('site_documents').update({ on_site: next }).eq('id', d.id)
    router.refresh()
  }

  async function changeCategory(d: Doc, cat: string) {
    setList((prev) => prev.map((x) => (x.id === d.id ? { ...x, category: cat } : x)))
    await supabase.from('site_documents').update({ category: cat }).eq('id', d.id)
    router.refresh()
  }

  async function remove(d: Doc) {
    try {
      const storagePath = d.file_url.split('/public-docs/')[1]?.split('?')[0]
      if (storagePath) {
        await supabase.storage.from('public-docs').remove([decodeURIComponent(storagePath)])
      }
      await supabase.from('site_documents').delete().eq('id', d.id)
      setList((prev) => prev.filter((x) => x.id !== d.id))
      setDeletingId(null)
      flashNotice(`„${d.name}“ беше изтрит.`)
      router.refresh()
    } catch {
      flashNotice('Грешка при изтриване на документа.', true)
    }
  }

  function DocRow({ d, color }: { d: Doc; color: string }) {
    const isConfirming = deletingId === d.id

    return (
      <div
        className="group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all"
        style={{ borderLeft: `3.5px solid ${color}` }}
      >
        <a
          href={d.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-0 text-sm font-medium text-slate-800 hover:text-[#0f2240] truncate transition-colors"
          title={d.name}
        >
          {d.name}
        </a>

        <div className="flex items-center gap-1.5 shrink-0">
          {isInternal && (
            <select
              value={d.category || 'other'}
              onChange={(e) => changeCategory(d, e.target.value)}
              className="text-xs rounded-lg border border-slate-200 px-2 py-1 bg-slate-50 hover:bg-white text-slate-600 cursor-pointer focus:outline-none"
            >
              {RUBRICS.map((c) => (
                <option key={c.key} value={c.key}>{c.title}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => toggleSite(d)}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
              d.on_site
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {d.on_site ? <><Globe size={13} /> На сайта</> : <><EyeOff size={13} /> Скрит</>}
          </button>

          <a
            href={d.file_url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="p-1.5 text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 rounded-lg transition-colors"
            title="Свали"
          >
            <Download size={15} />
          </a>

          {isConfirming ? (
            <div className="flex items-center gap-1 bg-rose-50 p-0.5 rounded-lg border border-rose-200">
              <button
                onClick={() => remove(d)}
                className="px-2 py-0.5 text-xs font-bold text-rose-700 hover:bg-rose-100 rounded transition-colors"
                title="Потвърди изтриването"
              >
                Изтрий
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                title="Отказ"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeletingId(d.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Изтрий документа"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {notice && (
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-medium border animate-in fade-in duration-200 ${
            notice.isError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{notice.msg}</span>
          <button onClick={() => setNotice(null)} className="p-1 opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl text-white shadow-sm" style={{ backgroundColor: '#0f2240' }}>
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Сайт — Документи</h1>
            <p className="text-xs text-slate-500">Управление на публичните файлове по раздели</p>
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:brightness-110 active:scale-95 transition-all"
          style={{ backgroundColor: '#0f2240' }}
        >
          <Plus size={15} className={`transition-transform duration-200 ${open ? 'rotate-45' : ''}`} />
          <span>{open ? 'Затвори' : 'Качи документ'}</span>
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto p-1 bg-slate-100/90 rounded-xl border border-slate-200/70">
        {SECTIONS.map((s) => {
          const cnt = list.filter((d) => d.section === s.id).length
          const active = tab === s.id
          return (
            <button
              key={s.id}
              onClick={() => { setTab(s.id); setOpen(false); setDeletingId(null) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                active ? 'bg-white text-[#0f2240] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {s.label}
              {cnt > 0 && <span className="ml-1.5 text-[11px] font-normal text-slate-400">({cnt})</span>}
            </button>
          )
        })}
      </div>

      {open && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3.5 animate-in fade-in duration-200">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              PDF Документ *
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                setFile(f)
                if (f && !name.trim()) setName(suggestName(f.name))
              }}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
            />
          </div>

          <div className={`grid grid-cols-1 ${isInternal ? 'sm:grid-cols-2' : ''} gap-3`}>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Име на документа
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Заглавие..."
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-[#0f2240]"
              />
            </div>
            {isInternal && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Рубрика
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-[#0f2240] cursor-pointer"
                >
                  {RUBRICS.map((c) => (
                    <option key={c.key} value={c.key}>{c.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onSite}
                onChange={(e) => setOnSite(e.target.checked)}
                className="rounded border-slate-300 text-[#0f2240] focus:ring-0"
              />
              <span className="flex items-center gap-1 font-medium">
                <Globe size={13} className="text-emerald-600" />
                Показвай в публичния сайт
              </span>
            </label>

            <button
              onClick={upload}
              disabled={busy || !name.trim() || !file}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all"
              style={{ backgroundColor: '#0f2240' }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              <span>{busy ? 'Качване...' : 'Запази'}</span>
            </button>
          </div>
        </div>
      )}

      {sectionDocs.length === 0 ? (
        <div className="text-center py-12 text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl bg-white">
          Няма качени документи в този раздел.
        </div>
      ) : isInternal ? (
        <div className="space-y-4">
          {RUBRICS.map((r) => {
            const items = sectionDocs.filter((d) => (d.category || 'other') === r.key)
            if (items.length === 0) return null

            return (
              <div key={r.key} className="space-y-1.5">
                <div className="flex items-center gap-2 px-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{r.title}</span>
                  <span className="text-[10px] text-slate-400">({items.length})</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((d) => (
                    <DocRow key={d.id} d={d} color={r.color} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {sectionDocs.map((d) => (
            <DocRow key={d.id} d={d} color="#0f2240" />
          ))}
        </div>
      )}
    </div>
  )
}
