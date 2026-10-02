'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { listSharedStaffDocs } from '@/app/my-files/staff-drive-actions'
import { Share2, Download, ArrowRight, File, FileText, FileSpreadsheet, FileImage, ExternalLink } from 'lucide-react'

type Row = {
  id: string
  name: string
  path: string
  mime_type: string | null
  created_at: string
  url?: string
  owner: { first_name: string; last_name: string } | null
}

// „днес 10:24“ / „вчера“ / „3 окт.“
function when(iso: string) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5)
  if (days === 0) return `днес ${d.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}`
  if (days === 1) return 'вчера'
  return d.toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' })
}
const isFresh = (iso: string) => !!iso && Date.now() - new Date(iso).getTime() < 2 * 864e5

function icon(name: string, mime: string | null) {
  const m = (mime || '').toLowerCase(); const n = name.toLowerCase()
  if (m.includes('pdf') || n.endsWith('.pdf')) return <FileText size={16} style={{ color: '#dc2626' }} />
  if (m.includes('word') || m.includes('document') || n.endsWith('.doc') || n.endsWith('.docx')) return <FileText size={16} style={{ color: '#2563eb' }} />
  if (m.includes('sheet') || m.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return <FileSpreadsheet size={16} style={{ color: '#16a34a' }} />
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return <FileImage size={16} style={{ color: '#9333ea' }} />
  return <File size={16} style={{ color: '#64748b' }} />
}

export default function SharedFiles({ bare = false, limit = 5 }: { bare?: boolean; limit?: number } = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      // споделените лични документи на колегите — от Drive
      const r = await listSharedStaffDocs().catch(() => ({ files: [] as any[] }))
      setRows((r.files || []).slice(0, limit).map((f: any) => ({
        id: f.id, name: f.name, path: '', mime_type: f.mimeType, created_at: f.modifiedTime, url: f.url,
        owner: { first_name: f.owner, last_name: '' },
      })))
      setLoading(false)
    })()
  }, [])

  function download(r: Row) {
    window.location.href = `/api/staff-docs/download?fileId=${r.id}&as=office`
  }

  // Пълна карта (таблото на деловодството): по-голяма, с дата, „ново“ и отваряне в Drive
  if (!bare) {
    const fresh = rows.filter(r => isFresh(r.created_at)).length
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
          <Share2 size={16} className="text-[#0f2240]" />
          <h2 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex-1">Споделено от колеги</h2>
          {fresh > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{fresh} нови</span>}
          <Link href="/shared" className="text-xs text-slate-500 hover:text-[#0f2240] inline-flex items-center gap-1">Всички <ArrowRight size={13} /></Link>
        </div>
        <div className="p-2 flex-1">
          {loading ? (
            <p className="text-sm text-slate-400 px-3 py-6 text-center">Зареждане…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-400 px-3 py-6 text-center">Колегите още не са споделили файлове.</p>
          ) : rows.map(r => (
            <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-slate-50 ${isFresh(r.created_at) ? 'bg-emerald-50/40' : ''}`}>
              <span className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">{icon(r.name, r.mime_type)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-900 truncate flex items-center gap-1.5">
                  <span className="truncate">{r.name}</span>
                  {isFresh(r.created_at) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 flex-shrink-0">ново</span>}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {r.owner ? `${r.owner.first_name} ${r.owner.last_name}`.trim() : '—'} · {when(r.created_at)}
                </div>
              </div>
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" title="Отвори в Drive"
                  className="p-2 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-white transition-colors flex-shrink-0"><ExternalLink size={15} /></a>
              )}
              <button onClick={() => download(r)} title="Изтегли"
                className="p-2 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-white transition-colors flex-shrink-0"><Download size={15} /></button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={bare ? '' : 'bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm'}>
      <div className={`flex items-center justify-between ${bare ? 'mb-2' : 'mb-4 pb-3 border-b border-slate-100'}`}>
        <div className="flex items-center gap-2">
          <Share2 size={bare ? 14 : 18} className="text-slate-400" />
          <h2 className={bare ? 'text-xs font-medium text-slate-500' : 'font-bold text-slate-800 text-sm uppercase tracking-wider'}>Споделено от колеги</h2>
        </div>
        <Link href="/shared" className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:text-blue-800 flex items-center gap-1">
          Виж всички <ArrowRight size={12} />
        </Link>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Зареждане…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">Няма споделени файлове</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-3 py-2 group">
              {icon(r.name, r.mime_type)}
              <span className="text-sm font-medium text-slate-700 truncate flex-1">{r.name}</span>
              <span className="text-[11px] text-slate-400 shrink-0 hidden sm:block">{r.owner ? `${r.owner.first_name} ${r.owner.last_name}`.trim() : '—'}</span>
              <button onClick={() => download(r)} title="Изтегли" className="p-1 rounded hover:bg-slate-200 text-slate-400 shrink-0"><Download size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
