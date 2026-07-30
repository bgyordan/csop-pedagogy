'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Check, ChevronDown, FileText } from 'lucide-react'
import { SURVEY_SECTIONS } from './survey-schema'

interface Props {
  studentId: string
  studentName: string
  initialData: Record<string, any>
  canEdit: boolean
}

export default function SurveyForm({ studentId, studentName, initialData, canEdit }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [data, setData] = useState<Record<string, any>>(initialData || {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set([SURVEY_SECTIONS[0].key]))

  function setField(sectionKey: string, fieldKey: string, value: string) {
    setData(prev => ({
      ...prev,
      [sectionKey]: { ...(prev[sectionKey] || {}), [fieldKey]: value },
    }))
    setSaved(false)
  }
  function setNote(sectionKey: string, value: string) {
    setData(prev => ({
      ...prev,
      [sectionKey]: { ...(prev[sectionKey] || {}), __notes: value },
    }))
    setSaved(false)
  }
  function setAge(sectionKey: string, fieldKey: string, value: string) {
    setData(prev => ({
      ...prev,
      [sectionKey]: { ...(prev[sectionKey] || {}), [`${fieldKey}__age`]: value },
    }))
    setSaved(false)
  }

  function toggle(key: string) {
    setOpenSections(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }
  function expandAll() { setOpenSections(new Set(SURVEY_SECTIONS.map(s => s.key))) }
  function collapseAll() { setOpenSections(new Set()) }

  async function save() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    let filledBy: string | null = null
    if (user) {
      const { data: prof } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()
      filledBy = prof?.id || null
    }
    await supabase.from('student_surveys').upsert({
      student_id: studentId,
      data,
      filled_by: filledBy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id' })
    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 3000)
  }

  // Колко полета са попълнени в секция (за индикатор)
  function filledCount(sectionKey: string): number {
    const sec = data[sectionKey] || {}
    return Object.entries(sec).filter(([k, v]) => !k.endsWith('__age') && k !== '__notes' && String(v).trim()).length
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <Link href={`/students/${studentId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-5 transition-colors">
        <ArrowLeft size={15} /> Назад към досието
      </Link>

      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Карта за оценка на потребностите</h1>
          <p className="text-slate-500 text-sm mt-1">{studentName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1">Разгъни</button>
          <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1">Свий</button>
        </div>
      </div>

      <div className="space-y-3">
        {SURVEY_SECTIONS.map(section => {
          const isOpen = openSections.has(section.key)
          const cnt = filledCount(section.key)
          const sec = data[section.key] || {}
          return (
            <div key={section.key} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <button onClick={() => toggle(section.key)}
                className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={15} className="text-slate-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-slate-800 text-left">{section.title}</span>
                  {cnt > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex-shrink-0">{cnt}</span>
                  )}
                </div>
                <ChevronDown size={16} className={`text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-3">
                  {section.intro && <p className="text-xs text-slate-400 italic">{section.intro}</p>}
                  {section.fields.map(field => (
                    <div key={field.key} className={section.ageColumn ? 'grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-2' : ''}>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={sec[field.key] || ''}
                            onChange={e => setField(section.key, field.key, e.target.value)}
                            disabled={!canEdit}
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300 disabled:bg-slate-50 resize-y"
                          />
                        ) : (
                          <input type="text"
                            value={sec[field.key] || ''}
                            onChange={e => setField(section.key, field.key, e.target.value)}
                            disabled={!canEdit}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300 disabled:bg-slate-50"
                          />
                        )}
                      </div>
                      {section.ageColumn && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Възраст</label>
                          <input type="text"
                            value={sec[`${field.key}__age`] || ''}
                            onChange={e => setAge(section.key, field.key, e.target.value)}
                            disabled={!canEdit}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300 disabled:bg-slate-50"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {section.hasNotes && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Бележки</label>
                      <textarea
                        value={sec.__notes || ''}
                        onChange={e => setNote(section.key, e.target.value)}
                        disabled={!canEdit}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300 disabled:bg-slate-50 resize-y"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Запис — лепкав долу */}
      {canEdit && (
        <div className="sticky bottom-4 mt-6 flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-semibold shadow-lg transition-all disabled:opacity-60"
            style={{ backgroundColor: saved ? '#059669' : '#0f2240' }}>
            {saving ? <Loader2 size={17} className="animate-spin" /> : saved ? <Check size={17} /> : <Save size={17} />}
            {saving ? 'Запазване...' : saved ? 'Запазено' : 'Запази анкетата'}
          </button>
        </div>
      )}
    </div>
  )
}
