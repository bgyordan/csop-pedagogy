'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, Upload, Download, Trash2, X, Loader2, FileText } from 'lucide-react'

interface SFile { id: string; name: string; path: string; size: number | null; created_at: string }

function fmtSize(b: number | null) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

export default function SchoolFilesButton({ schoolId, schoolName, canManage }: {
  schoolId: string; schoolName: string; canManage: boolean
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<SFile[]>([])
  const [loading, setLoading] = useState(false)
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
  useEffect(() => { if (open) load() }, [open])

  async function upload(fileList: FileList) {
    setBusy(true)
    for (const file of Array.from(fileList)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
      const path = `${schoolId}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage.from('school-files').upload(path, file)
      if (upErr) { alert('Грешка при качване: ' + file.name); continue }
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('staff_profiles').select('id').eq('user_id', user?.id!).single()
      await supabase.from('school_files').insert({
        school_id: schoolId, name: file.name, path, size: file.size, mime_type: file.type, uploaded_by: prof?.id,
      })
    }
    await load()
    setBusy(false)
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
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-[#0f2240] hover:bg-slate-100 transition-colors" title="Файлове (УУП и др.)">
        <Paperclip size={13} /> Файлове
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-800 truncate">Файлове · {schoolName}</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {canManage && (
              <div onClick={() => inputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:border-blue-400 hover:bg-slate-50 text-sm text-slate-500">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {busy ? 'Качване…' : 'Качи файл(ове)'}
                <input ref={inputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = '' }} />
              </div>
            )}

            {loading ? (
              <div className="py-6 text-center"><Loader2 size={18} className="animate-spin inline text-slate-400" /></div>
            ) : files.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">Няма качени файлове.</div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 group">
                    <FileText size={15} className="text-blue-500 shrink-0" />
                    <button onClick={() => download(f)} className="min-w-0 flex-1 text-left">
                      <div className="text-sm text-slate-800 truncate hover:underline">{f.name}</div>
                      <div className="text-[10px] text-slate-400">{fmtSize(f.size)}</div>
                    </button>
                    <button onClick={() => download(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240]" title="Изтегли"><Download size={14} /></button>
                    {canManage && <button onClick={() => del(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100" title="Изтрий"><Trash2 size={13} /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
