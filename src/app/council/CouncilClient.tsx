'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarClock, Upload, Download, Trash2, Loader2, FileText, Plus, X, Archive, ArchiveRestore, Pencil, Check, ChevronDown, ChevronUp } from 'lucide-react'

type File = { id: string; name: string; description: string | null; path: string; size: number | null }
type Group = { id: string; title: string; eventDate: string | null; isArchived: boolean; files: File[] }

function fmtDate(d: string | null) { return d ? d.split('-').reverse().join('.') : '' }
function fmtSize(b: number | null) { if (!b) return ''; if (b < 1024) return `${b} B`; if (b < 1048576) return `${Math.round(b/1024)} KB`; return `${(b/1048576).toFixed(1)} MB` }
// предложение за описание от името на файла
function suggestDesc(filename: string): string {
  let n = filename.replace(/\.[a-z0-9]+$/i, '')       // маха разширението
  n = n.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return n.charAt(0).toUpperCase() + n.slice(1)
}

export default function CouncilClient({ groups: initial, canManage }: { groups: Group[]; canManage: boolean }) {
  const supabase = createClient()
  const [groups, setGroups] = useState<Group[]>(initial)
  const [openId, setOpenId] = useState<string | null>(initial.find(g => !g.isArchived)?.id || null)

  // нов комплект
  const [showNew, setShowNew] = useState(false)
  const [nTitle, setNTitle] = useState('Педагогически съвет')
  const [nDate, setNDate] = useState('')
  const [savingSet, setSavingSet] = useState(false)

  // качване
  const [uploadingTo, setUploadingTo] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingSet = useRef<string | null>(null)

  // редакция описание
  const [editFile, setEditFile] = useState<string | null>(null)
  const [editDesc, setEditDesc] = useState('')

  async function createSet() {
    if (!nTitle.trim()) return
    setSavingSet(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('staff_profiles').select('id').eq('user_id', user?.id!).single()
    const { data, error } = await supabase.from('council_sets')
      .insert({ title: nTitle.trim(), event_date: nDate || null, created_by: prof?.id })
      .select('id, title, event_date, is_archived').single()
    setSavingSet(false)
    if (error || !data) return
    const g: Group = { id: data.id, title: data.title, eventDate: data.event_date, isArchived: false, files: [] }
    setGroups(prev => [g, ...prev]); setOpenId(g.id); setShowNew(false); setNTitle('Педагогически съвет'); setNDate('')
  }

  function triggerUpload(setId: string) { pendingSet.current = setId; fileRef.current?.click() }

  async function onFiles(list: FileList) {
    const setId = pendingSet.current; if (!setId) return
    setUploadingTo(setId)
    const added: File[] = []
    for (const file of Array.from(list)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
      const path = `${setId}/${Date.now()}_${safe}`
      const { error } = await supabase.storage.from('council-materials').upload(path, file)
      if (error) { alert('Грешка при качване: ' + file.name); continue }
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('staff_profiles').select('id').eq('user_id', user?.id!).single()
      const { data } = await supabase.from('council_files')
        .insert({ set_id: setId, name: file.name, description: suggestDesc(file.name), path, size: file.size, mime_type: file.type, uploaded_by: prof?.id })
        .select('id, name, description, path, size').single()
      if (data) added.push(data as File)
    }
    setGroups(prev => prev.map(g => g.id === setId ? { ...g, files: [...g.files, ...added] } : g))
    setUploadingTo(null); pendingSet.current = null
  }

  async function download(f: File) {
    const { data, error } = await supabase.storage.from('council-materials').download(f.path)
    if (error || !data) return
    const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = f.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }
  async function delFile(setId: string, f: File) {
    if (!confirm(`Изтрий „${f.description || f.name}"?`)) return
    await supabase.storage.from('council-materials').remove([f.path])
    await supabase.from('council_files').delete().eq('id', f.id)
    setGroups(prev => prev.map(g => g.id === setId ? { ...g, files: g.files.filter(x => x.id !== f.id) } : g))
  }
  async function saveDesc(setId: string, fileId: string) {
    await supabase.from('council_files').update({ description: editDesc }).eq('id', fileId)
    setGroups(prev => prev.map(g => g.id === setId ? { ...g, files: g.files.map(x => x.id === fileId ? { ...x, description: editDesc } : x) } : g))
    setEditFile(null)
  }
  async function toggleArchive(g: Group) {
    await supabase.from('council_sets').update({ is_archived: !g.isArchived }).eq('id', g.id)
    setGroups(prev => prev.map(x => x.id === g.id ? { ...x, isArchived: !x.isArchived } : x))
  }
  async function delSet(g: Group) {
    if (!confirm(`Изтрий целия комплект „${g.title}" и файловете му?`)) return
    for (const f of g.files) await supabase.storage.from('council-materials').remove([f.path])
    await supabase.from('council_sets').delete().eq('id', g.id)
    setGroups(prev => prev.filter(x => x.id !== g.id))
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-4">
      {canManage && (
        <div>
          {!showNew ? (
            <button onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
              <Plus size={16} /> Нов комплект
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-800">Нов комплект материали</h3>
                <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={nTitle} onChange={e => setNTitle(e.target.value)} placeholder="Заглавие (напр. Педагогически съвет)"
                  className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
                <input type="date" value={nDate} onChange={e => setNDate(e.target.value)}
                  className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-slate-400" />
                <button onClick={createSet} disabled={savingSet || !nTitle.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                  {savingSet ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Създай
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = '' }} />

      {groups.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center text-sm text-slate-400">Няма материали.</div>
      ) : groups.map(g => {
        const open = openId === g.id
        const past = g.eventDate && g.eventDate < today
        return (
          <div key={g.id} className={`bg-white rounded-2xl border shadow-[0_1px_4px_rgba(15,34,64,0.06)] overflow-hidden transition-all ${
            g.isArchived ? 'border-slate-200 opacity-70' : open ? 'border-[#0f2240]' : 'border-slate-200 hover:border-slate-300'
          }`}>
            <button onClick={() => setOpenId(open ? null : g.id)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${g.isArchived ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                <CalendarClock size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800">{g.title}</span>
                  {g.eventDate && <span className="text-xs text-slate-500">· {fmtDate(g.eventDate)}</span>}
                  {g.isArchived && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">архивиран</span>}
                  {!g.isArchived && past && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">приключил</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{g.files.length} {g.files.length === 1 ? 'файл' : 'файла'}</div>
              </div>
              {open ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-300 shrink-0" />}
            </button>

            {open && (
              <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
                {g.files.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">Няма качени файлове.</p>
                ) : g.files.map((f, fi) => (
                  <div key={f.id}
                    onClick={() => editFile !== f.id && download(f)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 group transition-all ${editFile === f.id ? 'bg-white' : 'cursor-pointer hover:border-blue-300 hover:shadow-[0_2px_10px_rgba(15,34,64,0.10)] hover:-translate-y-0.5'} ${fi % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-500 shrink-0"><FileText size={16} /></span>
                    <div className="min-w-0 flex-1">
                      {editFile === f.id ? (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <input value={editDesc} onChange={e => setEditDesc(e.target.value)} autoFocus
                            className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none" />
                          <button onClick={() => saveDesc(g.id, f.id)} className="text-emerald-600 hover:text-emerald-700"><Check size={15} /></button>
                          <button onClick={() => setEditFile(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-slate-800 truncate group-hover:text-[#0f2240]">{f.description || f.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{f.name} · {fmtSize(f.size)}</div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                      {editFile !== f.id && canManage && (
                        <button onClick={() => { setEditFile(f.id); setEditDesc(f.description || '') }} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] opacity-0 group-hover:opacity-100" title="Редактирай описанието"><Pencil size={13} /></button>
                      )}
                      <button onClick={() => download(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0f2240] hover:bg-slate-100" title="Изтегли"><Download size={15} /></button>
                      {canManage && <button onClick={() => delFile(g.id, f)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100" title="Изтрий"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                ))}

                {canManage && (
                  <div className="flex items-center gap-2 pt-2 flex-wrap">
                    <button onClick={() => triggerUpload(g.id)} disabled={uploadingTo === g.id}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400 hover:bg-slate-50 disabled:opacity-50">
                      {uploadingTo === g.id ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                      {uploadingTo === g.id ? 'Качване…' : 'Качи файл(ове)'}
                    </button>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button onClick={() => toggleArchive(g)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100">
                        {g.isArchived ? <><ArchiveRestore size={13} /> Възстанови</> : <><Archive size={13} /> Архивирай</>}
                      </button>
                      <button onClick={() => delSet(g)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Изтрий комплекта"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
