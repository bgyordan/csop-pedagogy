'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FolderOpen, Upload, FileText, Download, Trash2, Loader2, Plus, X } from 'lucide-react'

const DOC_TYPES = [
  { value: 'annual_report', label: 'Годишен доклад' },
  { value: 'work_plan', label: 'План за работа' },
  { value: 'opinion', label: 'Становище' },
  { value: 'schedule', label: 'График' },
  { value: 'other', label: 'Друго' },
]
const TYPE_LABELS: Record<string, string> = Object.fromEntries(DOC_TYPES.map(t => [t.value, t.label]))

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function CoordinatingDocs({ academicYearId }: { academicYearId: string }) {
  const supabase = createClient()

  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('other')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { if (academicYearId) load() }, [academicYearId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('coordinating_team_documents')
      .select('*')
      .eq('academic_year_id', academicYearId)
      .order('created_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }

  async function handleUpload(file: File) {
    if (!title.trim()) { alert('Въведете заглавие'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Максимум 10MB'); return }

    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const filePath = `coordinating/${Date.now()}_${safeName}`

    const { error: upErr } = await supabase.storage.from('documents').upload(filePath, file)
    if (upErr) { alert(`Грешка при качване: ${upErr.message}`); setUploading(false); return }

    const { data: profile } = await supabase.from('staff_profiles')
      .select('id').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single()

    const { error } = await supabase.from('coordinating_team_documents').insert({
      title: title.trim(),
      doc_type: docType,
      file_url: filePath,
      file_name: file.name,
      file_size: file.size,
      academic_year_id: academicYearId,
      uploaded_by: profile?.id || null,
    })

    if (error) { alert(`Грешка при запис: ${error.message}`); setUploading(false); return }

    setTitle(''); setDocType('other'); setShowForm(false)
    setUploading(false)
    await load()
  }

  async function handleDownload(fileUrl: string) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(fileUrl, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(doc: any) {
    if (!confirm(`Изтриване на "${doc.title}"?`)) return
    setBusy(doc.id)
    await supabase.storage.from('documents').remove([doc.file_url])
    await supabase.from('coordinating_team_documents').delete().eq('id', doc.id)
    setBusy(null)
    await load()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-amber-500" />
          <h2 className="font-medium text-slate-700 text-sm">Документи ({docs.length})</h2>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
            <Plus size={12} /> Качи
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 p-3 bg-amber-50 rounded-lg space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input className="input text-sm flex-1" placeholder="Заглавие *"
              value={title} onChange={e => setTitle(e.target.value)} />
            <select className="input text-sm sm:w-44" value={docType} onChange={e => setDocType(e.target.value)}>
              {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <label className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer ${uploading ? 'opacity-60' : ''}`}
              style={{ backgroundColor: '#0f2240' }}>
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? 'Качване...' : 'Избери файл (макс. 10MB)'}
              <input type="file" className="hidden" disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            </label>
            <button onClick={() => { setShowForm(false); setTitle('') }}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 hover:bg-slate-100">
              Отказ
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Зареждане...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate-400">Няма качени документи</p>
      ) : (
        <div className="space-y-1">
          {docs.map((doc, idx) => (
            <div key={doc.id} className={`flex items-center gap-3 p-2.5 rounded-lg group ${idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
              <FileText size={15} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-800 truncate">{doc.title}</div>
                <div className="text-xs text-slate-400">
                  {TYPE_LABELS[doc.doc_type] || 'Друго'}
                  <span className="mx-1.5">·</span>{doc.file_name}
                  {doc.file_size && <><span className="mx-1.5">·</span>{formatSize(doc.file_size)}</>}
                </div>
              </div>
              <button onClick={() => handleDownload(doc.file_url)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-white transition-colors flex-shrink-0">
                <Download size={14} />
              </button>
              <button onClick={() => handleDelete(doc)} disabled={busy === doc.id}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                {busy === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
