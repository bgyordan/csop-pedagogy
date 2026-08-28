'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import {
  Upload, File, FileText, FileSpreadsheet, FileImage, Download, Trash2,
  Pencil, Share2, FolderPlus, Folder, Search, X, Check, ChevronRight, Home, MoreVertical,
} from 'lucide-react'

const NAVY = '#0f2240'

type StaffFile = {
  id: string
  staff_id: string
  name: string
  path: string
  size: number
  mime_type: string | null
  folder_id: string | null
  is_shared: boolean
  created_at: string
}
type StaffFolder = { id: string; name: string; created_at: string }
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
function FileIcon({ kind, big }: { kind: Kind; big?: boolean }) {
  const s = big ? 36 : 20
  if (kind === 'pdf') return <FileText size={s} style={{ color: '#dc2626' }} />
  if (kind === 'word') return <FileText size={s} style={{ color: '#2563eb' }} />
  if (kind === 'excel') return <FileSpreadsheet size={s} style={{ color: '#16a34a' }} />
  if (kind === 'image') return <FileImage size={s} style={{ color: '#9333ea' }} />
  return <File size={s} style={{ color: '#64748b' }} />
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
  const [folders, setFolders] = useState<StaffFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [cwd, setCwd] = useState<string | null>(null) // текуща папка (null = корен)
  const [typeFilter, setTypeFilter] = useState<Kind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [moving, setMoving] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const [{ data: ff }, { data: fd }] = await Promise.all([
      supabase.from('staff_files').select('*').eq('staff_id', staffId).order('created_at', { ascending: false }),
      supabase.from('staff_folders').select('*').eq('staff_id', staffId).order('name'),
    ])
    setFiles(ff || [])
    setFolders(fd || [])
    setLoading(false)
  }, [supabase, staffId])
  useEffect(() => { load() }, [load])

  const currentFolder = folders.find(f => f.id === cwd) || null

  async function doUpload(list: FileList | File[]) {
    setUploading(true)
    for (const file of Array.from(list)) {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const path = `${staffId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from('staff-files').upload(path, file)
      if (error) { alert('Грешка при качване: ' + file.name); continue }
      await supabase.from('staff_files').insert({
        staff_id: staffId, name: file.name, path, size: file.size,
        mime_type: file.type || null, folder_id: cwd, is_shared: false,
      })
    }
    setUploading(false)
    load()
  }
  async function createFolder() {
    const n = folderName.trim()
    if (!n) return
    await supabase.from('staff_folders').insert({ staff_id: staffId, name: n })
    setFolderName(''); setCreatingFolder(false); load()
  }
  async function deleteFolder(fld: StaffFolder) {
    const inside = files.filter(f => f.folder_id === fld.id).length
    if (!confirm(inside ? `Папка „${fld.name}" съдържа ${inside} файла. Те ще излязат в основната папка. Изтриване?` : `Изтриване на папка „${fld.name}"?`)) return
    await supabase.from('staff_folders').delete().eq('id', fld.id)
    load()
  }
  async function download(f: StaffFile) {
    const { data } = await supabase.storage.from('staff-files').createSignedUrl(f.path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    setMenuFor(null)
  }
  async function remove(f: StaffFile) {
    if (!confirm(`Изтриване на „${f.name}"?`)) return
    await supabase.storage.from('staff-files').remove([f.path])
    await supabase.from('staff_files').delete().eq('id', f.id)
    setMenuFor(null); load()
  }
  async function toggleShare(f: StaffFile) {
    await supabase.from('staff_files').update({ is_shared: !f.is_shared }).eq('id', f.id)
    setMenuFor(null); load()
  }
  async function saveRename(f: StaffFile) {
    if (renameVal.trim()) await supabase.from('staff_files').update({ name: renameVal.trim() }).eq('id', f.id)
    setRenaming(null); load()
  }
  async function moveTo(f: StaffFile, folderId: string | null) {
    await supabase.from('staff_files').update({ folder_id: folderId }).eq('id', f.id)
    setMoving(null); setMenuFor(null); load()
  }

  // какво се показва в текущата папка
  const foldersHere = cwd === null ? folders : []
  let filesHere = files.filter(f => f.folder_id === cwd)
  if (typeFilter !== 'all') filesHere = filesHere.filter(f => kindOf(f) === typeFilter)
  if (search.trim()) filesHere = filesHere.filter(f => f.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="max-w-6xl mx-auto p-6" onClick={() => setMenuFor(null)}>
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Мои файлове</h1>
        <p className="text-sm text-slate-500 mt-1">Лично място за работни файлове. Отбележи файл като споделен, за да го виждат колегите.</p>
      </div>

      {/* лента с breadcrumb + действия */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <button onClick={() => setCwd(null)} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors" style={{ color: cwd === null ? NAVY : '#64748b', fontWeight: cwd === null ? 600 : 400 }}>
            <Home size={15} /> Мои файлове
          </button>
          {currentFolder && (
            <>
              <ChevronRight size={14} className="text-slate-300" />
              <span className="px-2 py-1 font-semibold" style={{ color: NAVY }}>{currentFolder.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cwd === null && (
            <button onClick={() => setCreatingFolder(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors hover:bg-slate-50" style={{ color: NAVY, borderColor: '#cbd5e1' }}>
              <FolderPlus size={16} /> Нова папка
            </button>
          )}
          <button onClick={() => fileInput.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors" style={{ backgroundColor: NAVY }}>
            <Upload size={16} /> {uploading ? 'Качване…' : 'Качи файл'}
          </button>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) doUpload(e.target.files); e.target.value = '' }} />
        </div>
      </div>

      {/* филтри */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Търсене…" className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg" />
        </div>
        {TYPE_CHIPS.map(c => (
          <button key={c.key} onClick={() => setTypeFilter(c.key)} className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors" style={{ backgroundColor: typeFilter === c.key ? NAVY : '#f1f5f9', color: typeFilter === c.key ? '#fff' : '#475569' }}>{c.label}</button>
        ))}
      </div>

      {/* drop зона */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files) }}
        className="rounded-2xl border-2 border-dashed p-3 mb-5 transition-colors"
        style={{ borderColor: dragOver ? NAVY : '#e2e8f0', backgroundColor: dragOver ? 'rgba(15,34,64,0.04)' : 'transparent' }}
      >
        {loading ? (
          <div className="text-center text-slate-400 py-12 text-sm">Зареждане…</div>
        ) : foldersHere.length === 0 && filesHere.length === 0 ? (
          <div className="text-center text-slate-400 py-14 text-sm">
            {cwd === null ? 'Празно. Създай папка или качи файл — може и с влачене тук.' : 'Папката е празна. Пусни файлове тук или „Качи файл".'}
          </div>
        ) : (
          <div className="p-2">
            {/* НОВА ПАПКА inline */}
            {creatingFolder && cwd === null && (
              <div className="flex items-center gap-2 mb-3 p-3 rounded-xl border bg-white" style={{ borderColor: '#cbd5e1' }}>
                <Folder size={20} style={{ color: NAVY }} />
                <input autoFocus value={folderName} onChange={e => setFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setFolderName('') } }}
                  placeholder="Име на папка" className="flex-1 px-2 py-1 text-sm border rounded-lg" />
                <button onClick={createFolder} className="p-1.5 text-green-600"><Check size={18} /></button>
                <button onClick={() => { setCreatingFolder(false); setFolderName('') }} className="p-1.5 text-slate-400"><X size={18} /></button>
              </div>
            )}

            {/* ПАПКИ (само в корена) */}
            {foldersHere.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                {foldersHere.map(fld => {
                  const count = files.filter(f => f.folder_id === fld.id).length
                  return (
                    <div key={fld.id} onDoubleClick={() => setCwd(fld.id)} onClick={() => setCwd(fld.id)}
                      className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-white cursor-pointer hover:shadow-md transition-all"
                      style={{ borderColor: '#e2e8f0' }}>
                      <Folder size={40} style={{ color: '#f59e0b', fill: '#fde68a' }} />
                      <span className="text-sm font-medium text-slate-700 text-center truncate w-full">{fld.name}</span>
                      <span className="text-xs text-slate-400">{count} файла</span>
                      <button onClick={e => { e.stopPropagation(); deleteFolder(fld) }} title="Изтрий папка"
                        className="absolute top-1.5 right-1.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ФАЙЛОВЕ */}
            {filesHere.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filesHere.map(f => {
                  const kind = kindOf(f)
                  return (
                    <div key={f.id} className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-white hover:shadow-md transition-all" style={{ borderColor: '#e2e8f0' }}>
                      {f.is_shared && (
                        <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: 'rgba(15,34,64,0.08)', color: NAVY }}>
                          <Share2 size={9} /> Споделен
                        </span>
                      )}
                      <button onClick={e => { e.stopPropagation(); setMenuFor(menuFor === f.id ? null : f.id) }} className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-slate-100 text-slate-400">
                        <MoreVertical size={16} />
                      </button>
                      <div className="mt-2"><FileIcon kind={kind} big /></div>
                      {renaming === f.id ? (
                        <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onKeyDown={e => { if (e.key === 'Enter') saveRename(f); if (e.key === 'Escape') setRenaming(null) }}
                          className="w-full px-2 py-1 text-xs border rounded text-center" />
                      ) : (
                        <span className="text-xs font-medium text-slate-700 text-center break-words w-full line-clamp-2" title={f.name}>{f.name}</span>
                      )}
                      <span className="text-[10px] text-slate-400">{formatSize(f.size)}</span>

                      {menuFor === f.id && (
                        <div onClick={e => e.stopPropagation()} className="absolute top-8 right-1.5 z-10 w-44 bg-white rounded-lg shadow-lg border py-1 text-sm" style={{ borderColor: '#e2e8f0' }}>
                          <button onClick={() => download(f)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 text-slate-600"><Download size={15} /> Изтегли</button>
                          <button onClick={() => toggleShare(f)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 text-slate-600"><Share2 size={15} /> {f.is_shared ? 'Спри споделяне' : 'Сподели с колеги'}</button>
                          <button onClick={() => { setMoving(f.id); setMenuFor(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 text-slate-600"><Folder size={15} /> Премести в…</button>
                          <button onClick={() => { setRenaming(f.id); setRenameVal(f.name); setMenuFor(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 text-slate-600"><Pencil size={15} /> Преименувай</button>
                          <button onClick={() => remove(f)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-500"><Trash2 size={15} /> Изтрий</button>
                        </div>
                      )}

                      {moving === f.id && (
                        <div onClick={e => e.stopPropagation()} className="absolute inset-x-1 top-8 z-10 bg-white rounded-lg shadow-lg border p-2 text-xs" style={{ borderColor: '#e2e8f0' }}>
                          <div className="text-slate-400 px-1 pb-1">Премести в:</div>
                          <button onClick={() => moveTo(f, null)} className="w-full text-left px-2 py-1 rounded hover:bg-slate-100">Основна папка</button>
                          {folders.map(fld => (
                            <button key={fld.id} onClick={() => moveTo(f, fld.id)} className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 truncate">{fld.name}</button>
                          ))}
                          <button onClick={() => setMoving(null)} className="w-full text-left px-2 py-1 rounded text-slate-400 mt-1">Отказ</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
