'use client'
import { BackButton } from '@/components/ui/BackButton'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, Download } from 'lucide-react'
import { DOCUMENT_TYPE_LABELS, DocumentType, DocumentStatus } from '@/types'
import { generateAndDownloadDocument } from '@/lib/docx-generator'
import { getFullName } from '@/lib/utils'

type Field = { key: string; label: string; type: 'text' | 'textarea' | 'date' | 'yesno' | 'auto' }
type Section = { title?: string; fields: Field[] }

// Полетата по документ, групирани по секции (заглавие + полета)
const DOCUMENT_SECTIONS: Record<string, Section[]> = {
  protocol_1: [{ fields: [
    { key: 'session_date', label: 'Дата на заседание', type: 'date' },
    { key: 'parent_name', label: 'Име на родителя', type: 'text' },
    { key: 'other_topics', label: 'Други обсъждани теми', type: 'textarea' },
    { key: 'decisions', label: 'Приети решения', type: 'textarea' },
    { key: 'parent_opinion', label: 'Мнение на родителя', type: 'textarea' },
  ] }],
  protocol_2: [{ fields: [
    { key: 'session_date', label: 'Дата на заседание', type: 'date' },
    { key: 'parent_name', label: 'Име на родителя', type: 'text' },
    { key: 'results_summary', label: 'Резултати по учебни предмети (обобщение)', type: 'textarea' },
    { key: 'decisions', label: 'Взети решения', type: 'textarea' },
    { key: 'parent_opinion', label: 'Мнение на родителя', type: 'textarea' },
  ] }],
  protocol_3: [{ fields: [
    { key: 'session_date', label: 'Дата на заседание', type: 'date' },
    { key: 'parent_name', label: 'Име на родителя', type: 'text' },
    { key: 'annual_results', label: 'Годишни резултати (обобщение)', type: 'textarea' },
    { key: 'parent_opinion', label: 'Мнение на родителя', type: 'textarea' },
  ] }],
  iup: [{ fields: [
    { key: 'study_form', label: 'Форма на обучение', type: 'text' },
    { key: 'day_org', label: 'Организация на учебния ден', type: 'text' },
    { key: 'location', label: 'Място на провеждане', type: 'text' },
    { key: 'methods', label: 'Специфични методи на обучение', type: 'textarea' },
    { key: 'assessment', label: 'Форми и методи на проверка и оценка', type: 'textarea' },
  ] }],
  iu_program: [{ fields: [
    { key: 'subject', label: 'Учебен предмет', type: 'text' },
    { key: 'goals', label: 'Цели по предмета', type: 'textarea' },
    { key: 'content', label: 'Учебно съдържание', type: 'textarea' },
    { key: 'methods', label: 'Методи и подходи', type: 'textarea' },
    { key: 'assessment', label: 'Оценяване', type: 'textarea' },
  ] }],
  parent_program: [{ fields: [
    { key: 'goal', label: 'Цел на програмата', type: 'textarea' },
    { key: 'intro', label: 'Въведение', type: 'textarea' },
    { key: 'family_work', label: 'Работа заедно със семействата', type: 'textarea' },
  ] }],
  support_plan: [
    { title: 'I. Основна информация', fields: [
      { key: 'age', label: 'Възраст', type: 'auto' },
      { key: 'support_type', label: 'Вид на допълнителната подкрепа', type: 'text' },
      { key: 'study_form', label: 'Форма на обучение', type: 'auto' },
      { key: 'assessment_type', label: 'Начин на оценяване (покрива/частично покрива ДОС, качествено/количествено)', type: 'textarea' },
      { key: 'iup_note', label: 'Разработен ИУП и/или индивидуални учебни програми по предмети', type: 'textarea' },
    ] },
    { title: 'Психо-социална рехабилитация (Да / Не)', fields: [
      { key: 'rehab_0', label: 'Психо-социална рехабилитация', type: 'yesno' },
      { key: 'rehab_1', label: 'Рехабилитация на слуха и говора', type: 'yesno' },
      { key: 'rehab_2', label: 'Зрителна рехабилитация', type: 'yesno' },
      { key: 'rehab_3', label: 'Рехабилитация на комуникативните нарушения', type: 'yesno' },
      { key: 'rehab_4', label: 'Осигуряване на достъпна архитектурна среда', type: 'yesno' },
      { key: 'rehab_5', label: 'Обща и специализирана подкрепяща среда, технически средства, оборудване', type: 'yesno' },
      { key: 'rehab_6', label: 'Обучение по специалните предмети за ученици със сензорни увреждания', type: 'yesno' },
      { key: 'rehab_7', label: 'Ресурсно подпомагане', type: 'yesno' },
    ] },
    { title: 'Данни за родителите/настойниците', fields: [
      { key: 'mother_contact', label: 'Майка — имена, адрес, имейл, телефон', type: 'textarea' },
      { key: 'father_contact', label: 'Баща — имена, адрес, имейл, телефон', type: 'textarea' },
    ] },
    { title: 'II. Когнитивно развитие', fields: [
      { key: 'cog_perception', label: 'Възприятия', type: 'textarea' },
      { key: 'cog_attention', label: 'Внимание', type: 'textarea' },
      { key: 'cog_thinking', label: 'Мисловни операции, интелектуално развитие', type: 'textarea' },
      { key: 'cog_memory', label: 'Паметови операции', type: 'textarea' },
      { key: 'cog_language', label: 'Езиково-говорно развитие', type: 'textarea' },
    ] },
    { title: 'III–IV. Състояние и възможности', fields: [
      { key: 'emotional_state', label: 'III. Емоционално състояние и поведение', type: 'textarea' },
      { key: 'strengths', label: 'IV. Възможности за обучение, силни страни и потенциал', type: 'textarea' },
    ] },
    { title: 'V. Цели и задачи (до 7 реда)', fields: [
      { key: 'goal_1', label: '1 · Цел', type: 'text' }, { key: 'task_1', label: '1 · Задача', type: 'text' }, { key: 'term_1', label: '1 · Срок', type: 'text' },
      { key: 'goal_2', label: '2 · Цел', type: 'text' }, { key: 'task_2', label: '2 · Задача', type: 'text' }, { key: 'term_2', label: '2 · Срок', type: 'text' },
      { key: 'goal_3', label: '3 · Цел', type: 'text' }, { key: 'task_3', label: '3 · Задача', type: 'text' }, { key: 'term_3', label: '3 · Срок', type: 'text' },
      { key: 'goal_4', label: '4 · Цел', type: 'text' }, { key: 'task_4', label: '4 · Задача', type: 'text' }, { key: 'term_4', label: '4 · Срок', type: 'text' },
      { key: 'goal_5', label: '5 · Цел', type: 'text' }, { key: 'task_5', label: '5 · Задача', type: 'text' }, { key: 'term_5', label: '5 · Срок', type: 'text' },
      { key: 'goal_6', label: '6 · Цел', type: 'text' }, { key: 'task_6', label: '6 · Задача', type: 'text' }, { key: 'term_6', label: '6 · Срок', type: 'text' },
      { key: 'goal_7', label: '7 · Цел', type: 'text' }, { key: 'task_7', label: '7 · Задача', type: 'text' }, { key: 'term_7', label: '7 · Срок', type: 'text' },
    ] },
    { title: 'VII. Описание на екипната работа', fields: [
      { key: 'work_speech', label: 'Логопед — дейности', type: 'textarea' },
      { key: 'work_psych', label: 'Психолог — дейности', type: 'textarea' },
      { key: 'work_rehab', label: 'Рехабилитатор — дейности', type: 'textarea' },
    ] },
    { title: 'Родител', fields: [
      { key: 'parent_name', label: 'Име и фамилия на родителя', type: 'text' },
      { key: 'parent_opinion', label: 'Мнение на родителя', type: 'textarea' },
    ] },
  ],
}

interface Props { params: Promise<{ studentId: string; docType: string }> }

export default function DocumentEditorPage({ params }: Props) {
  const [resolvedParams, setResolvedParams] = useState<{ studentId: string; docType: string } | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<DocumentStatus>('empty')
  const [saving, setSaving] = useState(false)
  const [student, setStudent] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [yearName, setYearName] = useState('')
  const [className, setClassName] = useState('')
  const [autoValues, setAutoValues] = useState<Record<string, string>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { params.then(setResolvedParams) }, [params])
  useEffect(() => { if (resolvedParams) loadData() }, [resolvedParams])

  async function loadData() {
    if (!resolvedParams) return
    const { studentId, docType } = resolvedParams
    const { data: year } = await supabase.from('academic_years').select('*').eq('is_current', true).single()
    setYearName(year?.name || '')
    const { data: s } = await supabase.from('students').select('*').eq('id', studentId).single()
    setStudent(s)
    const { data: enrollment } = await supabase
      .from('student_enrollments').select('class:classes(name), education_form')
      .eq('student_id', studentId).eq('academic_year_id', year?.id).single()
    setClassName((enrollment?.class as any)?.name || '')
    // авто-стойности
    const av: Record<string, string> = {}
    const bd = (s as any)?.birth_date
    if (bd) { const b = new Date(bd), n = new Date(); let a = n.getFullYear() - b.getFullYear(); const m = n.getMonth() - b.getMonth(); if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--; if (a > 0) av.age = `${a} г.` }
    const ef = (enrollment as any)?.education_form
    av.study_form = ef === 'ifo' ? 'Индивидуална форма (ИФО)' : 'Дневна'
    setAutoValues(av)
    const { data: t } = await supabase.from('eplr_teams').select(`
      *,
      psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(*),
      speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(*),
      rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(*),
      class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(*)
    `).eq('student_id', studentId).eq('academic_year_id', year?.id).single()
    setTeam(t)
    const { data: doc } = await supabase.from('documents').select('*')
      .eq('student_id', studentId).eq('academic_year_id', year?.id).eq('doc_type', docType).single()
    if (doc) {
      setFormData(doc.data as Record<string, string> || {})
      setStatus(doc.status as DocumentStatus)
    }
  }

  async function handleSave(newStatus?: DocumentStatus) {
    if (!resolvedParams) return
    const { studentId, docType } = resolvedParams
    setSaving(true)
    const { data: year } = await supabase.from('academic_years').select('id').eq('is_current', true).single()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('staff_profiles').select('id').eq('user_id', user?.id!).single()
    const saveStatus = newStatus || (Object.values(formData).some(v => v) ? 'in_progress' : 'empty')
    await supabase.from('documents').upsert({
      student_id: studentId, academic_year_id: year?.id, doc_type: docType,
      data: { ...formData, class_name: className, age: formData.age || autoValues.age || '', study_form: formData.study_form || autoValues.study_form || '' }, status: saveStatus, updated_by: profile?.id,
    }, { onConflict: 'student_id,academic_year_id,doc_type' })
    setStatus(saveStatus)
    setSaving(false)
    if (newStatus === 'completed') router.push(`/generator/${studentId}`)
  }

  async function handleDownload() {
    if (!student || !resolvedParams) return
    await generateAndDownloadDocument(
      resolvedParams.docType as DocumentType, student, team || {},
      { ...formData, class_name: className, age: formData.age || autoValues.age || '', study_form: formData.study_form || autoValues.study_form || '' }, yearName
    )
  }

  if (!resolvedParams) return null
  const { studentId, docType } = resolvedParams
  const sections = DOCUMENT_SECTIONS[docType] || []
  const docLabel = DOCUMENT_TYPE_LABELS[docType as DocumentType]
  const setF = (k: string, v: string) => setFormData(prev => ({ ...prev, [k]: v }))

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <BackButton />
      <div className="flex items-start justify-between mb-6 mt-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{docLabel}</h1>
          {student && <p className="text-slate-500 text-sm mt-1">{getFullName(student)} · Паралелка {className}</p>}
        </div>
        <span className={status === 'completed' ? 'badge-completed' : status === 'in_progress' ? 'badge-in-progress' : 'badge-empty'}>
          {status === 'completed' ? 'Завършен' : status === 'in_progress' ? 'В процес' : 'Непопълнен'}
        </span>
      </div>

      <div className="space-y-5">
        {sections.map((sec, si) => (
          <div key={si} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            {sec.title && <div className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">{sec.title}</div>}
            <div className="space-y-3">
              {sec.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea rows={3} value={formData[field.key] || ''} onChange={e => setF(field.key, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y" />
                  ) : field.type === 'date' ? (
                    <input type="date" value={formData[field.key] || ''} onChange={e => setF(field.key, e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  ) : field.type === 'yesno' ? (
                    <select value={formData[field.key] || ''} onChange={e => setF(field.key, e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer w-28">
                      <option value="">—</option><option value="Да">Да</option><option value="Не">Не</option>
                    </select>
                  ) : field.type === 'auto' ? (
                    <div className="relative">
                      <input type="text" value={formData[field.key] || ''} onChange={e => setF(field.key, e.target.value)}
                        placeholder={autoValues[field.key] || ''}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">авто</span>
                    </div>
                  ) : (
                    <input type="text" value={formData[field.key] || ''} onChange={e => setF(field.key, e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button onClick={() => handleSave()} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Save size={15} /> {saving ? 'Запазване...' : 'Запази'}
        </button>
        {status !== 'completed' && (
          <button onClick={() => handleSave('completed')} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700">
            Маркирай като завършен
          </button>
        )}
        <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 ml-auto">
          <Download size={15} /> Изтегли Word
        </button>
      </div>
    </div>
  )
}
