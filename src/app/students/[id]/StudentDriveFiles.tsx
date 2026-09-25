'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, FileSpreadsheet, Presentation, File, ExternalLink, Plus, Trash2, X } from 'lucide-react'

type DriveFile = {
  id: string
  title: string
  url: string
  created_at: string
}

function kindOf(url: string) {
  if (url.includes('docs.google.com/document')) return { label: 'Документ', Icon: FileText, color: '#2563eb' }
  if (url.includes('docs.google.com/spreadsheets')) return { label: 'Таблица', Icon: FileSpreadsheet, color: '#16a34a' }
  if (url.includes('docs.google.com/presentation')) return { label: 'Презентация', Icon: Presentation, color: '#d97706' }
  return { label: 'Файл', Icon: File, color: '#0f2240' }
}

function isDriveUrl(url: string) {
  return /^https:\/\/(docs|drive)\.google\.com\//.test(url.trim())
}

export default function StudentDriveFiles({ studentId }: { studentId: string }) {
  const supabase = createClient()
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('student_drive_files')
      .select('id, title, url, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    setFiles(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  async function save() {
    setError('')
    if (!title.trim()) return setError('Въведи име на документа.')
    if (!isDriveUrl(url)) return setError('Линкът трябва да е от Google Drive или Google Документи.')
    setSaving(true)

    const { data: auth } = await supabase.auth.getUser()
    let createdBy: string | null = null
    if (auth.user) {
      const { data: me } = await supabase
        .from('staff_profiles')
        .select('id')
        .eq('user_id', auth.user.id)
        .maybeSingle()
      createdBy = me?.id ?? null
    }

    const { error: err } = await supabase.from('student_drive_files').insert({
      student_id: studentId,
      title: title.trim(),
      url: url.trim(),
      created_by: createdBy,
    })
    setSaving(false)
    if (err) return setError('Не се записа: ' + err.message)
    setTitle('')
    setUrl('')
    setAdding(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Да махна ли линка? Самият файл в Drive остава.')) return
    await supabase.from('student_drive_files').delete().eq('id', id)
    setFiles((f) => f.filter((x) => x.id !== id))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-[#0f2240]">Документи в Drive</h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-sm text-[#0f2240] border border-[#0f2240]/20 rounded-lg px-3 py-1.5 hover:bg-[#0f2240]/5 transition"
          >
            <Plus size={15} /> Добави линк
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/60 p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Име, напр. Протокол 1 – работен"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Постави линка от Drive (Сподели → Копиране на връзката)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2240]/20"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setAdding(false); setError(''); setTitle(''); setUrl('') }}
              className="inline-flex items-center gap-1 text-sm text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <X size={14} /> Отказ
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm text-white bg-[#0f2240] px-4 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Записва…' : 'Запази'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Зарежда…</p>
      ) : files.length === 0 ? (
        !adding && <p className="text-sm text-gray-500">Няма документи в Drive. Добави линк към работен документ на детето.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {files.map((f) => {
            const { label, Icon, color } = kindOf(f.url)
            return (
              <li key={f.id} className="flex items-center gap-3 py-2.5 group">
                <Icon size={20} style={{ color }} className="shrink-0" />
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 hover:underline"
                >
                  <span className="block text-sm text-gray-800 truncate">{f.title}</span>
                  <span className="block text-xs text-gray-500">
                    {label}, добавен {new Date(f.created_at).toLocaleDateString('bg-BG')}
                  </span>
                </a>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-[#0f2240] hover:bg-gray-100"
                  aria-label="Отвори в Drive"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => remove(f.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                  aria-label="Махни линка"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
