'use client'
import { BackButton } from '@/components/ui/BackButton'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, Download } from 'lucide-react'
import { DOCUMENT_TYPE_LABELS, DocumentType, DocumentStatus } from '@/types'
import { generateAndDownloadDocument } from '@/lib/docx-generator'
import { getFullName } from '@/lib/utils'

const DOCUMENT_FIELDS: Record<DocumentType, { key: string; label: string; type: 'text' | 'textarea' | 'date' }[]> = {
  protocol_1: [
    { key: 'session_date', label: 'Дата на заседание', type: 'date' },
    { key: 'parent_name', label: 'Име на родителя', type: 'text' },
    { key: 'other_topics', label: 'Други обсъждани теми', type: 'textarea' },
    { key: 'decisions', label: 'Приети решения', type: 'textarea' },
    { key: 'parent_opinion', label: 'Мнение на родителя', type: 'textarea' },
  ],
  protocol_2: [
    { key: 'session_date', label: 'Дата на заседание', type: 'date' },
    { key: 'parent_name', label: 'Име на родителя', type: 'text' },
    { key: 'results_summary', label: 'Резултати по учебни предмети (обобщение)', type: 'textarea' },
    { key: 'decisions', label: 'Взети решения', type: 'textarea' },
    { key: 'parent_opinion', label: 'Мнение на родителя', type: 'textarea' },
  ],
  protocol_3: [
    { key: 'session_date', label: 'Дата на заседание', type: 'date' },
    { key: 'parent_name', label: 'Име на родителя', type: 'text' },
    { key: 'annual_results', label: 'Годишни резултати (обобщение)', type: 'textarea' },
    { key: 'parent_opinion', label: 'Мнение на родителя', type: 'textarea' },
  ],
  iup: [
    { key: 'study_form', label: 'Форма на обучение', type: 'text' },
    { key: 'day_org', label: 'Организация на учебния ден', type: 'text' },
    { key: 'location', label: 'Място на провеждане', type: 'text' },
    { key: 'methods', label: 'Специфични методи на обучение', type: 'textarea' },
    { key: 'assessment', label: 'Форми и методи на проверка и оценка', type: 'textarea' },
  ],
  iu_program: [
    { key: 'subject', label: 'Учебен предмет', type: 'text' },
    { key: 'goals', label: 'Цели по предмета', type: 'textarea' },
    { key: 'content', label: 'Учебно съдържание', type: 'textarea' },
    { key: 'methods', label: 'Методи и подходи', type: 'textarea' },
    { key: 'assessment', label: 'Оценяване', type: 'textarea' },
  ],
  support_plan: [
    { key: 'age', label: 'Възраст', type: 'text' },
    { key: 'support_type', label: 'Вид на допълнителната подкрепа', type: 'text' },
    { key: 'study_form', label: 'Форма на обучение', type: 'text' },
    { key: 'cognitive_development', label: 'Когнитивно развитие', type: 'textarea' },
    { key: 'emotional_state', label: 'Емоционално състояние и поведение', type: 'textarea' },
    { key: 'strengths', label: 'Силни страни и потенциал', type: 'textarea' },
    { key: 'goals', label: 'Цели и задачи на допълнителната подкрепа', type: 'textarea' },
    { key: 'methods', label: 'Специални методи и средства', type: 'textarea' },
  ],
  parent_program: [
    { key: 'goal', label: 'Цел на програмата', type: 'textarea' },
    { key: 'intro', label: 'Въведение', type: 'textarea' },
    { key: 'family_work', label: 'Работа заедно със семействата', type: 'textarea' },
  ],
}

interface Props {
  params: Promise<{ studentId: string; docType: string }>
}

export default function DocumentEditorPage({ params }: Props) {
  const [resolvedParams, setResolvedParams] = useState<{ studentId: string; docType: string } | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<DocumentStatus>('empty')
  const [saving, setSaving] = useState(false)
  const [student, setStudent] = useState<any>(null)
  const [team, setTeam] = useState<any>(null)
  const [yearName, setYearName] = useState('')
  const [className, setClassName] = useState('')
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

    // Get class name automatically
    const { data: enrollment } = await supabase
      .from('student_enrollments')
      .select('class:classes(name)')
      .eq('student_id', studentId)
      .eq('academic_year_id', year?.id)
      .single()
    setClassName((enrollment?.class as any)?.name || '')

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
      student_id: studentId,
      academic_year_id: year?.id,
      doc_type: docType,
      data: { ...formData, class_name: className },
      status: saveStatus,
      updated_by: profile?.id,
    }, { onConflict: 'student_id,academic_year_id,doc_type' })

    setStatus(saveStatus)
    setSaving(false)
    if (newStatus === 'completed') router.push(`/students/${studentId}`)
  }

  async function handleDownload() {
    if (!student || !resolvedParams) return
    await generateAndDownloadDocument(
      resolvedParams.docType as DocumentType,
      student,
      team || {},
      { ...formData, class_name: className },
      yearName
    )
  }

  if (!resolvedParams) return null

  const { studentId, docType } = resolvedParams
  const fields = DOCUMENT_FIELDS[docType as DocumentType] || []
  const docLabel = DOCUMENT_TYPE_LABELS[docType as DocumentType]

  return (
    <div className="p-8 max-w-3xl">
      <BackButton />

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{docLabel}</h1>
          {student && (
            <p className="text-slate-500 text-sm mt-1">
              {getFullName(student)} · Паралелка {className}
            </p>
          )}
        </div>
        <span className={
          status === 'completed' ? 'badge-completed' :
          status === 'in_progress' ? 'badge-in-progress' :
          'badge-empty'
        }>
          {status === 'completed' ? 'Завършен' : status === 'in_progress' ? 'В процес' : 'Непопълнен'}
        </span>
      </div>

      <div className="card space-y-5">
        {fields.map(field => (
          <div key={field.key}>
            <label className="label">{field.label}</label>
            {field.type === 'textarea' ? (
              <textarea
                rows={4}
                value={formData[field.key] || ''}
                onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="input resize-y"
                placeholder={`Въведете ${field.label.toLowerCase()}...`}
              />
            ) : field.type === 'date' ? (
              <input type="date" value={formData[field.key] || ''} onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))} className="input" />
            ) : (
              <input type="text" value={formData[field.key] || ''} onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))} className="input" placeholder={`Въведете ${field.label.toLowerCase()}...`} />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button onClick={() => handleSave()} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#0f2240' }}>
          <Save size={15} />
          {saving ? 'Запазване...' : 'Запази'}
        </button>
        {status !== 'completed' && (
          <button onClick={() => handleSave('completed')} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700">
            Маркирай като завършен
          </button>
        )}
        <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 ml-auto">
          <Download size={15} />
          Изтегли Word
        </button>
      </div>
    </div>
  )
}
