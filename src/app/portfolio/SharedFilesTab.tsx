'use client'

// „Споделени файлове“ — файловете, които колегите са споделили от „Моите документи“ (Drive).
// Преди беше отделна страница /shared; сега е таб в Портфолио.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { listSharedStaffDocs } from '@/app/my-files/staff-drive-actions'
import { Download, Eye, File, FileText, FileSpreadsheet, FileImage, Search, Share2, X, Loader2 } from 'lucide-react'
import { DocViewer } from '@/components/registry/DocViewer'
import { Avatar } from './PostCard'

type Kind = 'pdf' | 'word' | 'excel' | 'image' | 'other'
export type FileRow = { id: string; name: string; mime: string | null; at: string; staffId: string; owner: string }
type Row = FileRow

/** Споделените файлове от Drive (зарежда ги родителят веднъж) */
export async function loadSharedFiles(): Promise<{ rows: FileRow[]; err: string }> {
  try {
    const r: any = await listSharedStaffDocs()
    return { err: r?.error || '', rows: (r?.files || []).map((f: any) => ({ id: f.id, name: f.name, mime: f.mimeType, at: f.modifiedTime, staffId: f.staffId, owner: f.owner })) }
  } catch { return { rows: [], err: 'Няма връзка с Drive' } }
}

function kindOf(name: string, mime: string | null): Kind {
  const m = (mime || '').toLowerCase(); const n = name.toLowerCase()
  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf'
  if (m.includes('word') || m.includes('document') || /\.docx?$/.test(n)) return 'word'
  if (m.includes('sheet') || m.includes('excel') || /\.(xlsx?|csv)$/.test(n)) return 'excel'
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return 'image'
  return 'other'
}
const ICON: Record<Kind, { I: typeof File; cls: string; bg: string }> = {
  pdf: { I: FileText, cls: 'text-red-600', bg: 'bg-red-50' },
  word: { I: FileText, cls: 'text-blue-600', bg: 'bg-blue-50' },
  excel: { I: FileSpreadsheet, cls: 'text-green-600', bg: 'bg-green-50' },
  image: { I: FileImage, cls: 'text-purple-600', bg: 'bg-purple-50' },
  other: { I: File, cls: 'text-slate-500', bg: 'bg-slate-100' },
}
const CHIPS: { key: Kind | 'all'; label: string }[] = [
  { key: 'all', label: 'Всички' }, { key: 'pdf', label: 'PDF' }, { key: 'word', label: 'Word' },
  { key: 'excel', label: 'Excel' }, { key: 'image', label: 'Изображения' }, { key: 'other', label: 'Други' },
]
const fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const isFresh = (iso: string) => !!iso && Date.now() - new Date(iso).getTime() < 2 * 864e5

export default function SharedFilesTab({ canShare, rows, err }: { canShare: boolean; rows: FileRow[] | null; err: string }) {
  const [type, setType] = useState<Kind | 'all'>('all')
  const [person, setPerson] = useState('')
  const [q, setQ] = useState('')
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null)


  const people = useMemo(() => {
    const m = new Map<string, string>(); (rows || []).forEach(r => m.set(r.staffId, r.owner))
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1], 'bg'))
  }, [rows])

  const needle = q.trim().toLowerCase()
  const shown = (rows || [])
    .filter(r => type === 'all' || kindOf(r.name, r.mime) === type)
    .filter(r => !person || r.staffId === person)
    .filter(r => !needle || (r.name + ' ' + r.owner).toLowerCase().includes(needle))

  const download = (id: string) => { window.location.href = `/api/staff-docs/download?fileId=${encodeURIComponent(id)}&as=office` }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {CHIPS.map(c => (
          <button key={c.key} type="button" onClick={() => setType(c.key)}
            className={`px-3.5 py-2 rounded-full text-[13px] border transition-colors ${type === c.key ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'}`}>{c.label}</button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {people.length > 1 && (
            <select value={person} onChange={e => setPerson(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700 focus:outline-none focus:border-[#0f2240]">
              <option value="">Всички колеги</option>
              {people.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси…"
              className="pl-8 pr-7 py-2 w-48 rounded-xl border border-slate-300 bg-white text-[13px] focus:outline-none focus:border-[#0f2240] focus:w-60 transition-all" />
            {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={13} /></button>}
          </div>
          {canShare && (
            <Link href="/my-files" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700 hover:border-[#0f2240]">
              <Share2 size={14} /> Сподели файл
            </Link>
          )}
        </div>
      </div>

      {rows === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Зареждане…</div>
      ) : shown.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-500">{err || (rows.length ? 'Нищо не отговаря на филтъра.' : 'Няма споделени файлове.')}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {shown.map(r => {
            const k = ICON[kindOf(r.name, r.mime)]
            return (
              <div key={r.id} onClick={() => setViewing({ id: r.id, name: r.name })} title="Преглед"
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${isFresh(r.at) ? 'bg-emerald-50/40' : ''}`}>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${k.bg}`}><k.I size={19} className={k.cls} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] text-slate-900 truncate">{r.name}</div>
                  <div className="flex items-center gap-1.5 text-[12px] text-slate-500 mt-0.5">
                    <Avatar name={r.owner || '?'} size={18} /> <span className="truncate">{r.owner}</span> · {fmt(r.at)}
                    {isFresh(r.at) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">ново</span>}
                  </div>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); setViewing({ id: r.id, name: r.name }) }} title="Преглед" className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 shrink-0"><Eye size={16} /></button>
                <button type="button" onClick={e => { e.stopPropagation(); download(r.id) }} title="Изтегли" className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 shrink-0"><Download size={16} /></button>
              </div>
            )
          })}
        </div>
      )}
      <DocViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

/** Лента с последните споделени файлове — горе на стената, за да не остават незабелязани */
export function SharedFilesStrip({ rows, onAll }: { rows: FileRow[]; onAll: () => void }) {
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(null)
  if (!rows.length) return null
  const fresh = rows.filter(r => isFresh(r.at)).length
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 px-1 mb-2">
        <Share2 size={14} className="text-[#0f2240]" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#0f2240]">Споделени файлове</span>
        {fresh > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{fresh} нови</span>}
        <button type="button" onClick={onAll} className="ml-auto text-xs text-slate-500 hover:text-[#0f2240]">Всички ({rows.length}) →</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {rows.slice(0, 4).map(r => {
          const k = ICON[kindOf(r.name, r.mime)]
          return (
            <button key={r.id} type="button" onClick={() => setViewing({ id: r.id, name: r.name })} title="Преглед"
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left border transition-colors hover:border-slate-400 ${isFresh(r.at) ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${k.bg}`}><k.I size={16} className={k.cls} /></span>
              <span className="min-w-0">
                <span className="block text-[13px] text-slate-900 truncate">{r.name}</span>
                <span className="block text-[11px] text-slate-500 truncate">{r.owner} · {fmt(r.at)}</span>
              </span>
            </button>
          )
        })}
      </div>
      <DocViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
