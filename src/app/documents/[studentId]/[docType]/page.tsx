'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, Download, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { DOCUMENT_TYPE_LABELS, DocumentType, DocumentStatus } from '@/types'
import { generateAndDownloadDocument } from '@/lib/docx-generator'

// Field definitions per document type
const DOCUMENT_FIELDS: Record<DocumentType, { key: string; label: string; type: 'text' | 'textarea' | 'date' }[]> = {
  protocol_1: [
    { key: 'session_date', label: 'Дата на заседание', type: 'date' },
    { key: 'current_level', label: 'Актуално ниво на развитие', type: 'textarea' },
    { key: 'goals', label: 'Цели за учебната година', type: 'textarea' },
    { key: 'recommendations', label: 'Препоръки', type: 'textarea' },
  ],
  protocol_2: [
    { key: 'session_date', label: 'Дата на заседание', type: 'date' },
    { key: 'progress', label: 'Постигнат напредък', type: 'textarea' },
    { key: 'challenges', label: 'Затруднения', type: 'textarea' },
    { key: 'adjustments', label: 'Корекции в плана', type: 'textarea' },
  ],
  protocol_3: [
    { key: 'session_date', label: 'Дата на заседание', type: 'date' },
    { key: 'annual_summary', label: 'Годишно обобщение', type: 'textarea' },
    { key: 'achievements', label: 'Постижения', type: 'textarea' },
    { key: 'next_year_recommendations', label: 'Препоръки за следващата година', type: 'textarea' },
  ],
  iup: [
    { key: 'approved_date', label: 'Дата на утвърждаване', type: 'date' },
    { key: 'learning_objectives', label: 'Учебни цели', type: 'textarea' },
    { key: 'additional_support', label: 'Допълнителна подкрепа', type: 'textarea' },
    { key: 'evaluation_criteria', label: 'Критерии за оценяване', type: 'textarea' },
  ],
  iu_program: [
    { key: 'subjects', label: 'Учебни предмети и съдържание', type: 'textarea' },
    { key: 'methods', label: 'Методи и подходи', type: 'textarea' },
    { key: 'materials', label: 'Материали и ресурси', type: 'textarea' },
  ],
  support_plan: [
    { key: 'period', label: 'Период', type: 'text' },
    { key: 'goals', label: 'Цели', type: 'textarea' },
    { key: 'activities', label: 'Дейности', type: 'textarea' },
    { key: 'evaluation', label: 'Оценка на резултатите', type: 'textarea' },
  ],
  parent_program: [
    { key: 'goals', label: 'Цели на програмата', type: 'textarea' },
    { key: 'activities', label: 'Дейности с родителите', type: 'textarea' },
    { key: 'schedule', label: 'График на срещите', type: 'textarea' },
    { key: 'notes', label: 'Бележки', type: 'textarea' },
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
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  useEffect(() => {
    if (!resolvedParams) return
    loadData()
  }, [resolvedParams])

  async function loadData() {
    if (!resolvedParams) return
    const { studentId, docType } = resolvedParams

    const { data: year } = await supabase
      .from('academic_years')
      .select('*')
      .eq('is_current', true)
      .single()
    setYearName(year?.name || '')

    const { data: s } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentId)
      .single()
    setStudent(s)

    const { data: t } = await supabase
      .from('eplr_teams')
      .select(`
        *,
        psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(*),
        speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(*),
        rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(*),
        class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(*)
      `)
      .eq('student_id', studentId)
      .eq('academic_year_id', year?.id)
      .single()
    setTeam(t)

    const { data: doc } = await supabase
      .from('documents')
      .select('*')
      .eq('student_id', studentId)
      .eq('academic_year_id', year?.id)
      .eq('doc_type', docType)
      .single()

    if (doc) {
      setFormData(doc.data as Record<string, string> || {})
      setStatus(doc.status as DocumentStatus)
    }
  }

  async function handleSave(newStatus?: DocumentStatus) {
    if (!resolvedParams) return
    const { studentId, docType } = resolvedParams
    setSaving(true)

    const { data: year } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_current', true)
      .single()

    const { data: profile } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id!)
      .single()

    const saveStatus = newStatus || status
    if (saveStatus === 'empty' && Object.values(formData).some(v => v)) {
      setStatus('in_progress')
    }

    await supabase
      .from('documents')
      .upsert({
        student_id: studentId,
        academic_year_id: year?.id,
        doc_type: docType,
        data: formData,
        status: newStatus || (Object.values(formData).some(v => v) ? 'in_progress' : 'empty'),
        updated_by: profile?.id,
      }, {
        onConflict: 'student_id,academic_year_id,doc_type',
      })

    setSaving(false)
    if (newStatus === 'completed') router.push(`/students/${studentId}`)
  }

  async function handleDownload() {
    if (!student || !resolvedParams) return
    await generateAndDownloadDocument(
      resolvedParams.docType as DocumentType,
      student,
      team || {},
      formData,
      yearName
    )
  }

  if (!resolvedParams) return null

  const { studentId, docType } = resolvedParams
  const fields = DOCUMENT_FIELDS[docType as DocumentType] || []
  const docLabel = DOCUMENT_TYPE_LABELS[docType as DocumentType]

  return (
    <div className="p-8 max-w-3xl">
      <Link href={`/students/${studentId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6">
        <ArrowLeft size={15} />
        Назад към ученика
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{docLabel}</h1>
          {student && (
            <p className="text-slate-500 text-sm mt-1">
              {[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ')}
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
                className="input resize-none"
                placeholder={`Въведете ${field.label.toLowerCase()}...`}
              />
            ) : field.type === 'date' ? (
              <input
                type="date"
                value={formData[field.key] || ''}
                onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="input"
              />
            ) : (
              <input
                type="text"
                value={formData[field.key] || ''}
                onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="input"
                placeholder={`Въведете ${field.label.toLowerCase()}...`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#0f2240' }}
        >
          <Save size={15} />
          {saving ? 'Запазване...' : 'Запази'}
        </button>

        {status !== 'completed' && (
          <button
            onClick={() => handleSave('completed')}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Маркирай като завършен
          </button>
        )}

        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors ml-auto"
        >
          <Download size={15} />
          Изтегли Word
        </button>
      </div>
    </div>
  )
}
