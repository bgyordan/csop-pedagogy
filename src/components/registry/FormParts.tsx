'use client'

// Общи елементи за формите в деловодството (нов/редакция на входящ, изходящ, заповед):
// еднакъв надпис над поле, секция със заглавие и голямо поле за файл (клик или пускане с мишката).

import { useState } from 'react'
import { FileText, Paperclip, Upload, X } from 'lucide-react'

export const LABEL_CLS = 'block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5'

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className={`${LABEL_CLS} flex items-center gap-1.5`}>
      {children}
      {hint && <span className="normal-case tracking-normal font-normal text-slate-400">{hint}</span>}
    </label>
  )
}

/** Секция във формата: малко заглавие + съдържание. */
export function FormSection({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`space-y-3 ${className}`}>
      <h4 className="text-[11px] font-semibold text-[#0f2240] uppercase tracking-widest flex items-center gap-2">
        <span>{title}</span>
        <span className="flex-1 h-px bg-slate-200" />
      </h4>
      {children}
    </section>
  )
}

/** Поле за файл: клик или пускане на файла с мишката. Показва текущия и новия файл. */
export function FileDrop({ file, onFile, currentName, missing = false, accept = '.pdf,.doc,.docx' }: {
  file: File | null
  onFile: (f: File | null) => void
  currentName?: string | null
  /** Подчертава полето в жълто, когато записът още няма файл. */
  missing?: boolean
  accept?: string
}) {
  const [over, setOver] = useState(false)

  return (
    <div className="space-y-2">
      {currentName && !file && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <Paperclip size={14} className="text-slate-500 flex-shrink-0" />
          <span className="text-sm text-slate-700 truncate flex-1">{currentName}</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">текущ</span>
        </div>
      )}

      {file ? (
        <div className="flex items-center gap-3 px-3 py-3 bg-emerald-50 rounded-xl border border-emerald-200">
          <FileText size={18} className="text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-800 truncate">{file.name}</div>
            <div className="text-[11px] text-slate-500">{(file.size / 1024).toFixed(0)} KB · ще се качи при запис</div>
          </div>
          <button type="button" onClick={() => onFile(null)} title="Махни"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white transition-colors"><X size={15} /></button>
        </div>
      ) : (
        <label
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
          className={`flex flex-col items-center justify-center gap-1 w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            over ? 'border-[#0f2240] bg-slate-100'
            : missing ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400'
            : 'border-slate-300 hover:border-[#0f2240] hover:bg-slate-50'
          }`}>
          <Upload size={18} className={missing && !over ? 'text-amber-600' : 'text-slate-400'} />
          <span className={`text-xs ${missing && !over ? 'text-amber-800' : 'text-slate-600'}`}>
            {currentName ? 'Смени файла' : 'Прикачи файл'} — <span className="underline">избери</span> или го пусни тук
          </span>
          <span className="text-[10px] text-slate-400">PDF или Word, до 10 MB</span>
          <input type="file" className="hidden" accept={accept}
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
        </label>
      )}
    </div>
  )
}
