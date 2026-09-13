'use client'
import { useState, useRef, useLayoutEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Lightbulb, Plus, Pencil, Trash2, X, Check, Loader2, CalendarRange, Users, Target, CheckCircle2 } from 'lucide-react'

interface Cls { id: string; name: string }
interface Project {
  id: string; title: string; ideas: string | null; activities: string | null; goals: string | null
  period_from: string | null; period_to: string | null; status: string; created_by: string | null; classIds: string[]
}
interface Props {
  meId: string; isManager: boolean; myClassIds: string[]
  classes: Cls[]; projects: Project[]; academicYearId: string | null; yearName: string
}

const STATUS: { key: string; label: string; cls: string; dot: string }[] = [
  { key: 'idea',        label: 'Идея',     cls: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  { key: 'in_progress', label: 'В ход',    cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  { key: 'done',        label: 'Завършен', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
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
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 resize-none overflow-hidden placeholder:text-slate-400" />
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
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 bg-slate-50/30 min-h-screen">
      
      {/* Заглавка */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl shadow-inner" style={{ backgroundColor: '#0f2240' }}>
            <Lightbulb size={26} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Проекти на паралелките</h1>
            <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{yearName}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              Проектни дейности и инициативи
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-4">
          {!isManager && myClassIds.length > 0 && (
            <label className="flex items-center gap-2.5 text-sm font-bold text-slate-600 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors">
              <div className="relative flex items-center">
                <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} className="peer appearance-none w-5 h-5 border-2 border-slate-300 rounded-md checked:bg-[#0f2240] checked:border-[#0f2240] transition-colors cursor-pointer" />
                <Check size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth={3} />
              </div>
              Само моите паралелки
            </label>
          )}

          {canCreate && (
            <button onClick={() => setEditing(empty(myClassIds))}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98] w-full sm:w-auto" style={{ backgroundColor: '#0f2240' }}>
              <Plus size={18} /> Нов проект
            </button>
          )}
        </div>
      </div>

      {/* Списък */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="bg-white p-5 rounded-full shadow-sm mb-5"><Lightbulb size={36} className="text-slate-300" /></div>
          <p className="text-lg font-bold text-slate-700">Още няма проекти</p>
          {canCreate && <p className="text-sm text-slate-500 mt-1 max-w-sm text-center">Натиснете бутона „Нов проект“, за да добавите първата инициатива за паралелката.</p>}
        </div>
      ) : (
        <div className="grid gap-4">
          {shown.map(p => {
            const sm = statusMeta(p.status)
            const fm = monthOfISO(p.period_from), tm = monthOfISO(p.period_to)
            const period = fm && tm ? (fm === tm ? MONTH_LABEL[fm] : `${MONTH_LABEL[fm]} – ${MONTH_LABEL[tm]}`) : fm ? MONTH_LABEL[fm] : tm ? MONTH_LABEL[tm] : ''
            
            return (
              <div key={p.id} className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 overflow-hidden relative">
                {/* Цветна лента според статуса */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${sm.dot}`}></div>
                
                <div className="p-5 sm:p-6 pl-7">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <h3 className="text-lg font-extrabold text-slate-800">{p.title}</h3>
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${sm.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`}></span>
                          {sm.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 text-[13px] font-medium text-slate-600 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                          <Users size={14} className="text-slate-400" /> 
                          {p.classIds.map(id => nameById[id] || '?').join(', ')}
                        </span>
                        {period && (
                          <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                            <CalendarRange size={14} className="text-slate-400" /> 
                            {period}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {canEdit(p) && (
                      <div className="flex items-center gap-1.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-slate-50 md:bg-transparent p-1.5 md:p-0 rounded-xl mt-3 md:mt-0">
                        <button onClick={() => setEditing({ ...p, ideas: p.ideas || '', activities: p.activities || '', goals: p.goals || '' })}
                          className="p-2.5 text-slate-400 hover:text-[#0f2240] hover:bg-slate-100 rounded-xl transition-colors" title="Редактирай"><Pencil size={16} /></button>
                        <button onClick={() => remove(p)} className="p-2.5 text-slate-400 hover:text-white hover:bg-rose-500 rounded-xl transition-colors" title="Изтрий"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>

                  {(p.ideas || p.activities || p.goals) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5 pt-5 border-t border-slate-100">
                      {p.ideas && (
                        <div>
                          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Lightbulb size={12}/> Основни идеи</div>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{p.ideas}</div>
                        </div>
                      )}
                      {p.activities && (
                        <div>
                          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><CheckCircle2 size={12}/> Дейности</div>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{p.activities}</div>
                        </div>
                      )}
                      {p.goals && (
                        <div>
                          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Target size={12}/> Очаквани резултати</div>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{p.goals}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Модал за Редакция / Добавяне */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all" onClick={e => e.stopPropagation()}>
            
            {/* Хедър на модала */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white z-10">
              <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                {editing.id ? <Pencil size={20} className="text-[#0f2240]" /> : <Plus size={20} className="text-[#0f2240]" />}
                {editing.id ? 'Редакция на проект' : 'Създаване на нов проект'}
              </h2>
              <button onClick={() => !saving && setEditing(null)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            {/* Съдържание на модала */}
            <div className="p-6 space-y-6 overflow-y-auto">
              
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">Тема на проекта <span className="text-rose-500">*</span></label>
                <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="Въведете заглавие..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 transition-all focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 placeholder:text-slate-400 placeholder:font-normal" />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">Участващи паралелки <span className="text-rose-500">*</span></label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {classes.map(c => {
                    const on = editing.classIds.includes(c.id)
                    return (
                      <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all active:scale-[0.97] ${on ? 'bg-[#0f2240] text-white border-[#0f2240] shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}>
                        {c.name}
                      </button>
                    )
                  })}
                  {classes.length === 0 && <span className="text-xs text-slate-400 p-1">Няма намерени паралелки</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">Начален месец</label>
                  <select value={monthOfISO(editing.period_from) ?? ''} onChange={e => setFromMonth(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium transition-all focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 cursor-pointer">
                    <option value="">— Изберете —</option>
                    {SCHOOL_MONTHS.map(m => <option key={m} value={m}>{MONTH_LABEL[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">Краен месец</label>
                  <select value={monthOfISO(editing.period_to) ?? ''} disabled={!editing.period_from}
                    onChange={e => setToMonth(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium transition-all focus:bg-white focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                    <option value="">— Изберете —</option>
                    {SCHOOL_MONTHS.filter(m => { const fmv = monthOfISO(editing.period_from); return !fmv || orderIdx(m) >= orderIdx(fmv) }).map(m => <option key={m} value={m}>{MONTH_LABEL[m]}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">Етап на изпълнение</label>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl inline-flex w-full sm:w-auto overflow-x-auto">
                  {STATUS.map(s => (
                    <button key={s.key} type="button" onClick={() => setEditing({ ...editing, status: s.key })}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${editing.status === s.key ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Lightbulb size={12}/> Основни идеи</label>
                  <AutoTextarea value={editing.ideas || ''} onChange={v => setEditing({ ...editing, ideas: v })} placeholder="Опишете накратко идеята..." minRows={2}/>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><CheckCircle2 size={12}/> Планирани дейности</label>
                  <AutoTextarea value={editing.activities || ''} onChange={v => setEditing({ ...editing, activities: v })} placeholder="Какво точно ще се прави..." minRows={2}/>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Target size={12}/> Цели и очаквани резултати</label>
                  <AutoTextarea value={editing.goals || ''} onChange={v => setEditing({ ...editing, goals: v })} placeholder="Какво целим да постигнем..." minRows={2}/>
                </div>
              </div>

            </div>
            
            {/* Футър на модала */}
            <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl">
              <button onClick={() => setEditing(null)} disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors">Отказ</button>
              <button onClick={save} disabled={saving || !editing.title.trim() || editing.classIds.length === 0}
                className="inline-flex items-center justify-center min-w-[120px] gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md disabled:opacity-50 hover:shadow-lg transition-all active:scale-[0.98]" style={{ backgroundColor: '#0f2240' }}>
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />} 
                {editing.id ? 'Обнови проекта' : 'Създай проекта'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
