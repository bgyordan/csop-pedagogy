'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Upload, FilePlus2, Loader2, X, ExternalLink, FolderOpen, Download, FileDown, Pencil, Trash2, Check, FileText,
} from 'lucide-react'
import { listStudentDocs, createBlankDoc, renameDoc, trashDocs, listDocTemplates, createFromTemplate } from './drive-actions'

type Item = { id: string; name: string; mimeType: string; modifiedTime: string; modifiedBy: string; url: string }

// Икони като в Office: W / X / P / PDF
function badgeOf(mime: string) {
  if (mime === 'application/vnd.google-apps.folder') return { t: '▢', bg: '#94a3b8' }
  if (mime.includes('document') || mime.includes('word')) return { t: 'W', bg: '#2b579a' }
  if (mime.includes('spreadsheet') || mime.includes('excel')) return { t: 'X', bg: '#217346' }
  if (mime.includes('presentation') || mime.includes('powerpoint')) return { t: 'P', bg: '#d24726' }
  if (mime === 'application/pdf') return { t: 'PDF', bg: '#d93025' }
  if (mime.startsWith('image/')) return { t: 'IMG', bg: '#7c3aed' }
  return { t: '…', bg: '#64748b' }
}

function Badge({ mime }: { mime: string }) {
  const b = badgeOf(mime)
  return (
    <span className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-white font-semibold"
          style={{ background: b.bg, fontSize: b.t.length > 1 ? 9 : 13 }}>
      {b.t}
    </span>
  )
}

function when(iso: string) {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? 'днес, ' + d.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// линкът се отваря с акаунта, с който колегата е влязъл в EIS (ако в браузъра има няколко)
function withAccount(url: string, email?: string) {
  if (!email) return url
  return url + (url.includes('?') ? '&' : '?') + 'authuser=' + encodeURIComponent(email)
}

// Табът се отваря ВЕДНАГА при натискането (иначе браузърът го блокира като изскачащ прозорец),
// а адресът се зарежда в него, когато сървърът е готов
function openPending() {
  const w = window.open('', '_blank')
  if (w) w.document.title = 'Създаване…'
  return {
    go(url: string) { if (w) w.location.href = url; else window.location.href = url },
    cancel() { w?.close() },
  }
}

const isFolder = (f: Item) => f.mimeType === 'application/vnd.google-apps.folder'

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [confirmDel, setConfirmDel] = useState<string[] | null>(null)
  const [templates, setTemplates] = useState<{ id: string; name: string; mimeType: string }[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const r = await listStudentDocs(studentId)
    if (r.error) setError(r.error)
    setFiles(r.files ?? [])
    setFolderUrl(r.folderUrl)
    setMyEmail(r.myEmail)
    setCanEdit(!!r.canEdit)
    setSelected(new Set())
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  // ── качване ──
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
        if (!res.ok || j.error) errors.push(j.error || `„${f.name}“ не се качи`)
      } catch {
        errors.push(`„${f.name}“ не се качи`)
      }
    }
    setBusy('')
    if (errors.length) setError(errors.join(' · '))
    await load()
  }

  // ── нов документ ──
  async function create() {
    if (!newName.trim()) return
    const tab = openPending()
    setBusy('Създаване…')
    setError('')
    const r = await createBlankDoc(studentId, newName)
    setBusy('')
    if (r.error || !r.url) { tab.cancel(); return setError(r.error || 'Документът не се създаде') }
    setCreating(false)
    setNewName('')
    tab.go(withAccount(r.url, myEmail))
    await load()
  }

  // ── нов от бланка ──
  async function openCreate() {
    setCreating(v => !v)
    if (templates === null) setTemplates(await listDocTemplates())
  }
  async function fromTemplate(t: { id: string; name: string }) {
    const tab = openPending()
    setBusy(`Създаване: ${t.name}…`)
    setError('')
    const r = await createFromTemplate(studentId, t.id)
    setBusy('')
    if (r.error || !r.url) { tab.cancel(); return setError(r.error || 'Документът не се създаде') }
    setCreating(false)
    tab.go(withAccount(r.url, myEmail))
    await load()
  }

  // ── сваляне (един или няколко; браузърът може да попита веднъж за „няколко файла“) ──
  async function download(ids: string[], as: 'office' | 'pdf') {
    for (const id of ids) {
      const a = document.createElement('a')
      a.href = `/api/student-docs/download?studentId=${studentId}&fileId=${id}&as=${as}`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      if (ids.length > 1) await new Promise(r => setTimeout(r, 700))
    }
  }

  // ── преименуване ──
  async function saveRename(id: string) {
    const name = renameVal.trim()
    setRenaming(null)
    if (!name || name === files.find(f => f.id === id)?.name) return
    setBusy('Преименуване…')
    const r = await renameDoc(studentId, id, name)
    setBusy('')
    if (r.error) setError(r.error)
    await load()
  }

  // ── изтриване (в кошчето на Drive) ──
  async function doDelete(ids: string[]) {
    setConfirmDel(null)
    setBusy(ids.length > 1 ? `Изтриване на ${ids.length} файла…` : 'Изтриване…')
    const r = await trashDocs(studentId, ids)
    setBusy('')
    if (r.error) setError(r.error)
    await load()
  }

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const selectable = files.filter(f => !isFolder(f))
  const allSelected = selectable.length > 0 && selectable.every(f => selected.has(f.id))
  const sel = Array.from(selected)

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (canEdit && e.dataTransfer.files?.length) upload(e.dataTransfer.files)
  }

  const iconBtn = 'p-1.5 rounded-md text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 transition'
  const softBtn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs text-[#0f2240] hover:shadow-sm transition disabled:opacity-50'

  return (
    <div
      className={`bg-white rounded-2xl border p-4 shadow-sm transition ${dragging ? 'border-sky-400 ring-4 ring-sky-100' : 'border-slate-200/80'}`}
      onDragOver={e => { if (canEdit) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
      onDrop={onDrop}
    >
      {/* заглавие + действия */}
      <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-100">
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
              className={`${softBtn} border-slate-200 hover:bg-slate-50`}>
              <Upload size={14} /> Качи файлове
            </button>
            <button type="button" onClick={openCreate} disabled={!!busy}
              className={`${softBtn} border-sky-200 bg-sky-50 hover:bg-sky-100`}>
              <FilePlus2 size={14} /> Нов документ
            </button>
            <input ref={inputRef} type="file" multiple hidden
              accept=".doc,.docx,.odt,.rtf,.xls,.xlsx,.ppt,.pptx,.pdf,image/*"
              onChange={e => { if (e.target.files) upload(e.target.files); e.target.value = '' }} />
          </div>
        )}
      </div>

      {/* нов документ: от бланка или празен */}
      {creating && (
        <div className="mb-3 p-3 rounded-xl border border-sky-100 bg-sky-50/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Изберете бланка — данните на детето се попълват сами</span>
            <button type="button" onClick={() => setCreating(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={15} /></button>
          </div>
          {templates === null ? (
            <div className="flex items-center gap-2 py-2 text-xs text-slate-400"><Loader2 size={13} className="animate-spin" /> Зареждане на бланките…</div>
          ) : templates.length === 0 ? (
            <div className="py-2 text-xs text-slate-400 font-light">Няма бланки. Качете ги в папка „Бланки“ в споделения диск.</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-3">
              {templates.map(t => (
                <button key={t.id} type="button" onClick={() => fromTemplate(t)} disabled={!!busy}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-left text-sm text-slate-700 hover:border-sky-200 hover:shadow-sm hover:-translate-y-0.5 transition disabled:opacity-50">
                  <Badge mime={t.mimeType} />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-sky-100">
            <FileText size={14} className="text-slate-400 shrink-0" />
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="или празен документ с име…"
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-100" />
            <button type="button" onClick={create} disabled={!newName.trim() || !!busy}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-[#0f2240] hover:bg-slate-50 disabled:opacity-50">
              Създай
            </button>
          </div>
        </div>
      )}

      {/* лента за избраните */}
      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-sky-50/70 border border-sky-100 text-xs">
          <span className="text-[#0f2240]">Избрани: {sel.length}</span>
          <button type="button" onClick={() => download(sel, 'office')} className={`${softBtn} border-slate-200 bg-white hover:bg-slate-50`}>
            <Download size={13} /> Изтегли
          </button>
          <button type="button" onClick={() => download(sel, 'pdf')} className={`${softBtn} border-slate-200 bg-white hover:bg-slate-50`}>
            <FileDown size={13} /> Изтегли PDF
          </button>
          {canEdit && (
            confirmDel && confirmDel.length === sel.length && confirmDel.every(id => selected.has(id)) ? (
              <span className="inline-flex items-center gap-2 text-red-700">
                Изтриване на {sel.length}?
                <button type="button" onClick={() => doDelete(sel)} className="px-2 py-1 rounded-md bg-red-50 border border-red-200 hover:bg-red-100">Да</button>
                <button type="button" onClick={() => setConfirmDel(null)} className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">Не</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmDel(sel)} className={`${softBtn} border-red-100 bg-white text-red-700 hover:bg-red-50`}>
                <Trash2 size={13} /> Изтрий
              </button>
            )
          )}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2 mb-2 text-xs text-sky-700">
          <Loader2 size={14} className="animate-spin" /> {busy}
        </div>
      )}
      {error && (
        <div className="mb-2 p-2.5 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 flex items-start gap-2">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')}><X size={13} /></button>
        </div>
      )}

      {/* списъкът — като в Explorer */}
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
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          {/* заглавен ред */}
          <div className="grid grid-cols-[28px_minmax(0,1fr)_170px_132px] items-center gap-2 px-3 py-2 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-400">
            <input type="checkbox" checked={allSelected} aria-label="Избери всички"
              onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map(f => f.id)))}
              className="accent-[#0f2240]" />
            <span>Име</span>
            <span className="hidden sm:block">Последна промяна</span>
            <span />
          </div>

          {files.map((f, i) => {
            const checked = selected.has(f.id)
            const deleting = confirmDel?.length === 1 && confirmDel[0] === f.id
            return (
              <div key={f.id}
                className={`group grid grid-cols-[28px_minmax(0,1fr)_170px_132px] items-center gap-2 px-3 py-2 text-sm transition
                  ${checked ? 'bg-sky-50/70' : i % 2 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-sky-50/50`}>
                {isFolder(f)
                  ? <span />
                  : <input type="checkbox" checked={checked} onChange={() => toggle(f.id)} className="accent-[#0f2240]" aria-label={`Избери ${f.name}`} />}

                {/* име (натискане = отваря за редакция) */}
                {renaming === f.id ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge mime={f.mimeType} />
                    <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(f.id); if (e.key === 'Escape') setRenaming(null) }}
                      className="flex-1 min-w-0 px-2 py-1 border border-sky-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-100" />
                    <button type="button" onClick={() => saveRename(f.id)} className={iconBtn} title="Запази"><Check size={15} /></button>
                    <button type="button" onClick={() => setRenaming(null)} className={iconBtn} title="Откажи"><X size={15} /></button>
                  </div>
                ) : (
                  <a href={withAccount(f.url, myEmail)} target="_blank" rel="noreferrer"
                     className="flex items-center gap-2.5 min-w-0 hover:text-[#0f2240]">
                    <Badge mime={f.mimeType} />
                    <span className="truncate text-slate-700 group-hover:text-[#0f2240]" title={f.name}>{f.name}</span>
                  </a>
                )}

                <span className="hidden sm:block text-xs text-slate-400 font-light truncate" title={f.modifiedBy}>
                  {when(f.modifiedTime)}{f.modifiedBy ? ` · ${f.modifiedBy}` : ''}
                </span>

                {/* действия на реда */}
                <div className="flex items-center justify-end gap-0.5">
                  {deleting ? (
                    <span className="inline-flex items-center gap-1 text-xs text-red-700">
                      Изтрий?
                      <button type="button" onClick={() => doDelete([f.id])} className="px-1.5 py-0.5 rounded bg-red-50 border border-red-200 hover:bg-red-100">Да</button>
                      <button type="button" onClick={() => setConfirmDel(null)} className="px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600">Не</button>
                    </span>
                  ) : !isFolder(f) && (
                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition">
                      <button type="button" onClick={() => download([f.id], 'office')} className={iconBtn} title="Изтегли (Word)">
                        <Download size={15} />
                      </button>
                      <button type="button" onClick={() => download([f.id], 'pdf')} className={iconBtn} title="Изтегли като PDF">
                        <FileDown size={15} />
                      </button>
                      {canEdit && (
                        <>
                          <button type="button" onClick={() => { setRenaming(f.id); setRenameVal(f.name) }} className={iconBtn} title="Преименувай">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => setConfirmDel([f.id])} className={`${iconBtn} hover:!text-red-600`} title="Изтрий">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {canEdit && files.length > 0 && (
        <p className="mt-3 text-[11px] text-slate-400 font-light">
          Провлачете файлове върху картата, за да ги качите. Промените в документите се пазят автоматично. Изтритите остават 30 дни в кошчето на Drive.
        </p>
      )}
    </div>
  )
}
