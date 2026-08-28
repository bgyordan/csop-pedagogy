'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import {
  Upload, File, FileText, FileSpreadsheet, FileImage, Download, Trash2,
  Pencil, Share2, FolderPlus, Folder, FolderOpen, Search, X, Check, MoveRight,
} from 'lucide-react'

const NAVY = '#0f2240'

type StaffFile = {
  id: string
  staff_id: string
  name: string
  path: string
  size: number
  mime_type: string | null
  folder: string | null
  is_shared: boolean
  created_at: string
}

type Kind = 'pdf' | 'word' | 'excel' | 'image' | 'other'

function kindOf(f: StaffFile): Kind {
  const m = (f.mime_type || '').toLowerCase()
  const n = f.name.toLowerCase()
  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf'
  if (m.includes('word') || m.includes('msword') || n.endsWith('.doc') || n.endsWith('.docx')) return 'word'
  if (m.includes('sheet') || m.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx') || n.endsWith('.csv')) return 'excel'
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(n)) return 'image'
  return 'other'
}

function FileIcon({ kind }: { kind: Kind }) {
  const size = 20
  if (kind === 'pdf') return <FileText size={size} style={{ color: '#dc2626' }} />
  if (kind === 'word') return <FileText size={size} style={{ color: '#2563eb' }} />
  if (kind === 'excel') return <FileSpreadsheet size={size} style={{ color: '#16a34a' }} />
  if (kind === 'image') return <FileImage size={size} style={{ color: '#9333ea' }} />
  return <File size={size} style={{ color: '#64748b' }} />
}

function formatSize(b: number): string {
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB'
  return (b / 1024 / 1024).toFixed(1) + ' MB'
}

const TYPE_CHIPS: { key: Kind | 'all'; label: string }[] = [
  { key: 'all', label: 'Всички' },
  { key: 'pdf', label: 'PDF' },
  { key: 'word', label: 'Word' },
  { key: 'excel', label: 'Excel' },
  { key: 'image', label: 'Изображения' },
  { key: 'other', label: 'Други' },
]

export default function MyFilesClient({ staffId }: { staffId: string }) {
  const supabase = createClient()
  const [files, setFiles] = useState<StaffFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<Kind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [newFolder, setNewFolder] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [moving, setMoving] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('staff_files')
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }, [supabase, staffId])

  useEffect(() => { load() }, [load])

  const folders = Array.from(new Set(files.map(f => f.folder).filter(Boolean) as string[])).sort()
  const allFolders = newFolder && !folders.includes(newFolder) ? [...folders, newFolder].sort() : folders

  async function doUpload(list: FileList | File[]) {
    setUploading(true)
    const arr = Array.from(list)
    for (const file of arr) {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const path = `${staffId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('staff-files').upload(path, file)
      if (upErr) { alert('Грешка при качване: ' + file.name); continue }
      await supabase.from('staff_files').insert({
        staff_id: staffId,
        name: file.name,
        path,
        size: file.size,
        mime_type: file.type || null,
        folder: activeFolder,
        is_shared: false,
      })
    }
    setUploading(false)
    load()
  }

  async function download(f: StaffFile) {
    const { data } = await supabase.storage.from('staff-files').createSignedUrl(f.path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function remove(f: StaffFile) {
    if (!confirm(`Изтриване на „${f.name}"?`)) return
    await supabase.storage.from('staff-files').remove([f.path])
    await supabase.from('staff_files').delete().eq('id', f.id)
    load()
  }

  async function toggleShare(f: StaffFile) {
    await supabase.from('staff_files').update({ is_shared: !f.is_shared }).eq('id', f.id)
    load()
  }

  async function saveRename(f: StaffFile) {
    if (renameVal.trim()) {
      await supabase.from('staff_files').update({ name: renameVal.trim() }).eq('id', f.id)
    }
    setRenaming(null)
    load()
  }

  async function moveTo(f: StaffFile, folder: string | null) {
    await supabase.from('staff_files').update({ folder }).eq('id', f.id)
    setMoving(null)
    load()
  }

  let shown = files
  if (activeFolder !== null) shown = shown.filter(f => f.folder === activeFolder)
  if (typeFilter !== 'all') shown = shown.filter(f => kindOf(f) === typeFilter)
  if (search.trim()) shown = shown.filter(f => f.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Мои файлове</h1>
        <p className="text-sm text-slate-500 mt-1">Лично място за работни файлове. Отбележи файл като споделен, за да го виждат колегите.</p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files) }}
        onClick={() => fileInput.current?.click()}
        className="rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors mb-6"
        style={{
          borderColor: dragOver ? NAVY : '#cbd5e1',
          backgroundColor: dragOver ? 'rgba(15,34,64,0.04)' : '#f8fafc',
        }}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) doUpload(e.target.files); e.target.value = '' }}
        />
        <Upload size={28} style={{ color: NAVY }} className="mx-auto mb-2" />
        <div className="text-sm font-medium" style={{ color: NAVY }}>
          {uploading ? 'Качване…' : 'Пусни файлове тук или щракни, за да избереш'}
        </div>
        {activeFolder && <div className="text-xs text-slate-400 mt-1">Ще се качат в папка „{activeFolder}"</div>}
      </div>

      <div className="flex gap-6">
        <div className="w-48 shrink-0">
          <div className="space-y-0.5">
            <button
              onClick={() => setActiveFolder(null)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ backgroundColor: activeFolder === null ? 'rgba(15,34,64,0.08)' : 'transparent', color: activeFolder === null ? NAVY : '#475569', fontWeight: activeFolder === null ? 600 : 400 }}
            >
              <FolderOpen size={16} /> Всички файлове
            </button>
            {allFolders.map(fld => (
              <button
                key={fld}
                onClick={() => setActiveFolder(fld)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left"
                style={{ backgroundColor: activeFolder === fld ? 'rgba(15,34,64,0.08)' : 'transparent', color: activeFolder === fld ? NAVY : '#475569', fontWeight: activeFolder === fld ? 600 : 400 }}
              >
                <Folder size={16} /> <span className="truncate">{fld}</span>
              </button>
            ))}
            {newFolder === null ? (
              <button
                onClick={() => setNewFolder('')}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                <FolderPlus size={16} /> Нова папка
              </button>
            ) : (
              <div className="flex items-center gap-1 px-1 py-1">
                <input
                  autoFocus
                  value={newFolder}
                  onChange={e => setNewFolder(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newFolder.trim()) { setActiveFolder(newFolder.trim()); setNewFolder(null) } if (e.key === 'Escape') setNewFolder(null) }}
                  placeholder="Име на папка"
                  className="flex-1 min-w-0 px-2 py-1 text-sm border rounded-lg"
                />
                <button onClick={() => { if (newFolder.trim()) { setActiveFolder(newFolder.trim()); setNewFolder(null) } }} className="p-1 text-green-600"><Check size={16} /></button>
                <button onClick={() => setNewFolder(null)} className="p-1 text-slate-400"><X size={16} /></button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Търсене по име…"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
              />
            </div>
            {TYPE_CHIPS.map(c => (
              <button
                key={c.key}
                onClick={() => setTypeFilter(c.key)}
                className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
                style={{ backgroundColor: typeFilter === c.key ? NAVY : '#f1f5f9', color: typeFilter === c.key ? '#fff' : '#475569' }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center text-slate-400 py-12 text-sm">Зареждане…</div>
          ) : shown.length === 0 ? (
            <div className="text-center text-slate-400 py-12 text-sm">
              {files.length === 0 ? 'Още нямаш качени файлове.' : 'Няма файлове по този филтър.'}
            </div>
          ) : (
            <div className="space-y-1">
              {shown.map(f => {
                const kind = kindOf(f)
                return (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group">
                    <FileIcon kind={kind} />
                    <div className="flex-1 min-w-0">
                      {renaming === f.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveRename(f); if (e.key === 'Escape') setRenaming(null) }}
                            className="flex-1 min-w-0 px-2 py-1 text-sm border rounded"
                          />
                          <button onClick={() => saveRename(f)} className="p-1 text-green-600"><Check size={15} /></button>
                          <button onClick={() => setRenaming(null)} className="p-1 text-slate-400"><X size={15} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-700 truncate">{f.name}</span>
                          {f.is_shared && (
                            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: 'rgba(15,34,64,0.08)', color: NAVY }}>
                              <Share2 size={10} /> Споделен
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-xs text-slate-400">{formatSize(f.size)} · {formatDate(f.created_at)}</div>
                    </div>

                    {moving === f.id ? (
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        <button onClick={() => moveTo(f, null)} className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200">Без папка</button>
                        {folders.map(fld => (
                          <button key={fld} onClick={() => moveTo(f, fld)} className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 max-w-[100px] truncate">{fld}</button>
                        ))}
                        <button onClick={() => setMoving(null)} className="p-1 text-slate-400"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => download(f)} title="Изтегли" className="p-1.5 rounded hover:bg-slate-200 text-slate-500"><Download size={16} /></button>
                        <button onClick={() => toggleShare(f)} title={f.is_shared ? 'Спри споделяне' : 'Сподели с колеги'} className="p-1.5 rounded hover:bg-slate-200" style={{ color: f.is_shared ? NAVY : '#94a3b8' }}><Share2 size={16} /></button>
                        <button onClick={() => setMoving(f.id)} title="Премести" className="p-1.5 rounded hover:bg-slate-200 text-slate-500"><MoveRight size={16} /></button>
                        <button onClick={() => { setRenaming(f.id); setRenameVal(f.name) }} title="Преименувай" className="p-1.5 rounded hover:bg-slate-200 text-slate-500"><Pencil size={16} /></button>
                        <button onClick={() => remove(f)} title="Изтрий" className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
