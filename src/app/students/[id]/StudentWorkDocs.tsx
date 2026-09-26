'use client'

import { useEffect, useRef, useState } from 'react'
import {
  FileText, FileSpreadsheet, Presentation, File, FileImage, Folder, Upload, FilePlus2,
  Loader2, X, ExternalLink, FolderOpen,
} from 'lucide-react'
import { listStudentDocs, createBlankDoc } from './drive-actions'

type Item = { id: string; name: string; mimeType: string; modifiedTime: string; modifiedBy: string; url: string }

function kindOf(mime: string) {
  if (mime === 'application/vnd.google-apps.folder') return { Icon: Folder, color: '#64748b', bg: '#f1f5f9' }
  if (mime.includes('document') || mime.includes('word')) return { Icon: FileText, color: '#2563eb', bg: '#eff6ff' }
  if (mime.includes('spreadsheet') || mime.includes('excel')) return { Icon: FileSpreadsheet, color: '#16a34a', bg: '#f0fdf4' }
  if (mime.includes('presentation') || mime.includes('powerpoint')) return { Icon: Presentation, color: '#d97706', bg: '#fffbeb' }
  if (mime === 'application/pdf') return { Icon: File, color: '#dc2626', bg: '#fef2f2' }
  if (mime.startsWith('image/')) return { Icon: FileImage, color: '#7c3aed', bg: '#f5f3ff' }
  return { Icon: File, color: '#0f2240', bg: '#f8fafc' }
}

function when(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? 'днес, ' + d.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// линкът се отваря с акаунта, с който колегата е влязъл в EIS (ако в браузъра има няколко)
function withAccount(url: string, email?: string) {
  if (!email) return url
  return url + (url.includes('?') ? '&' : '?') + 'authuser=' + encodeURIComponent(email)
}

export default function StudentWorkDocs({ studentId }: { studentId: string }) {
  const [files, setFiles] = useState<Item[]>([])
  const [folderUrl, setFolderUrl] = useState<string>()
  const [myEmail, setMyEmail] = useState<string>()
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const r = await listStudentDocs(studentId)
    if (r.error) setError(r.error)
    setFiles(r.files ?? [])
    setFolderUrl(r.folderUrl)
    setMyEmail(r.myEmail)
    setCanEdit(!!r.canEdit)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  async function upload(list: FileList | File[]) {
    const arr = Array.from(list)
    if (!arr.length) return
    setError('')
    const errors: string[] = []
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i]
      setBusy(arr.length > 1 ? `Качване ${i + 1} от ${arr.length}: ${f.name}` : `Качване: ${f.name}`)
      const fd = new FormData()
      fd.append('studentId', studentId)
      fd.append('file', f)
      try {
        const res = await fetch('/api/student-docs/upload', { method: 'POST', body: fd })
        const j = await res.json().catch(() => ({}))
        if (!res.ok || j.error) errors.push(j.error || `„${f.name}" не се качи`)
      } catch {
        errors.push(`„${f.name}" не се качи`)
      }
    }
    setBusy('')
    if (errors.length) setError(errors.join(' · '))
    await load()
  }

  async function create() {
    if (!newName.trim()) return
    setBusy('Създаване…')
    setError('')
    const r = await createBlankDoc(studentId, newName)
    setBusy('')
    if (r.error) return setError(r.error)
    setCreating(false)
    setNewName('')
    if (r.url) window.open(withAccount(r.url, myEmail), '_blank')
    await load()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (canEdit && e.dataTransfer.files?.length) upload(e.dataTransfer.files)
  }

  return (
    <div
      className={`bg-white rounded-2xl border p-4 shadow-sm transition ${dragging ? 'border-sky-400 ring-4 ring-sky-100' : 'border-slate-200/80'}`}
      onDragOver={e => { if (canEdit) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
      onDrop={onDrop}
    >
      {/* заглавие + действия */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <FolderOpen size={16} className="text-sky-500" />
        <h2 className="text-sm font-semibold text-slate-800">Документи на детето</h2>
        {folderUrl && (
          <a href={withAccount(folderUrl, myEmail)} target="_blank" rel="noreferrer"
             className="text-xs text-slate-400 hover:text-slate-600 inline-flex items-center gap-1 ml-1">
            папката в Drive <ExternalLink size={11} />
          </a>
        )}
        {canEdit && (
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-[#0f2240] hover:bg-slate-50 hover:shadow-sm transition disabled:opacity-50">
              <Upload size={14} /> Качи файлове
            </button>
            <button type="button" onClick={() => setCreating(v => !v)} disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-xs text-[#0f2240] hover:bg-sky-100 hover:shadow-sm transition disabled:opacity-50">
              <FilePlus2 size={14} /> Нов документ
            </button>
            <input ref={inputRef} type="file" multiple hidden
              accept=".doc,.docx,.odt,.rtf,.xls,.xlsx,.ppt,.pptx,.pdf,image/*"
              onChange={e => { if (e.target.files) upload(e.target.files); e.target.value = '' }} />
          </div>
        )}
      </div>

      {/* нов документ */}
      {creating && (
        <div className="flex items-center gap-2 mb-4">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="Име на документа, напр. Протокол 2"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-100" />
          <button type="button" onClick={create} disabled={!newName.trim() || !!busy}
            className="px-3 py-2 rounded-lg border border-sky-200 bg-sky-50 text-sm text-[#0f2240] hover:bg-sky-100 disabled:opacity-50">
            Създай
          </button>
          <button type="button" onClick={() => setCreating(false)} className="p-2 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2 mb-3 text-xs text-sky-700">
          <Loader2 size={14} className="animate-spin" /> {busy}
        </div>
      )}
      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">{error}</div>
      )}

      {/* файловете */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Зареждане…
        </div>
      ) : files.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 font-light">
          {canEdit
            ? <>Още няма документи за тази година.<br />Провлачете файлове тук (напр. от Teams) или натиснете „Качи файлове“.</>
            : 'Още няма документи за тази година.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map(f => {
            const k = kindOf(f.mimeType)
            return (
              <a key={f.id} href={withAccount(f.url, myEmail)} target="_blank" rel="noreferrer"
                 className="group flex items-start gap-3 p-3 rounded-xl border border-slate-200/80 bg-white hover:shadow-md hover:-translate-y-0.5 transition">
                <span className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                  <k.Icon size={20} style={{ color: k.color }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-800 truncate group-hover:text-[#0f2240]" title={f.name}>{f.name}</span>
                  <span className="block text-xs text-slate-400 font-light mt-0.5 truncate">
                    {when(f.modifiedTime)}{f.modifiedBy ? ` · ${f.modifiedBy}` : ''}
                  </span>
                </span>
              </a>
            )
          })}
        </div>
      )}

      {canEdit && files.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400 font-light">
          Можете да провлачите файлове директно върху тази карта. Промените в документите се пазят автоматично.
        </p>
      )}
    </div>
  )
}
