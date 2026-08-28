'use client'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Share2, Download, File, FileText, FileSpreadsheet, FileImage, Search, Users } from 'lucide-react'

type Row = {
  id: string
  name: string
  path: string
  mime_type: string | null
  created_at: string
  staff_id: string
  owner: { first_name: string; last_name: string } | null
}
type Kind = 'pdf' | 'word' | 'excel' | 'image' | 'other'

function kindOf(name: string, mime: string | null): Kind {
  const m = (mime || '').toLowerCase(); const n = name.toLowerCase()
  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf'
  if (m.includes('word') || n.endsWith('.doc') || n.endsWith('.docx')) return 'word'
  if (m.includes('sheet') || m.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return 'excel'
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return 'image'
  return 'other'
}
function FileIcon({ k }: { k: Kind }) {
  const s = 20
  if (k === 'pdf') return <FileText size={s} style={{ color: '#dc2626' }} />
  if (k === 'word') return <FileText size={s} style={{ color: '#2563eb' }} />
  if (k === 'excel') return <FileSpreadsheet size={s} style={{ color: '#16a34a' }} />
  if (k === 'image') return <FileImage size={s} style={{ color: '#9333ea' }} />
  return <File size={s} style={{ color: '#64748b' }} />
}
const NAVY = '#0f2240'
const TYPE_CHIPS: { key: Kind | 'all'; label: string }[] = [
  { key: 'all', label: 'Всички' },
  { key: 'pdf', label: 'PDF' },
  { key: 'word', label: 'Word' },
  { key: 'excel', label: 'Excel' },
  { key: 'image', label: 'Изображения' },
  { key: 'other', label: 'Други' },
]

export default function SharedPageClient() {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<Kind | 'all'>('all')
  const [person, setPerson] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('staff_files')
        .select('id, name, path, mime_type, created_at, staff_id, owner:staff_profiles!staff_files_staff_id_fkey(first_name, last_name)')
        .eq('is_shared', true)
        .order('created_at', { ascending: false })
      setRows((data as any) || [])
      setLoading(false)
    })()
  }, [supabase])

  const people = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach(r => { if (r.owner) map.set(r.staff_id, `${r.owner.first_name} ${r.owner.last_name}`) })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'bg'))
  }, [rows])

  async function download(r: Row) {
    const { data } = await supabase.storage.from('staff-files').createSignedUrl(r.path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  let shown = rows
  if (typeFilter !== 'all') shown = shown.filter(r => kindOf(r.name, r.mime_type) === typeFilter)
  if (person !== 'all') shown = shown.filter(r => r.staff_id === person)
  if (search.trim()) shown = shown.filter(r => r.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}><Share2 size={22} /> Споделени файлове</h1>
        <p className="text-sm text-slate-500 mt-1">Файлове, които колегите са споделили с всички.</p>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Търсене…" className="w-full pl-9 pr-3 py-2 text-sm border rounded-full" />
        </div>
        <div className="relative">
          <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select value={person} onChange={e => setPerson(e.target.value)} className="pl-9 pr-8 py-2 text-sm border rounded-full bg-white appearance-none cursor-pointer" style={{ color: person === 'all' ? '#475569' : NAVY }}>
            <option value="all">Всички хора</option>
            {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {TYPE_CHIPS.map(c => (
          <button key={c.key} onClick={() => setTypeFilter(c.key)} className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors" style={{ backgroundColor: typeFilter === c.key ? NAVY : '#f1f5f9', color: typeFilter === c.key ? '#fff' : '#475569' }}>{c.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12 text-sm">Зареждане…</div>
      ) : shown.length === 0 ? (
        <div className="text-center text-slate-400 py-12 text-sm">{rows.length === 0 ? 'Няма споделени файлове.' : 'Няма файлове по този филтър.'}</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e2e8f0' }}>
          {shown.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-100" style={{ backgroundColor: i % 2 === 1 ? '#f8fafc' : '#fff' }}>
              <FileIcon k={kindOf(r.name, r.mime_type)} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-700 truncate">{r.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{r.owner ? `${r.owner.first_name} ${r.owner.last_name}` : '—'} · {formatDate(r.created_at)}</div>
              </div>
              <button onClick={() => download(r)} title="Изтегли" className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 shrink-0"><Download size={17} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
