'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
  if (m.includes('word') || n.endsWith('.doc') || n.endsWith('.docx')) return <FileText size={16} style={{ color: '#2563eb' }} />
  if (m.includes('sheet') || m.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return <FileSpreadsheet size={16} style={{ color: '#16a34a' }} />
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return <FileImage size={16} style={{ color: '#9333ea' }} />
  return <File size={16} style={{ color: '#64748b' }} />
}

export default function SharedFiles() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('staff_files')
        .select('id, name, path, mime_type, created_at, owner:staff_profiles!staff_files_staff_id_fkey(first_name, last_name)')
        .eq('is_shared', true)
        .order('created_at', { ascending: false })
        .limit(5)
      setRows((data as any) || [])
      setLoading(false)
    })()
  }, [supabase])

  async function download(r: Row) {
    const { data } = await supabase.storage.from('staff-files').createSignedUrl(r.path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Share2 size={18} className="text-slate-400" />
          <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Споделено от колеги</h2>
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
              <span className="text-[11px] text-slate-400 shrink-0 hidden sm:block">{r.owner ? `${r.owner.first_name} ${r.owner.last_name}` : '—'}</span>
              <button onClick={() => download(r)} title="Изтегли" className="p-1 rounded hover:bg-slate-200 text-slate-400 shrink-0"><Download size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
