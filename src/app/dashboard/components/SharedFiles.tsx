'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { listSharedStaffDocs } from '@/app/my-files/staff-drive-actions'
import { Share2, Download, ArrowRight, File, FileText, FileSpreadsheet, FileImage } from 'lucide-react'

type Row = {
  id: string
  name: string
  path: string
  mime_type: string | null
  created_at: string
  owner: { first_name: string; last_name: string } | null
}

function icon(name: string, mime: string | null) {
  const m = (mime || '').toLowerCase(); const n = name.toLowerCase()
  if (m.includes('pdf') || n.endsWith('.pdf')) return <FileText size={16} style={{ color: '#dc2626' }} />
  if (m.includes('word') || m.includes('document') || n.endsWith('.doc') || n.endsWith('.docx')) return <FileText size={16} style={{ color: '#2563eb' }} />
  if (m.includes('sheet') || m.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return <FileSpreadsheet size={16} style={{ color: '#16a34a' }} />
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return <FileImage size={16} style={{ color: '#9333ea' }} />
  return <File size={16} style={{ color: '#64748b' }} />
}

export default function SharedFiles({ bare = false }: { bare?: boolean } = {}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      // споделените лични документи на колегите — от Drive
      const r = await listSharedStaffDocs().catch(() => ({ files: [] as any[] }))
      setRows((r.files || []).slice(0, 5).map((f: any) => ({
        id: f.id, name: f.name, path: '', mime_type: f.mimeType, created_at: f.modifiedTime,
        owner: { first_name: f.owner, last_name: '' },
      })))
      setLoading(false)
    })()
  }, [])

  function download(r: Row) {
    window.location.href = `/api/staff-docs/download?fileId=${r.id}&as=office`
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
