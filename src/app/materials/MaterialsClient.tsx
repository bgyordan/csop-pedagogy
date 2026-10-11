'use client'

// Библиотеката: търсене, филтри по област и вид, карти с „Отвори / печат“ и „Изтегли“, качване на нов материал.

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Upload, Printer, Download, Trash2, X, Loader2, FileText, Settings2, ImageIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { smartMatch } from '@/lib/search'
import { AREAS, areaMeta } from '../students/[id]/development/lib'
import { KINDS, isImage, sourceValid } from './lib'
import type { Material, Source } from './lib'
import SeedLoader from './SeedLoader'

const MAX_MB = 30

export default function MaterialsClient({ initialArea = '', materials, sources, names, thumbs, meId, isManager, today }: {
  initialArea?: string; materials: Material[]; sources: Source[]; names: Record<string, string>; thumbs: Record<string, string>; meId: string; isManager: boolean; today: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [area, setArea] = useState(initialArea)
  const [kind, setKind] = useState('')
  const [upload, setUpload] = useState(false)
  const srcOf = useMemo(() => Object.fromEntries(sources.map(s => [s.id, s])), [sources])

  const shown = useMemo(() => materials.filter(m =>
    (!area || m.areas.includes(area)) && (!kind || m.kind === kind) &&
    (!q || smartMatch(`${m.title} ${m.description || ''}`, q))), [materials, area, kind, q])

  async function open(m: Material, download: boolean) {
    const { data } = await supabase.storage.from('materials').createSignedUrl(m.file_path, 120, download ? { download: m.file_name } : undefined)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else toast('Файлът не може да се отвори', 'error')
  }

  async function remove(m: Material) {
    if (!confirm(`Да се изтрие ли „${m.title}“ от библиотеката?`)) return
    await supabase.storage.from('materials').remove([m.file_path, ...(m.preview_path ? [m.preview_path] : [])])
    const { error } = await supabase.from('materials').delete().eq('id', m.id)
    if (error) { toast(error.message, 'error'); return }
    toast('Изтрито'); router.refresh()
  }

  const chip = (on: boolean) => `px-3 py-1.5 rounded-lg text-[13px] transition-all ${on ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`

  return (
    <div className="space-y-4">
      {/* Търсене + качване */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] px-3 py-2 bg-white border border-slate-200 rounded-xl focus-within:border-[#0f2240]">
          <Search size={15} className="text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси материал — напр. „ножица“, „сезони“, „табло за избор“"
            className="flex-1 min-w-0 text-[14px] focus:outline-none" />
          {q && <button type="button" onClick={() => setQ('')} className="text-slate-400 hover:text-slate-700"><X size={14} /></button>}
        </div>
        <button type="button" onClick={() => setUpload(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
          <Upload size={15} /> Качи материал
        </button>
        {isManager && (
          <Link href="/materials/sources" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
            <Settings2 size={14} /> Източници
          </Link>
        )}
      </div>

      {isManager && <SeedLoader materials={materials} sources={sources} meId={meId} />}

      {/* Филтри */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button type="button" onClick={() => setArea('')} className={chip(!area)}>Всички области</button>
        {AREAS.map(a => <button key={a.key} type="button" onClick={() => setArea(a.key)} className={chip(area === a.key)}>{a.short}</button>)}
      </div>
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button type="button" onClick={() => setKind('')} className={chip(!kind)}>Всички видове</button>
        {Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} className={chip(kind === k)}>{l}</button>)}
      </div>

      {/* Материалите */}
      {shown.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-500">{materials.length ? 'Няма материали по този избор.' : 'Библиотеката още е празна.'}</p>
          {!materials.length && <p className="text-[12.5px] text-slate-400 mt-1">Качете първия си работен лист или табло — ще го виждат всички колеги.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map(m => {
            const src = srcOf[m.source_id || '']
            const expired = !sourceValid(src, today)
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all">
                <button type="button" onClick={() => open(m, false)} className={`${m.preview_path ? 'h-44' : 'h-36'} bg-slate-50 flex items-center justify-center border-b border-slate-100 overflow-hidden`}>
                  {thumbs[m.file_path]
                    ? <img src={thumbs[m.file_path]} alt="" loading="lazy" className={m.preview_path ? 'w-full h-full object-cover object-top' : 'w-full h-full object-contain'} />
                    : <div className="flex flex-col items-center gap-1 text-slate-300">{isImage(m) ? <ImageIcon size={34} /> : <FileText size={34} />}<span className="text-[11px] uppercase tracking-widest">{(m.file_name.split('.').pop() || '').slice(0, 5)}</span></div>}
                </button>
                <div className="px-4 py-3 flex-1 flex flex-col">
                  <div className="text-[14px] text-slate-800 leading-snug">{m.title}</div>
                  {m.description && <p className="text-[12.5px] text-slate-500 mt-0.5 line-clamp-2">{m.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{KINDS[m.kind] || m.kind}{m.pages ? ` · ${m.pages} стр.` : ''}</span>
                    {m.areas.map(a => <span key={a} className="text-[11px] px-2 py-0.5 rounded-full border" style={{ color: areaMeta(a).color, borderColor: areaMeta(a).color + '40' }}>{areaMeta(a).short}</span>)}
                    {isManager && expired && <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">изтекъл източник — скрит за колегите</span>}
                  </div>
                  <div className="text-[11.5px] text-slate-400 mt-auto pt-2">{m.seed_key ? 'Начален комплект на ЕИС' : <>{(m.uploaded_by && names[m.uploaded_by]) || '—'} · {new Date(m.created_at).toLocaleDateString('bg-BG')}</>}</div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button type="button" onClick={() => open(m, false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]"><Printer size={13} /> Отвори / печат</button>
                    <button type="button" onClick={() => open(m, true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]"><Download size={13} /> Изтегли</button>
                    {(m.uploaded_by === meId || isManager) && (
                      <button type="button" onClick={() => remove(m)} title="Изтрий" className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {upload && <UploadModal sources={sources.filter(s => sourceValid(s, today))} meId={meId} onClose={() => setUpload(false)} onDone={() => { setUpload(false); router.refresh() }} />}
    </div>
  )
}

function UploadModal({ sources, meId, onClose, onDone }: { sources: Source[]; meId: string; onClose: () => void; onDone: () => void }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('worksheet')
  const [areas, setAreas] = useState<string[]>([])
  const [sourceId, setSourceId] = useState(sources[0]?.id || '')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function save() {
    if (!file) { toast('Изберете файл', 'error'); return }
    if (!title.trim()) { toast('Напишете име на материала', 'error'); return }
    if (file.size > MAX_MB * 1024 * 1024) { toast(`Файлът е над ${MAX_MB} MB`, 'error'); return }
    setBusy(true)
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('materials').upload(path, file, { contentType: file.type || undefined })
    if (up.error) { setBusy(false); toast('Грешка при качване: ' + up.error.message, 'error'); return }
    const { error } = await supabase.from('materials').insert({
      title: title.trim(), description: description.trim() || null, kind, areas, source_id: sourceId || null,
      file_path: path, file_name: file.name, mime_type: file.type || null, size: file.size, uploaded_by: meId,
    })
    setBusy(false)
    if (error) { await supabase.storage.from('materials').remove([path]); toast('Грешка: ' + error.message, 'error'); return }
    toast('Материалът е качен — виждат го всички колеги')
    onDone()
  }

  const pill = (on: boolean) => `px-3 py-1.5 rounded-full text-[13px] border transition-colors ${on ? 'border-[#0f2240] text-[#0f2240] bg-slate-50 ring-1 ring-[#0f2240]/20' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-2xl mx-auto my-0 md:my-10 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-slate-200">
          <Upload size={17} className="text-slate-500" />
          <h2 className="text-base font-medium text-[#0f2240] flex-1">Качи материал</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={e => {
              const f = e.target.files?.[0] || null; setFile(f)
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
            }} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full px-4 py-4 rounded-xl border-2 border-dashed border-slate-300 text-[14px] text-slate-600 hover:border-[#0f2240]">
              {file ? <>📎 {file.name}</> : 'Изберете файл — PDF, картинка, Word, Boardmaker…'}
            </button>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1.5">Име</div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="напр. Рязане по линия — прави и вълнисти"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:border-[#0f2240]" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1.5">Кратко описание <span className="text-[12px] font-normal text-slate-400">по желание</span></div>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="за кого е подходящ, как се ползва"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[14px] focus:outline-none focus:border-[#0f2240] resize-y" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1.5">Вид</div>
            <div className="flex flex-wrap gap-1.5">{Object.entries(KINDS).map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} className={pill(kind === k)}>{l}</button>)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1.5">За какво умение <span className="text-[12px] font-normal text-slate-400">може няколко</span></div>
            <div className="flex flex-wrap gap-1.5">{AREAS.map(a => {
              const on = areas.includes(a.key)
              return <button key={a.key} type="button" onClick={() => setAreas(on ? areas.filter(x => x !== a.key) : [...areas, a.key])} className={pill(on)}>{a.label}</button>
            })}</div>
          </div>
          {sources.length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-800 mb-1.5">Откъде е</div>
              <div className="flex flex-wrap gap-1.5">{sources.map(s => <button key={s.id} type="button" onClick={() => setSourceId(s.id)} className={pill(sourceId === s.id)}>{s.name}</button>)}</div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">Отказ</button>
          <button type="button" onClick={save} disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Качи
          </button>
        </div>
      </div>
    </div>
  )
}
