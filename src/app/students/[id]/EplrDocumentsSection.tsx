'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Download, Trash2, FileText, Loader2, Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface EplrDoc {
  id: string
  file_name: string
  file_path: string
  file_size: number | null
  doc_type: string
  created_at: string
}

interface Props {
  studentId: string
  academicYearId: string
  documents: EplrDoc[]
  canManage: boolean
  staffId: string
}

// Типове ЕПЛР документи (реални имена от практиката)
export const EPLR_DOC_TYPES: Record<string, string> = {
  report_assessment: 'Доклад-оценка',
  protocol_1: 'Протокол №1',
  protocol_2: 'Протокол №2',
  protocol_3: 'Протокол №3',
  functional_map: 'Карта функционална оценка',
  support_plan: 'План за допълнителна подкрепа',
  iup_class: 'ИУП (клас)',
  iu_program_school: 'ИУ Програма (училище)',
  characteristic: 'Характеристика',
  other: 'Други',
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function EplrDocumentsSection({ studentId, academicYearId, documents: initial, canManage, staffId }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [documents, setDocuments] = useState<EplrDoc[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('report_assessment')
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) {
      toast('Позволени са само PDF и Word файлове', 'error'); return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('Файлът е прекалено голям (макс. 10MB)', 'error'); return
    }
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
    const filePath = `${studentId}/eplr/${Date.now()}_${safeName}`
    const { error: uploadError } = await supabase.storage
      .from('student-dossiers').upload(filePath, file)
    if (uploadError) {
      toast('Грешка при качване', 'error'); setUploading(false); return
    }
    const { data: newDoc, error: dbError } = await supabase
      .from('eplr_attachments')
      .insert({
        student_id: studentId,
        academic_year_id: academicYearId,
        doc_type: docType,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        uploaded_by: staffId,
      })
      .select().single()
    if (dbError) {
      toast('Грешка при запис', 'error'); setUploading(false); return
    }
    toast('Документът е качен успешно')
    setDocuments(prev => [newDoc, ...prev])
    setUploading(false)
    e.target.value = ''
  }

  async function handleDownload(doc: EplrDoc) {
    setDownloading(doc.id)
    const { data, error } = await supabase.storage
      .from('student-dossiers').createSignedUrl(doc.file_path, 60)
    if (error || !data) {
      toast('Грешка при изтегляне', 'error'); setDownloading(null); return
    }
    window.open(data.signedUrl, '_blank')
    setDownloading(null)
  }

  async function handleDelete(doc: EplrDoc) {
    if (!confirm(`Изтрий "${EPLR_DOC_TYPES[doc.doc_type] || doc.doc_type}"?`)) return
    await supabase.storage.from('student-dossiers').remove([doc.file_path])
    await supabase.from('eplr_attachments').delete().eq('id', doc.id)
    toast('Документът е изтрит')
    setDocuments(prev => prev.filter(d => d.id !== doc.id))
  }

  // Кои типове са налични (за индикатора "качени X от 10")
  const uploadedTypes = new Set(documents.map(d => d.doc_type))

  return (
    <div>
      {canManage && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <select value={docType} onChange={e => setDocType(e.target.value)} className="input sm:flex-1 text-sm">
            {Object.entries(EPLR_DOC_TYPES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <label className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors ${uploading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'}`}
            style={{ backgroundColor: '#0f2240' }}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? 'Качване...' : 'Прикачи документ'}
            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-slate-400">Няма качени ЕПЛР документи за тази година</p>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-emerald-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">
                    {EPLR_DOC_TYPES[doc.doc_type] || doc.doc_type}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {doc.file_name}
                    {doc.file_size && <span className="ml-1">· {formatSize(doc.file_size)}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => handleDownload(doc)} disabled={downloading === doc.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Изтегли">
                  {downloading === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                </button>
                {canManage && (
                  <button onClick={() => handleDelete(doc)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Изтрий">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
