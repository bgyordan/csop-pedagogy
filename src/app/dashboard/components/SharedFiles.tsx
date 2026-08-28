'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Share2, Download, File, FileText, FileSpreadsheet, FileImage } from 'lucide-react'

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
  if (m.includes('pdf') || n.endsWith('.pdf')) return <FileText size={18} style={{ color: '#dc2626' }} />
  if (m.includes('word') || n.endsWith('.doc') || n.endsWith('.docx')) return <FileText size={18} style={{ color: '#2563eb' }} />
  if (m.includes('sheet') || m.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return <FileSpreadsheet size={18} style={{ color: '#16a34a' }} />
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return <FileImage size={18} style={{ color: '#9333ea' }} />
  return <File size={18} style={{ color: '#64748b' }} />
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
        .limit(6)
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
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
        <Share2 size={18} className="text-slate-400" />
        <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Споделено от колеги</h2>
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Зареждане…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">Няма споделени файлове</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
              {icon(r.name, r.mime_type)}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-700 truncate">{r.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {r.owner ? `${r.owner.first_name} ${r.owner.last_name}` : '—'} · {formatDate(r.created_at)}
                </div>
              </div>
              <button onClick={() => download(r)} title="Изтегли" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0">
                <Download size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
