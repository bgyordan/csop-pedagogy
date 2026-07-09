'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Upload, FileText, Loader2, Trash2, Download, Package } from 'lucide-react'

const OBJECT_LABELS: Record<string, string> = {
  construction: 'Строителство', supply: 'Доставка', service: 'Услуга',
}
const PROCEDURE_LABELS: Record<string, string> = {
  direct: 'Директно възлагане', offers: 'Събиране на оферти с обява', negotiation: 'Пряко договаряне',
}
const STATUS_OPTIONS = [
  { value: 'in_progress', label: 'В процес' },
  { value: 'awarded', label: 'Възложена' },
  { value: 'completed', label: 'Приключена' },
  { value: 'cancelled', label: 'Прекратена' },
]
const DOC_TYPE_OPTIONS = [
  { value: 'report', label: 'Докладна записка' },
  { value: 'announcement', label: 'Обява / Покана' },
  { value: 'specification', label: 'Техническа спецификация' },
  { value: 'offer', label: 'Оферта' },
  { value: 'protocol', label: 'Протокол' },
  { value: 'contract', label: 'Договор' },
  { value: 'other', label: 'Друго' },
]
const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(DOC_TYPE_OPTIONS.map(o => [o.value, o.label]))

interface Props {
  item: any
  canEdit: boolean
  onClose: () => void
  onChanged: () => void
}

export default function ProcurementModal({ item, canEdit, onClose, onChanged }: Props) {
  const supabase = createClient()
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState('report')
  const [status, setStatus] = useState(item.status)

  useEffect(() => {
    loadFiles()
  }, [])

  async function loadFiles() {
    const { data } = await supabase.from('procurement_files')
      .select('*').eq('procurement_id', item.id).order('uploaded_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }

  async function handleUpload(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const filePath = `procurements/${item.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true })
    if (upErr) { alert(`Грешка: ${upErr.message}`); setUploading(false); return }

    await supabase.from('procurement_files').insert({
      procurement_id: item.id,
      file_url: filePath,
      file_name: file.name,
      doc_type: uploadType,
    })
    await loadFiles()
    setUploading(false)
    onChanged()
  }

  async function handleDownload(fileUrl: string) {
    const win = window.open('', '_blank')
    const { data } = await supabase.storage.from('documents').createSignedUrl(fileUrl, 120)
    if (data?.signedUrl && win) win.location.href = data.signedUrl
    else if (win) win.close()
  }

  async function handleDeleteFile(id: string) {
    if (!confirm('Изтриване на файла?')) return
    await supabase.from('procurement_files').delete().eq('id', id)
    await loadFiles()
    onChanged()
  }

  async function handleStatusChange(newStatus: string) {
    setStatus(newStatus)
    await supabase.from('procurements').update({ status: newStatus }).eq('id', item.id)
    onChanged()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl border border-slate-200/80 max-w-2xl w-full shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Package size={18} className="text-slate-500" />
            </div>
            <div>
              <h3 className="font-medium text-slate-800 text-sm">{item.subject}</h3>
              {item.number && <p className="text-[11px] text-slate-400 mt-0.5">{item.number}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Детайли */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Обект</div>
              <div className="text-sm text-slate-700 mt-0.5">{OBJECT_LABELS[item.object_type] || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Процедура</div>
              <div className="text-sm text-slate-700 mt-0.5">{PROCEDURE_LABELS[item.procedure_type] || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Прогнозна стойност</div>
              <div className="text-sm text-slate-700 mt-0.5">
                {item.estimated_value ? `${Number(item.estimated_value).toLocaleString('bg-BG')} EUR` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">CPV код</div>
              <div className="text-sm text-slate-700 mt-0.5">{item.cpv_code || '—'}</div>
            </div>
          </div>

          {item.description && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Описание</div>
              <div className="text-sm text-slate-600">{item.description}</div>
            </div>
          )}

          {/* Статус */}
          {canEdit && (
            <div>
              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Статус</div>
              <div className="flex gap-1.5">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} type="button" onClick={() => handleStatusChange(s.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      status === s.value ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Файлове */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-700">Документи ({files.length})</span>
            </div>

            {/* Качване */}
            {canEdit && (
              <div className="flex gap-2 mb-3">
                <select value={uploadType} onChange={e => setUploadType(e.target.value)}
                  className="input text-xs flex-shrink-0 w-44">
                  {DOC_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <label className="flex-1 flex items-center justify-center gap-2 h-9 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all text-slate-400">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span className="text-xs font-medium">{uploading ? 'Качване...' : 'Прикачи файл'}</span>
                  <input type="file" className="hidden" disabled={uploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
                </label>
              </div>
            )}

            {/* Списък файлове */}
            {loading ? (
              <div className="text-center py-4"><Loader2 size={18} className="animate-spin mx-auto text-slate-300" /></div>
            ) : files.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Няма прикачени документи</p>
            ) : (
              <div className="space-y-2">
                {files.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl group">
                    <FileText size={15} className="text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{f.file_name}</div>
                      <div className="text-[10px] text-slate-400">{DOC_TYPE_LABELS[f.doc_type] || 'Друго'}</div>
                    </div>
                    <button type="button" onClick={() => handleDownload(f.file_url)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-white transition-colors">
                      <Download size={14} />
                    </button>
                    {canEdit && (
                      <button type="button" onClick={() => handleDeleteFile(f.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
