'use client'

// Преглед „само за четене“ на споделен файл от колега — без достъп до Drive.
// Сървърът сваля файла (като PDF, ако е Google документ) и той се показва тук,
// в цял екран; Esc затваря. Ако форматът не се преглежда (напр. Excel), се предлага изтегляне.

import { useEffect, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'

export function DocViewer({ file, onClose }: { file: { id: string; name: string } | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [kind, setKind] = useState<'pdf' | 'img' | 'none' | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!file) return
    let off = false, objUrl: string | null = null
    setUrl(null); setKind(null); setErr('')
    fetch(`/api/staff-docs/download?fileId=${encodeURIComponent(file.id)}&as=pdf`)
      .then(async res => {
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Файлът не може да се отвори') }
        const type = (res.headers.get('Content-Type') || '').toLowerCase()
        const blob = await res.blob()
        if (off) return
        const k = type.includes('pdf') ? 'pdf' : type.startsWith('image/') ? 'img' : 'none'
        setKind(k)
        if (k !== 'none') { objUrl = URL.createObjectURL(k === 'pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob); setUrl(objUrl) }
      })
      .catch(e => { if (!off) setErr(e.message || 'Грешка') })
    return () => { off = true; if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [file?.id])

  useEffect(() => {
    if (!file) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [file, onClose])

  if (!file) return null
  const download = () => { window.location.href = `/api/staff-docs/download?fileId=${encodeURIComponent(file.id)}&as=office` }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex flex-col p-3 md:p-6" onClick={onClose}>
      <div className="flex items-center gap-2 mb-2 text-white" onClick={e => e.stopPropagation()}>
        <span className="text-sm truncate flex-1">{file.name}</span>
        <span className="hidden sm:inline text-[11px] text-white/70 mr-2">само преглед</span>
        <button type="button" onClick={download}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25">
          <Download size={13} /> Изтегли
        </button>
        <button type="button" onClick={onClose} title="Затвори (Esc)"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25">
          <X size={14} /> Затвори
        </button>
      </div>
      <div className="flex-1 min-h-0 rounded-xl overflow-hidden shadow-2xl bg-white flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {err ? (
          <p className="text-sm text-rose-700 px-6 text-center">{err}</p>
        ) : !kind ? (
          <span className="inline-flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Отваряне…</span>
        ) : kind === 'none' ? (
          <div className="text-center px-6">
            <p className="text-sm text-slate-600 mb-3">Този файл не може да се прегледа тук.</p>
            <button type="button" onClick={download}
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border-2 border-[#0f2240] text-[#0f2240] hover:bg-[#0f2240] hover:text-white">
              <Download size={14} /> Изтегли го
            </button>
          </div>
        ) : kind === 'pdf' ? (
          <iframe src={`${url}#view=FitH`} title={file.name} className="w-full h-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url!} alt={file.name} className="max-w-full max-h-full object-contain" />
        )}
      </div>
    </div>
  )
}
