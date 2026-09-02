'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Download, Trash2, Loader2, FileText } from 'lucide-react'

interface SFile { id: string; name: string; path: string; size: number | null; created_at: string }
function fmtSize(b: number | null) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export default function SchoolFilesPanel({ schoolId }: { schoolId: string }) {
  const supabase = createClient()
  const [files, setFiles] = useState<SFile[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('school_files')
      .select('id, name, path, size, created_at').eq('school_id', schoolId)
      .order('created_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [schoolId])

  async function upload(list: FileList) {
    setBusy(true)
    for (const file of Array.from(list)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
      const path = `${schoolId}/${Date.now()}_${safe}`
      const { error } = await supabase.storage.from('school-files').upload(path, file)
      if (error) { alert('Грешка при качване: ' + file.name); continue }
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('staff_profiles').select('id').eq('user_id', user?.id!).single()
      await supabase.from('school_files').insert({ school_id: schoolId, name: file.name, path, size: file.size, mime_type: file.type, uploaded_by: prof?.id })
    }
    await load(); setBusy(false)
  }
  async function download(f: SFile) {
    const { data, error } = await supabase.storage.from('school-files').download(f.path)
    if (error || !data) { alert('Грешка при изтегляне'); return }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a'); a.href = url; a.download = f.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }
  async function del(f: SFile) {
    if (!confirm(`Изтрий „${f.name}"?`)) return
    await supabase.storage.from('school-files').remove([f.path])
    await supabase.from('school_files').delete().eq('id', f.id)
    setFiles(prev => prev.filter(x => x.id !== f.id))
  }

  return (
    <div className="space-y-2">
      <div onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:border-blue-400 hover:bg-white text-xs text-slate-500">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {busy ? 'Качване…' : 'Качи файл(ове)'}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = '' }} />
      </div>
      {loading ? (
        <div className="py-3 text-center"><Loader2 size={14} className="animate-spin inline text-slate-400" /></div>
      ) : files.length === 0 ? (
        <div className="py-3 text-center text-[11px] text-slate-400">Няма качени файлове</div>
      ) : (
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-100 group">
              <FileText size={14} className="text-blue-500 shrink-0" />
              <button onClick={() => download(f)} className="min-w-0 flex-1 text-left">
                <div className="text-[12px] text-slate-800 truncate hover:underline">{f.name}</div>
                <div className="text-[10px] text-slate-400">{fmtSize(f.size)}</div>
              </button>
              <button onClick={() => download(f)} className="p-1 rounded text-slate-400 hover:text-[#0f2240]" title="Изтегли"><Download size={13} /></button>
              <button onClick={() => del(f)} className="p-1 rounded text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100" title="Изтрий"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
