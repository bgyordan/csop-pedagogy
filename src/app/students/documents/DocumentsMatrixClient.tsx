'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, ShieldAlert, ShieldX, Minus, ChevronDown, ChevronRight, X, Upload, Loader2, Download, Trash2, Plus } from 'lucide-react'

interface DocInfo {
  id: string | null
  valid_until_year: string | null
  file_name: string | null
  file_path: string | null
}

interface StudentRow {
  id: string
  name: string
  docs: Record<string, DocInfo | undefined>
}

interface ClassGroup {
  classId: string
  className: string
  students: StudentRow[]
}

interface DocType {
  key: string
  label: string
}

interface Props {
  classes: ClassGroup[]
  docTypes: DocType[]
  currentYearName: string
  yearOptions: string[]
  canManage: boolean
  staffId: string
}

function compareYears(a: string, b: string): number {
  return parseInt(a.split('/')[0]) - parseInt(b.split('/')[0])
}

function statusOf(doc: DocInfo | undefined, currentYear: string): 'valid' | 'expiring' | 'expired' | 'missing' | 'permanent' {
  if (!doc) return 'missing'
  const val = doc.valid_until_year
  if (!val) return 'permanent'
  const cmp = compareYears(val, currentYear)
  if (cmp < 0) return 'expired'
  if (cmp === 0) return 'expiring'
  return 'valid'
}

const STATUS_CFG = {
  valid: { icon: <ShieldCheck size={16} />, cls: 'text-emerald-600 hover:bg-emerald-50', title: 'Валиден' },
  expiring: { icon: <ShieldAlert size={16} />, cls: 'text-amber-600 hover:bg-amber-50', title: 'Изтича тази година' },
  expired: { icon: <ShieldX size={16} />, cls: 'text-red-600 hover:bg-red-50', title: 'Изтекъл' },
  permanent: { icon: <ShieldCheck size={16} />, cls: 'text-slate-400 hover:bg-slate-50', title: 'Безсрочен' },
  missing: { icon: <Plus size={14} />, cls: 'text-slate-200 hover:text-slate-400 hover:bg-slate-50', title: 'Липсва — добави' },
}

export default function DocumentsMatrixClient({ classes: initialClasses, docTypes, currentYearName, yearOptions, canManage, staffId }: Props) {
  const supabase = createClient()
  const [classes, setClasses] = useState(initialClasses)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [cell, setCell] = useState<{ studentId: string; studentName: string; docType: DocType; doc: DocInfo | undefined } | null>(null)

  function toggle(classId: string) {
    setCollapsed(prev => ({ ...prev, [classId]: !prev[classId] }))
  }

  function updateLocalDoc(studentId: string, docKey: string, newDoc: DocInfo | undefined) {
    setClasses(prev => prev.map(cls => ({
      ...cls,
      students: cls.students.map(s =>
        s.id === studentId ? { ...s, docs: { ...s.docs, [docKey]: newDoc } } : s
      ),
    })))
  }

  let expiredCount = 0, expiringCount = 0
  classes.forEach(c => c.students.forEach(s => {
    docTypes.forEach(dt => {
      const st = statusOf(s.docs[dt.key], currentYearName)
      if (st === 'expired') expiredCount++
      if (st === 'expiring') expiringCount++
    })
  }))

  if (classes.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
        <p className="text-slate-400 text-sm">Няма ученици за показване</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Легенда + статистика */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-slate-600"><ShieldCheck size={14} className="text-emerald-600" /> Валиден</span>
          <span className="flex items-center gap-1.5 text-slate-600"><ShieldAlert size={14} className="text-amber-600" /> Изтича</span>
          <span className="flex items-center gap-1.5 text-slate-600"><ShieldX size={14} className="text-red-600" /> Изтекъл</span>
          <span className="flex items-center gap-1.5 text-slate-600"><Plus size={14} className="text-slate-300" /> Липсва</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {expiredCount > 0 && <span className="font-medium text-red-600">{expiredCount} изтекли</span>}
          {expiringCount > 0 && <span className="font-medium text-amber-600">{expiringCount} изтичащи</span>}
          {canManage && <span className="text-slate-400">· Клик на клетка за качване</span>}
        </div>
      </div>

      {/* Таблици по паралелки */}
      {classes.map(cls => {
        const isCollapsed = collapsed[cls.classId]
        return (
          <div key={cls.classId} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <button onClick={() => toggle(cls.classId)}
              className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2">
                {isCollapsed ? <ChevronRight size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                <span className="text-sm font-medium text-slate-700">Паралелка {cls.className}</span>
              </div>
              <span className="text-xs text-slate-400">{cls.students.length} ученика</span>
            </button>

            {!isCollapsed && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">Ученик</th>
                      {docTypes.map(dt => (
                        <th key={dt.key} className="px-2 py-2.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 text-center whitespace-nowrap" title={dt.label}>
                          {dt.label.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {cls.students.map(student => (
                      <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-2 max-w-[200px]">
                          <Link href={`/students/${student.id}`} className="text-sm text-slate-700 hover:text-[#0f2240] hover:underline truncate block">
                            {student.name}
                          </Link>
                        </td>
                        {docTypes.map(dt => {
                          const doc = student.docs[dt.key]
                          const st = statusOf(doc, currentYearName)
                          const cfg = STATUS_CFG[st]
                          return (
                            <td key={dt.key} className="px-2 py-2 text-center">
                              <button
                                onClick={() => canManage && setCell({ studentId: student.id, studentName: student.name, docType: dt, doc })}
                                disabled={!canManage}
                                className={`inline-flex p-1.5 rounded-lg transition-colors ${cfg.cls} ${canManage ? 'cursor-pointer' : 'cursor-default'}`}
                                title={`${dt.label}: ${cfg.title}`}>
                                {cfg.icon}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {/* Модал за клетка */}
      {cell && (
        <CellModal
          cell={cell}
          yearOptions={yearOptions}
          currentYearName={currentYearName}
          staffId={staffId}
          onClose={() => setCell(null)}
          onUpdate={(newDoc) => {
            updateLocalDoc(cell.studentId, cell.docType.key, newDoc)
            setCell(null)
          }}
        />
      )}
    </div>
  )
}

// ── Модал за качване/редакция ──
function CellModal({ cell, yearOptions, currentYearName, staffId, onClose, onUpdate }: {
  cell: { studentId: string; studentName: string; docType: DocType; doc: DocInfo | undefined }
  yearOptions: string[]
  currentYearName: string
  staffId: string
  onClose: () => void
  onUpdate: (doc: DocInfo | undefined) => void
}) {
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)
  const [validUntil, setValidUntil] = useState(cell.doc?.valid_until_year || '')
  const [saving, setSaving] = useState(false)

  const hasDoc = !!cell.doc?.id

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext || '')) { alert('Само PDF и Word'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Макс. 10MB'); return }

    setUploading(true)
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
    const filePath = `${cell.studentId}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('student-dossiers').upload(filePath, file)
    if (upErr) { alert('Грешка при качване'); setUploading(false); return }

    const { data, error } = await supabase.from('student_attachments').insert({
      student_id: cell.studentId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      doc_type: cell.docType.key,
      uploaded_by: staffId,
      valid_until_year: validUntil || null,
    }).select().single()

    if (error) { alert('Грешка при запис'); setUploading(false); return }
    setUploading(false)
    onUpdate({ id: data.id, valid_until_year: data.valid_until_year, file_name: data.file_name, file_path: data.file_path })
  }

  async function handleSaveValidity() {
    if (!cell.doc?.id) return
    setSaving(true)
    await supabase.from('student_attachments').update({ valid_until_year: validUntil || null }).eq('id', cell.doc.id)
    setSaving(false)
    onUpdate({ ...cell.doc, valid_until_year: validUntil || null })
  }

  async function handleDownload() {
    if (!cell.doc?.file_path) return
    const { data } = await supabase.storage.from('student-dossiers').createSignedUrl(cell.doc.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete() {
    if (!cell.doc?.id || !cell.doc?.file_path) return
    if (!confirm('Изтриване на документа?')) return
    await supabase.storage.from('student-dossiers').remove([cell.doc.file_path])
    await supabase.from('student_attachments').delete().eq('id', cell.doc.id)
    onUpdate(undefined)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl border border-slate-200/80 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-medium text-slate-800 text-sm">{cell.docType.label}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{cell.studentName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Валидност */}
          <div>
            <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Валиден до учебна година</label>
            <select value={validUntil} onChange={e => setValidUntil(e.target.value)} className="input w-full text-sm">
              <option value="">Безсрочен</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {hasDoc ? (
            <>
              {/* Съществуващ файл */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-700 truncate">{cell.doc!.file_name}</div>
                </div>
                <button onClick={handleDownload} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-white"><Download size={14} /></button>
                <button onClick={handleDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white"><Trash2 size={14} /></button>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium">Затвори</button>
                <button onClick={handleSaveValidity} disabled={saving}
                  className="px-4 py-2 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 disabled:opacity-60"
                  style={{ backgroundColor: '#0f2240' }}>
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  Запази валидност
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <label className="flex items-center justify-center gap-2 h-10 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#0f2240] hover:bg-slate-50 transition-all text-slate-400">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  <span className="text-xs font-medium">{uploading ? 'Качване...' : 'Замени с нов файл'}</span>
                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>
            </>
          ) : (
            /* Качване на нов */
            <label className="flex items-center justify-center gap-2 h-11 rounded-xl cursor-pointer text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#0f2240' }}>
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              <span className="text-sm font-medium">{uploading ? 'Качване...' : 'Прикачи файл (PDF/Word)'}</span>
              <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
