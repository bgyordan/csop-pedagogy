'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { smartMatch } from '@/lib/search'
import { notify, confirmDialog } from '@/components/ui/Toast'
import { Upload, Loader2, Trash2, FileText, School, User, Check, Download, ArrowRight, Inbox, X } from 'lucide-react'

// ─── типове ───
type Row = { id: string; name: string; original_name: string | null; path: string; size: number | null; mime_type: string | null; created_at: string }
type Recent = { id: string; name: string; path: string; status: string; docType: string | null; filedAt: string; schoolId: string | null; studentId: string | null; where: string }
type SchoolOpt = { id: string; name: string; city: string | null }
type Kid = { id: string; name: string; schoolId: string | null }
type Dest = 'school' | 'student'

const BUCKET = 'school-files'
const ACCENT = '#0f2240'
// видовете — за училището в school_files.doc_type, за детето = student_attachments.doc_type (същите като в досието)
const TYPES: Record<Dest, { key: string; label: string }[]> = {
  school: [{ key: 'plan', label: 'Учебен план' }, { key: 'other', label: 'Друго (писмо, график…)' }],
  student: [{ key: 'eplr_order', label: 'Заповед ЕПЛР (от училището)' }, { key: 'other', label: 'Друг документ' }],
}
const TYPE_LABEL: Record<string, string> = { plan: 'Учебен план', eplr_order: 'Заповед ЕПЛР', other: 'Друго' }

const kindOf = (r: { mime_type: string | null; name: string; original_name?: string | null }) => {
  const n = (r.original_name || r.name || '').toLowerCase()
  if (r.mime_type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
  if ((r.mime_type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(n)) return 'image'
  return 'other'
}
const extOf = (n?: string | null) => (n || '').match(/\.[a-z0-9]{2,5}$/i)?.[0]?.toLowerCase() || ''
const safeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_')
const fmtSize = (b: number | null) => !b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`
const ddmm = (iso: string) => new Date(iso).toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Sofia' })

export default function ExchangeClient({ staffId, yearId, yearName, schools, kids, initialInbox, initialRecent }: {
  staffId: string; yearId: string | null; yearName: string
  schools: SchoolOpt[]; kids: Kid[]; initialInbox: Row[]; initialRecent: Recent[]
}) {
  const supabase = createClient()
  const [inbox, setInbox] = useState<Row[]>(initialInbox)
  const [recent, setRecent] = useState<Recent[]>(initialRecent)
  const [sel, setSel] = useState<string | null>(initialInbox[0]?.id ?? null)
  const [urls, setUrls] = useState<Record<string, string>>({})          // id → blob: адрес за преглед
  const blobs = useRef<Record<string, Blob>>({})
  const [uploading, setUploading] = useState(0)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // формата — „Къде“ и училището се запазват между файловете (често идват няколко от едно училище)
  const [dest, setDest] = useState<Dest>('school')
  const [schoolId, setSchoolId] = useState<string>('')
  const [studentId, setStudentId] = useState<string>('')
  const [docType, setDocType] = useState<string>('plan')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [busy, setBusy] = useState(false)

  const current = inbox.find(r => r.id === sel) || null
  const schoolById = useMemo(() => new Map(schools.map(s => [s.id, s])), [schools])
  const kid = kids.find(k => k.id === studentId) || null
  const kidSchool = kid?.schoolId ? schoolById.get(kid.schoolId) : undefined

  // ─── зареждане на файловете за преглед (лениво, веднъж) ───
  useEffect(() => {
    inbox.forEach(async r => {
      if (urls[r.id] || blobs.current[r.id]) return
      blobs.current[r.id] = new Blob()   // маркер „зарежда се“
      const { data } = await supabase.storage.from(BUCKET).download(r.path)
      if (!data) { delete blobs.current[r.id]; return }
      const typed = data.type ? data : new Blob([data], { type: r.mime_type || 'application/octet-stream' })
      blobs.current[r.id] = typed
      setUrls(u => ({ ...u, [r.id]: URL.createObjectURL(typed) }))
    })
  }, [inbox])
  useEffect(() => () => { Object.values(urls).forEach(u => URL.revokeObjectURL(u)) }, [])

  // ─── предложено име ───
  const suggested = useMemo(() => {
    const sch = dest === 'school' ? schoolById.get(schoolId) : kidSchool
    if (dest === 'school') {
      if (!sch) return ''
      return docType === 'plan' ? `Учебен план – ${sch.name}${yearName ? ` – ${yearName}` : ''}` : `${sch.name} – ${ddmm(new Date().toISOString())}`
    }
    if (!kid) return ''
    return docType === 'eplr_order' ? `Заповед ЕПЛР екип – ${kid.name}` : `${kid.name} – документ${sch ? ` от ${sch.name}` : ''}`
  }, [dest, schoolId, studentId, docType, yearName])
  useEffect(() => { if (!nameTouched) setName(suggested) }, [suggested, nameTouched])

  // нов избран файл → чисто дете и име; „Къде“, училището и видът остават
  useEffect(() => { setStudentId(''); setNameTouched(false); setName('') }, [sel])
  useEffect(() => { setDocType(TYPES[dest][0].key) }, [dest])

  // ─── качване в кутията ───
  async function upload(list: FileList | File[]) {
    const files = Array.from(list)
    setUploading(n => n + files.length)
    for (const file of files) {
      try {
        if (file.size > 25 * 1024 * 1024) { notify(`„${file.name}“ е над 25 MB`); continue }
        const path = `inbox/${Date.now()}_${safeName(file.name)}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
        if (error) { notify('Грешка при качване: ' + file.name); continue }
        const { data, error: e2 } = await supabase.from('school_files')
          .insert({ status: 'inbox', school_id: null, name: file.name, original_name: file.name, path, size: file.size, mime_type: file.type, uploaded_by: staffId })
          .select('id, name, original_name, path, size, mime_type, created_at').single()
        if (e2 || !data) { await supabase.storage.from(BUCKET).remove([path]); notify('Грешка при запис: ' + file.name); continue }
        blobs.current[data.id] = file
        setUrls(u => ({ ...u, [data.id]: URL.createObjectURL(file) }))
        setInbox(p => [...p, data as Row])
        setSel(s => s ?? data.id)
      } finally { setUploading(n => n - 1) }
    }
  }

  async function discard(r: Row) {
    if (!await confirmDialog(`Да изтрия ли „${r.original_name || r.name}“ от кутията?`)) return
    await supabase.storage.from(BUCKET).remove([r.path])
    await supabase.from('school_files').delete().eq('id', r.id)
    afterLeave(r.id)
  }

  // файлът напуска кутията → избира се следващият
  function afterLeave(id: string) {
    const idx = inbox.findIndex(x => x.id === id)
    const rest = inbox.filter(x => x.id !== id)
    setInbox(rest)
    setSel(rest[Math.min(idx, rest.length - 1)]?.id ?? null)
    if (urls[id]) URL.revokeObjectURL(urls[id])
    delete blobs.current[id]
  }

  // ─── „Отнеси“ ───
  async function file() {
    if (!current) return
    const ext = extOf(current.original_name || current.name)
    const base = name.trim()
    if (!base) { notify('Напиши име на документа'); return }
    const finalName = ext && !base.toLowerCase().endsWith(ext) ? base + ext : base
    const now = new Date().toISOString()
    setBusy(true)
    try {
      if (dest === 'school') {
        if (!schoolId) { notify('Избери училище'); return }
        const { error } = await supabase.from('school_files').update({
          status: 'filed', school_id: schoolId, doc_type: docType, name: finalName, academic_year_id: yearId, filed_at: now,
        }).eq('id', current.id)
        if (error) throw error
        setRecent(p => [{ id: current.id, name: finalName, path: current.path, status: 'filed', docType, filedAt: now, schoolId, studentId: null, where: schoolById.get(schoolId)?.name || '' }, ...p].slice(0, 20))
      } else {
        if (!studentId) { notify('Избери дете'); return }
        // файлът се мести в досието: student-dossiers + „Външни документи“ (student_attachments)
        let blob: Blob | undefined = blobs.current[current.id]
        if (!blob || blob.size === 0) {
          const { data } = await supabase.storage.from(BUCKET).download(current.path)
          blob = data || undefined
        }
        if (!blob) throw new Error('Файлът не може да се прочете')
        const newPath = `${studentId}/${Date.now()}_${safeName(current.original_name || current.name)}`
        const { error: upErr } = await supabase.storage.from('student-dossiers').upload(newPath, blob, { contentType: current.mime_type || undefined })
        if (upErr) throw upErr
        const { data: att, error: attErr } = await supabase.from('student_attachments').insert({
          student_id: studentId, file_name: finalName, file_path: newPath, file_size: current.size, doc_type: docType, uploaded_by: staffId, valid_until_year: null,
        }).select('id').single()
        if (attErr || !att) { await supabase.storage.from('student-dossiers').remove([newPath]); throw attErr || new Error('Грешка при запис в досието') }
        await supabase.storage.from(BUCKET).remove([current.path])
        // редът остава като следа „какво е разнесено“ (school_id празно — не излиза при училището)
        await supabase.from('school_files').update({
          status: 'to_student', school_id: null, student_id: studentId, doc_type: docType, name: finalName, path: newPath,
          academic_year_id: yearId, attachment_id: att.id, filed_at: now,
        }).eq('id', current.id)
        setRecent(p => [{ id: current.id, name: finalName, path: newPath, status: 'to_student', docType, filedAt: now, schoolId: null, studentId, where: kid?.name || '' }, ...p].slice(0, 20))
      }
      notify(`„${finalName}“ е отнесен`, 'success')
      afterLeave(current.id)
    } catch (e: any) {
      notify('Грешка: ' + (e?.message || 'неуспешно'))
    } finally { setBusy(false) }
  }

  async function downloadRecent(r: Recent) {
    const { data } = await supabase.storage.from(r.status === 'to_student' ? 'student-dossiers' : BUCKET).download(r.path)
    if (!data) { notify('Файлът не може да се изтегли'); return }
    const u = URL.createObjectURL(data)
    const a = document.createElement('a'); a.href = u; a.download = r.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u)
  }

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files) }
  const dropProps = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDrag(true) },
    onDragLeave: () => setDrag(false),
    onDrop,
  }
  const fileInput = <input ref={inputRef} type="file" multiple accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" className="hidden"
    onClick={e => e.stopPropagation()} onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = '' }} />

  // ─── празна кутия ───
  if (inbox.length === 0 && uploading === 0) {
    return (
      <div className="space-y-8">
        <div {...dropProps} onClick={() => inputRef.current?.click()}
          className={`rounded-3xl border-2 border-dashed cursor-pointer transition-colors py-16 px-6 text-center ${drag ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-white hover:border-sky-300 hover:bg-sky-50/40'}`}>
          <Inbox size={34} className="mx-auto text-sky-400 mb-3" strokeWidth={1.5} />
          <div className="text-slate-700 font-medium">Пусни тук файловете от имейла</div>
          <div className="text-sm text-slate-400 font-light mt-1">или натисни, за да ги избереш · PDF, снимки, Word · може няколко наведнъж</div>
          {fileInput}
        </div>
        <RecentList recent={recent} onDownload={downloadRecent} />
      </div>
    )
  }

  const types = TYPES[dest]
  const kind = current ? kindOf(current) : 'other'

  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)_340px] items-start">
        {/* ── КУТИЯТА: неразпределени ── */}
        <aside className="space-y-3 lg:sticky lg:top-4">
          <div {...dropProps} onClick={() => inputRef.current?.click()}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed cursor-pointer text-xs transition-colors ${drag ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-300 text-slate-500 hover:border-sky-300 hover:bg-white'}`}>
            {uploading > 0 ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading > 0 ? `Качване… (${uploading})` : 'Добави файлове'}
            {fileInput}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400 px-1">Неразпределени · {inbox.length}</div>
          <div className="space-y-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto pr-1">
            {inbox.map(r => {
              const k = kindOf(r); const u = urls[r.id]; const on = r.id === sel
              return (
                <button key={r.id} onClick={() => setSel(r.id)}
                  className={`w-full text-left rounded-2xl border bg-white overflow-hidden transition-all ${on ? 'border-sky-400 ring-4 ring-sky-100 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
                  <div className="h-32 bg-slate-50 relative overflow-hidden">
                    {!u ? <div className="absolute inset-0 grid place-items-center"><Loader2 size={16} className="animate-spin text-slate-300" /></div>
                      : k === 'pdf' ? <iframe src={`${u}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`} title="" tabIndex={-1} className="absolute inset-0 w-full h-[calc(100%+40px)] pointer-events-none border-0 bg-white" />
                      : k === 'image' ? <img src={u} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      : <div className="absolute inset-0 grid place-items-center text-slate-400"><FileText size={26} strokeWidth={1.4} /><span className="text-[11px] uppercase mt-1">{extOf(r.original_name || r.name).slice(1) || 'файл'}</span></div>}
                  </div>
                  <div className="px-3 py-2">
                    <div className="text-[12px] text-slate-700 truncate">{r.original_name || r.name}</div>
                    <div className="text-[10.5px] text-slate-400">{fmtSize(r.size)} · {ddmm(r.created_at)}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ── ПРЕГЛЕД ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[60vh] flex flex-col">
          {current ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 text-xs text-slate-500">
                <FileText size={14} className="text-slate-400" />
                <span className="truncate">{current.original_name || current.name}</span>
                <span className="ml-auto flex items-center gap-1">
                  {urls[current.id] && <a href={urls[current.id]} download={current.original_name || current.name} className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-[#0f2240]" title="Изтегли"><Download size={14} /></a>}
                  <button onClick={() => discard(current)} className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-600" title="Изтрий от кутията"><Trash2 size={14} /></button>
                </span>
              </div>
              <div className="flex-1 relative bg-slate-100/60">
                {!urls[current.id] ? <div className="absolute inset-0 grid place-items-center"><Loader2 className="animate-spin text-slate-300" /></div>
                  : kind === 'pdf' ? <iframe src={`${urls[current.id]}#view=FitH`} title="Преглед" className="absolute inset-0 w-full h-full border-0" />
                  : kind === 'image' ? <div className="absolute inset-0 overflow-auto p-4 grid place-items-start justify-center"><img src={urls[current.id]} alt="" className="max-w-full shadow-sm" /></div>
                  : <div className="absolute inset-0 grid place-items-center text-center px-6">
                      <div><FileText size={36} strokeWidth={1.3} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500">За този вид файл няма преглед.</p>
                        <a href={urls[current.id]} download={current.original_name || current.name} className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50"><Download size={14} /> Изтегли и отвори</a></div>
                    </div>}
              </div>
            </>
          ) : <div className="flex-1 grid place-items-center text-sm text-slate-400"><Loader2 className="animate-spin" /></div>}
        </section>

        {/* ── КЪДЕ ОТИВА ── */}
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-4 lg:sticky lg:top-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">Къде</div>
            <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1">
              {([['school', 'Училище', School], ['student', 'Дете', User]] as const).map(([k, lbl, Icon]) => (
                <button key={k} onClick={() => setDest(k)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-all ${dest === k ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Icon size={14} /> {lbl}
                </button>
              ))}
            </div>
          </div>

          {dest === 'school' ? (
            <Picker label="Училище" placeholder="Пиши част от името…" value={schoolId} onChange={setSchoolId}
              options={schools.map(s => ({ id: s.id, label: s.name, hint: s.city || '' }))} />
          ) : (
            <>
              <Picker label="Дете" placeholder="Пиши име…" value={studentId} onChange={setStudentId}
                options={kids.map(k => ({ id: k.id, label: k.name, hint: k.schoolId ? schoolById.get(k.schoolId)?.name || '' : '' }))} />
              {kid && <div className="text-[12px] text-slate-500 -mt-2">Училище: {kidSchool?.name || <span className="text-amber-600">не е посочено в досието</span>}</div>}
            </>
          )}

          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">Вид</div>
            <div className="flex flex-wrap gap-1.5">
              {types.map(t => (
                <button key={t.key} onClick={() => setDocType(t.key)}
                  className={`px-3 py-1.5 rounded-full text-[12.5px] border transition-colors ${docType === t.key ? 'border-[#0f2240] bg-[#0f2240] text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">Име на документа</div>
            <input value={name} onChange={e => { setName(e.target.value); setNameTouched(true) }}
              placeholder={dest === 'school' ? 'избери училище — името се попълва само' : 'избери дете — името се попълва само'}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-slate-400" />
            {nameTouched && suggested && name !== suggested && (
              <button onClick={() => { setNameTouched(false) }} className="text-[11px] text-sky-600 hover:underline mt-1">върни предложеното</button>
            )}
          </div>

          <button onClick={file} disabled={busy || !current || (dest === 'school' ? !schoolId : !studentId) || !name.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: ACCENT }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Отнеси
          </button>
          <p className="text-[11.5px] text-slate-400 font-light leading-relaxed">
            {dest === 'school'
              ? 'Отива при училището (Администрация → Училища) и в „Училищни учебни планове“ на класните.'
              : 'Отива в досието на детето → „Външни документи“.'}
          </p>
        </aside>
      </div>

      <RecentList recent={recent} onDownload={downloadRecent} />
    </div>
  )
}

// ─── избор с търсене (училище / дете) ───
function Picker({ label, placeholder, value, onChange, options }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void
  options: { id: string; label: string; hint: string }[]
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const chosen = options.find(o => o.id === value)
  const list = useMemo(() => options.filter(o => smartMatch(`${o.label} ${o.hint}`, q)).slice(0, 40), [options, q])
  return (
    <div className="relative">
      <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">{label}</div>
      {chosen && !open ? (
        <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-slate-800 truncate">{chosen.label}</div>
            {chosen.hint && <div className="text-[11px] text-slate-400 truncate">{chosen.hint}</div>}
          </div>
          <button onClick={() => { onChange(''); setQ(''); setOpen(true) }} className="p-1 rounded text-slate-400 hover:text-slate-700" title="Смени"><X size={14} /></button>
        </div>
      ) : (
        <>
          <input autoFocus={open} value={q} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-slate-400" />
          {open && (
            <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {list.length === 0 ? <div className="px-3 py-3 text-xs text-slate-400">Няма съвпадение</div> : list.map(o => (
                <button key={o.id} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(o.id); setOpen(false); setQ('') }}
                  className="w-full text-left px-3 py-2 hover:bg-sky-50">
                  <div className="text-sm text-slate-700">{o.label}</div>
                  {o.hint && <div className="text-[11px] text-slate-400">{o.hint}</div>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── последно разнесени ───
function RecentList({ recent, onDownload }: { recent: Recent[]; onDownload: (r: Recent) => void }) {
  if (recent.length === 0) return null
  return (
    <section>
      <h2 className="text-sm font-medium text-slate-600 mb-2.5">Последно разнесени</h2>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {recent.map((r, i) => (
          <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i % 2 ? 'bg-slate-50/50' : ''}`}>
            <span className="text-[12px] text-slate-400 w-20 shrink-0 tabular-nums">{ddmm(r.filedAt)}</span>
            <button onClick={() => onDownload(r)} className="min-w-0 flex-1 text-left text-slate-700 truncate hover:underline" title="Изтегли">{r.name}</button>
            <span className="hidden md:inline text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">{TYPE_LABEL[r.docType || ''] || '—'}</span>
            <span className="flex items-center gap-1 text-[12.5px] text-slate-500 shrink-0 max-w-[40%]">
              <ArrowRight size={12} className="text-slate-300" />
              {r.status === 'to_student' && r.studentId
                ? <Link href={`/students/${r.studentId}`} className="truncate hover:underline text-[#0f2240]"><User size={12} className="inline -mt-0.5 mr-1" />{r.where}</Link>
                : <span className="truncate"><School size={12} className="inline -mt-0.5 mr-1" />{r.where}</span>}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
