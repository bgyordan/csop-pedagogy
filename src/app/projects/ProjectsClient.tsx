'use client'
import { useState, useRef, useLayoutEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lightbulb, Plus, Pencil, Trash2, X, Check, Loader2, CalendarRange, Users } from 'lucide-react'

interface Cls { id: string; name: string }
interface Project {
  id: string; title: string; ideas: string | null; activities: string | null; goals: string | null
  period_from: string | null; period_to: string | null; status: string; created_by: string | null; classIds: string[]
}
interface Props {
  meId: string; isManager: boolean; myClassIds: string[]
  classes: Cls[]; projects: Project[]; academicYearId: string | null; yearName: string
}

const STATUS: { key: string; label: string; cls: string }[] = [
  { key: 'idea',        label: 'Идея',     cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  { key: 'in_progress', label: 'В ход',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'done',        label: 'Завършен', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
]
const statusMeta = (k: string) => STATUS.find(s => s.key === k) || STATUS[0]
const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('bg-BG') : ''

// Учебна година: септ → юни
const SCHOOL_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
const MONTH_LABEL: Record<number, string> = { 9: 'Септември', 10: 'Октомври', 11: 'Ноември', 12: 'Декември', 1: 'Януари', 2: 'Февруари', 3: 'Март', 4: 'Април', 5: 'Май', 6: 'Юни' }
const pad = (n: number) => String(n).padStart(2, '0')
const orderIdx = (m: number) => SCHOOL_MONTHS.indexOf(m)
const monthOfISO = (iso: string | null) => iso ? parseInt(iso.slice(5, 7)) : null

function AutoTextarea({ value, onChange, placeholder, minRows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }, [value])
  return (
    <textarea ref={ref} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={minRows}
      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 resize-none overflow-hidden" />
  )
}

const empty = (myClassIds: string[]): Project => ({
  id: '', title: '', ideas: '', activities: '', goals: '', period_from: null, period_to: null,
  status: 'idea', created_by: null, classIds: [...myClassIds],
})

export default function ProjectsClient({ meId, isManager, myClassIds, classes, projects, academicYearId, yearName }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [list, setList] = useState<Project[]>(projects)
  const [editing, setEditing] = useState<Project | null>(null)
  const [saving, setSaving] = useState(false)
  const [onlyMine, setOnlyMine] = useState<boolean>(!isManager && myClassIds.length > 0)

  // Месец → дата (първо/последно число), за да пазим в period_from/period_to без миграция
  const startYear = parseInt((yearName || '').split(/[-/]/)[0]) || new Date().getFullYear()
  const monthYear = (m: number) => m >= 9 ? startYear : startYear + 1
  const fromISOofMonth = (m: number) => `${monthYear(m)}-${pad(m)}-01`
  const toISOofMonth = (m: number) => { const y = monthYear(m); const last = new Date(y, m, 0).getDate(); return `${y}-${pad(m)}-${pad(last)}` }
  const setFromMonth = (m: number | null) => setEditing(prev => {
    if (!prev) return prev
    if (!m) return { ...prev, period_from: null }
    let period_to = prev.period_to
    const tm = monthOfISO(period_to)
    if (tm && orderIdx(tm) < orderIdx(m)) period_to = toISOofMonth(m)
    return { ...prev, period_from: fromISOofMonth(m), period_to }
  })
  const setToMonth = (m: number | null) => setEditing(prev => prev ? { ...prev, period_to: m ? toISOofMonth(m) : null } : prev)

  const nameById: Record<string, string> = {}
  classes.forEach(c => { nameById[c.id] = c.name })

  const canCreate = isManager || myClassIds.length > 0
  const canEdit = (p: Project) => isManager || p.classIds.some(id => myClassIds.includes(id))

  const shown = list.filter(p => !onlyMine || p.classIds.some(id => myClassIds.includes(id)))

  function toggleClass(id: string) {
    if (!editing) return
    setEditing({ ...editing, classIds: editing.classIds.includes(id) ? editing.classIds.filter(x => x !== id) : [...editing.classIds, id] })
  }

  async function save() {
    if (!editing || !editing.title.trim() || editing.classIds.length === 0) return
    setSaving(true)
    const payload = {
      title: editing.title.trim(),
      ideas: editing.ideas?.trim() || null,
      activities: editing.activities?.trim() || null,
      goals: editing.goals?.trim() || null,
      period_from: editing.period_from || null,
      period_to: editing.period_to || null,
      status: editing.status,
      academic_year_id: academicYearId,
    }
    let projectId = editing.id
    if (editing.id) {
      await supabase.from('class_projects').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      await supabase.from('class_project_classes').delete().eq('project_id', editing.id)
    } else {
      const { data, error } = await supabase.from('class_projects').insert({ ...payload, created_by: meId }).select('id').single()
      if (error || !data) { setSaving(false); alert('Грешка при запис: ' + (error?.message || '')); return }
      projectId = data.id
    }
    if (editing.classIds.length) {
      await supabase.from('class_project_classes').insert(editing.classIds.map(cid => ({ project_id: projectId, class_id: cid })))
    }
    const saved: Project = { ...editing, id: projectId, created_by: editing.created_by || meId }
    setList(prev => editing.id ? prev.map(p => p.id === projectId ? saved : p) : [saved, ...prev])
    setSaving(false)
    setEditing(null)
    router.refresh()
  }

  async function remove(p: Project) {
    if (!confirm(`Изтриване на проекта „${p.title}"?`)) return
    await supabase.from('class_projects').delete().eq('id', p.id)
    setList(prev => prev.filter(x => x.id !== p.id))
    router.refresh()
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><Lightbulb size={20} className="text-white" /></div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Проекти на паралелките</h1>
            <p className="text-slate-500 text-sm mt-0.5">{yearName}</p>
          </div>
        </div>
        {canCreate && (
          <button onClick={() => setEditing(empty(myClassIds))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
            <Plus size={16} /> Нов проект
          </button>
        )}
      </div>

      {!isManager && myClassIds.length > 0 && (
        <label className="inline-flex items-center gap-2 mb-4 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} className="rounded border-slate-300" />
          Само моите паралелки
        </label>
      )}

      {shown.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <Lightbulb size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Още няма проекти</p>
          {canCreate && <p className="text-xs text-slate-400 mt-1">Натисни „Нов проект", за да добавиш.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(p => {
            const sm = statusMeta(p.status)
            const fm = monthOfISO(p.period_from), tm = monthOfISO(p.period_to)
            const period = fm && tm ? (fm === tm ? MONTH_LABEL[fm] : `${MONTH_LABEL[fm]} – ${MONTH_LABEL[tm]}`) : fm ? MONTH_LABEL[fm] : tm ? MONTH_LABEL[tm] : ''
            return (
              <div key={p.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{p.title}</h3>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${sm.cls}`}>{sm.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Users size={12} /> {p.classIds.map(id => nameById[id] || '?').join(', ')}</span>
                      {period && <span className="inline-flex items-center gap-1"><CalendarRange size={12} /> {period}</span>}
                    </div>
                  </div>
                  {canEdit(p) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditing({ ...p, ideas: p.ideas || '', activities: p.activities || '', goals: p.goals || '' })}
                        className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors" title="Редактирай"><Pencil size={14} /></button>
                      <button onClick={() => remove(p)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors" title="Изтрий"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                {(p.ideas || p.activities || p.goals) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
                    {[['Основни идеи', p.ideas], ['Дейности', p.activities], ['Цели / резултати', p.goals]].map(([label, val]) => val ? (
                      <div key={label as string}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
                        <div className="text-sm text-slate-600 whitespace-pre-wrap">{val}</div>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="font-semibold text-slate-800">{editing.id ? 'Редакция на проект' : 'Нов проект'}</h2>
              <button onClick={() => !saving && setEditing(null)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Тема *</label>
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Паралелки *</label>
                <div className="flex flex-wrap gap-1.5">
                  {classes.map(c => {
                    const on = editing.classIds.includes(c.id)
                    return (
                      <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${on ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">От месец</label>
                  <select value={monthOfISO(editing.period_from) ?? ''} onChange={e => setFromMonth(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-slate-300">
                    <option value="">—</option>
                    {SCHOOL_MONTHS.map(m => <option key={m} value={m}>{MONTH_LABEL[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">До месец</label>
                  <select value={monthOfISO(editing.period_to) ?? ''} disabled={!editing.period_from}
                    onChange={e => setToMonth(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-slate-300 disabled:bg-slate-50 disabled:text-slate-400">
                    <option value="">—</option>
                    {SCHOOL_MONTHS.filter(m => { const fmv = monthOfISO(editing.period_from); return !fmv || orderIdx(m) >= orderIdx(fmv) }).map(m => <option key={m} value={m}>{MONTH_LABEL[m]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Статус</label>
                <div className="flex gap-1.5">
                  {STATUS.map(s => (
                    <button key={s.key} type="button" onClick={() => setEditing({ ...editing, status: s.key })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${editing.status === s.key ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Основни идеи</label>
                <AutoTextarea value={editing.ideas || ''} onChange={v => setEditing({ ...editing, ideas: v })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Дейности</label>
                <AutoTextarea value={editing.activities || ''} onChange={v => setEditing({ ...editing, activities: v })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Цели / очаквани резултати</label>
                <AutoTextarea value={editing.goals || ''} onChange={v => setEditing({ ...editing, goals: v })} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setEditing(null)} disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50">Отказ</button>
              <button onClick={save} disabled={saving || !editing.title.trim() || editing.classIds.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запази
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
