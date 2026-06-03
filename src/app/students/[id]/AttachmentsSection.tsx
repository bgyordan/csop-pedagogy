'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Attachment {
  id: string
  file_name: string
  file_path: string
  file_size: number | null
  doc_type: string
  created_at: string
}

interface Props {
  studentId: string
  attachments: Attachment[]
  canManage: boolean
  staffId: string
  typeLabels: Record<string, string>
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AttachmentsSection({ studentId, attachments: initial, canManage, staffId, typeLabels }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [attachments, setAttachments] = useState<Attachment[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('referral_order')
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) {
      toast('Позволени са само PDF и Word файлове', 'error')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast('Файлът е прекалено голям (макс. 10MB)', 'error')
      return
    }

    setUploading(true)
    const filePath = `${studentId}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('student-dossiers')
      .upload(filePath, file)

    if (uploadError) {
      toast('Грешка при качване', 'error')
      setUploading(false)
      return
    }

    const { data: newAttachment, error: dbError } = await supabase
      .from('student_attachments')
      .insert({
        student_id: studentId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        doc_type: docType,
        uploaded_by: staffId,
      })
      .select()
      .single()

    if (dbError) {
      toast('Грешка при запис', 'error')
      setUploading(false)
      return
    }

    toast('Файлът е качен успешно')
    setAttachments(prev => [newAttachment, ...prev])
    setUploading(false)
    e.target.value = ''
  }

  async function handleDownload(attachment: Attachment) {
    setDownloading(attachment.id)
    const { data, error } = await supabase.storage
      .from('student-dossiers')
      .createSignedUrl(attachment.file_path, 60)

    if (error || !data) {
      toast('Грешка при изтегляне', 'error')
      setDownloading(null)
      return
    }

    window.open(data.signedUrl, '_blank')
    setDownloading(null)
  }

  async function handleDelete(attachment: Attachment) {
    if (!confirm(`Изтрий "${typeLabels[attachment.doc_type] || attachment.doc_type}"?`)) return

    await supabase.storage.from('student-dossiers').remove([attachment.file_path])
    await supabase.from('student_attachments').delete().eq('id', attachment.id)

    toast('Файлът е изтрит')
    setAttachments(prev => prev.filter(a => a.id !== attachment.id))
  }

  return (
    <div>
      {canManage && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <select
            value={docType}
            onChange={e => setDocType(e.target.value)}
            className="input sm:w-56 text-sm"
          >
            {Object.entries(typeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors ${uploading ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'}`}
            style={{ backgroundColor: '#0f2240' }}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {uploading ? 'Качване...' : 'Прикачи файл'}
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          <span className="text-xs text-slate-400 self-center">PDF или Word, макс. 10MB</span>
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-slate-400">Няма прикачени документи</p>
      ) : (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">
                    {typeLabels[att.doc_type] || att.doc_type}
                  </div>
                  <div className="text-xs text-slate-400">
                    {att.file_name}
                    {att.file_size && <span className="ml-1">· {formatSize(att.file_size)}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleDownload(att)}
                  disabled={downloading === att.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Изтегли"
                >
                  {downloading === att.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Download size={14} />}
                </button>
                {canManage && (
                  <button
                    onClick={() => handleDelete(att)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Изтрий"
                  >
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
