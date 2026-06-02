import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, Check, Search, AlertCircle, Sparkles } from 'lucide-react'
import { getFullName } from '@/lib/utils'
import { DOCUMENT_TYPE_LABELS, DocumentType, DocumentStatus } from '@/types'

const ALL_DOC_TYPES: DocumentType[] = [
  'protocol_1', 'protocol_2', 'protocol_3',
  'iup', 'iu_program', 'support_plan', 'parent_program'
]

const DOC_SHORT: Record<DocumentType, string> = {
  protocol_1: 'П1', protocol_2: 'П2', protocol_3: 'П3',
  iup: 'ИУП', iu_program: 'ИУПр', support_plan: 'ПДП', parent_program: 'ПР',
}

interface PageProps {
  searchParams: Promise<{ filter?: string; q?: string }>
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const params = await searchParams
  const activeFilter = params.filter || 'all'
  const searchQuery = params.q || ''

  const { data: profileData } = await supabase
    .from('staff_profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = profileData?.role || ''
  const isClassTeacher = role === 'class_teacher'
  const isSpecialist = ['psychologist', 'speech_therapist', 'rehabilitator'].includes(role)

  const { data: currentYear } = await supabase
    .from('academic_years')
    .select('*')
    .eq('is_current', true)
    .maybeSingle()

  // Изграждане на защитената заявка за ученици
  let query = supabase
    .from('student_enrollments')
    .select('*, student:students(*), class:classes(*)')
    .eq('academic_year_id', currentYear?.id || '00000000-0000-0000-0000-000000000000')

  if (isClassTeacher) {
    const { data: assignments } = await supabase
      .from('class_teacher_assignments')
      .select('class_id')
      .eq('staff_id', profileData!.id)
      .eq('academic_year_id', currentYear?.id)
    const myClassIds = assignments?.map(a => a.class_id) || []
    query = query.in('class_id', myClassIds.length > 0 ? myClassIds : ['no-results'])
  } else if (isSpecialist) {
    const roleField = role === 'psychologist' ? 'psychologist_id'
      : role === 'speech_therapist' ? 'speech_therapist_id'
      : 'rehabilitator_id'
    const { data: eplrTeams } = await supabase
      .from('eplr_teams')
      .select('student_id')
      .eq(roleField, profileData!.id)
      .eq('academic_year_id', currentYear?.id)
    const studentIds = eplrTeams?.map(t => t.student_id) || []
    query = query.in('student_id', studentIds.length > 0 ? studentIds : ['no-results'])
  }

  const { data: enrollments } = await query

  // Извличане на документите само за достъпните ученици
  const allowedStudentIds = enrollments?.map(e => e.student_id) || []
  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('academic_year_id', currentYear?.id)
    .in('student_id', allowedStudentIds.length > 0 ? allowedStudentIds : ['no-results'])

  const docMap = new Map(
    documents?.map(d => [`${d.student_id}_${d.doc_type}`, d]) || []
  )

  // Изчисляване на глобалната статистика
  const studentsCount = enrollments?.length || 0
  const completedCount = documents?.filter(d => d.status === 'completed').length || 0
  const inProgressCount = documents?.filter(d => d.status === 'in_progress').length || 0
  const totalDocsCount = studentsCount * ALL_DOC_TYPES.length

  // Обработка, изчисляване на прогрес и филтриране на учениците
  const studentRows = (enrollments || [])
    .map(enrollment => {
      const student = enrollment.student
      if (!student) return null

      const studentDocs = ALL_DOC_TYPES.map(type => docMap.get(`${student.id}_${type}`))
      const completed = studentDocs.filter(d => d?.status === 'completed').length
      const inProgress = studentDocs.filter(d => d?.status === 'in_progress').length
      const pct = Math.round((completed / ALL_DOC_TYPES.length) * 100)

      return {
        enrollment,
        student,
        completed,
        inProgress,
        pct,
        name: getFullName(student),
        isFullyCompleted: completed === ALL_DOC_TYPES.length,
        requiresAttention: completed < ALL_DOC_TYPES.length
      }
    })
    .filter(Boolean) as any[]

  // Прилагане на филтри и търсене
  const filteredRows = studentRows.filter(row => {
    const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false

    if (activeFilter === 'attention') return row.requiresAttention
    if (activeFilter === 'completed') return row.isFullyCompleted
    return true
  })

  const getModernBadge = (status: DocumentStatus) => {
    if (status === 'completed') {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100/50 mb-1.5 shadow-sm text-emerald-500">
          <Check size={14} strokeWidth={2.5} />
        </span>
      )
    }
    if (status === 'in_progress') {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 border border-amber-100/50 mb-1.5 text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        </span>
      )
    }
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-50 border border-slate-100/50 mb-1.5">
        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
      </span>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-300">
      {/* Заглавна секция с Модерни Статистически Карти */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Документи на ученици</h1>
          <p className="text-slate-500 text-sm mt-1">Учебна година: {currentYear?.name}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:w-auto">
          <div className="bg-emerald-50/60 border border-emerald-100/80 rounded-xl px-4 py-2.5 min-w-[120px]">
            <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Завършени</div>
            <div className="text-lg font-bold text-emerald-800 mt-0.5">{completedCount} <span className="text-xs font-normal text-emerald-600/70">/ {totalDocsCount}</span></div>
          </div>
          <div className="bg-amber-50/60 border border-amber-100/80 rounded-xl px-4 py-2.5 min-w-[120px]">
            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">В процес</div>
            <div className="text-lg font-bold text-amber-800 mt-0.5">{inProgressCount}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2.5 min-w-[120px] col-span-2 sm:col-span-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Оставащи</div>
            <div className="text-lg font-bold text-slate-700 mt-0.5">{totalDocsCount - completedCount - inProgressCount}</div>
          </div>
        </div>
      </div>

      {/* Контролен панел: Търсене и Филтри */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-6 print:hidden">
        {/* Филтри тип Segmented Control */}
        <div className="inline-flex p-1 bg-slate-100/80 border border-slate-200/50 rounded-xl shadow-inner overflow-x-auto max-w-full">
          <Link href="?filter=all" className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${activeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Всички ученици ({studentRows.length})
          </Link>
          <Link href="?filter=attention" className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${activeFilter === 'attention' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Изискват внимание ({studentRows.filter(r => r.requiresAttention).length})
          </Link>
          <Link href="?filter=completed" className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${activeFilter === 'completed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Напълно завършени ({studentRows.filter(r => r.isFullyCompleted).length})
          </Link>
        </div>

        {/* Форма за търсене на място */}
        <form method="GET" className="relative flex-1 md:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Търси ученик по име..."
            className="input pl-9 pr-4 py-2 w-full text-xs shadow-sm"
          />
          {activeFilter !== 'all' && <input type="hidden" name="filter" value={activeFilter} />}
        </form>
      </div>

      {/* Списък с ученици */}
      <div className="space-y-4">
        {filteredRows.map(row => {
          return (
            <div key={row.student.id} className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md ${row.isFullyCompleted ? 'border-emerald-100 bg-gradient-to-r from-emerald-50/10 to-transparent' : 'border-slate-200/70'}`}>
              
              {/* Горна част на картата */}
              <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-slate-800 text-sm md:text-base truncate">{row.name}</h2>
                    {row.isFullyCompleted && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                        <Sparkles size={10} /> 100% Готов
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-medium">
                    <span>Паралелка: {row.enrollment.class?.name || '—'}</span>
                    <span className="text-slate-200">•</span>
                    <span className="text-slate-500">Прогрес: {row.completed} от 7 готови</span>
                  </div>

                  {/* Функционално нововъведение: Индивидуален прогрес бар */}
                  <div className="mt-3 flex items-center gap-3 max-w-md">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${row.isFullyCompleted ? 'bg-emerald-500' : row.pct >= 40 ? 'bg-amber-400' : 'bg-rose-400'}`} 
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 w-8 text-right">{row.pct}%</span>
                  </div>
                </div>

                <Link href={`/students/${row.student.id}`} className="text-xs font-semibold text-blue-600 bg-blue-50/80 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors self-start sm:self-center text-center whitespace-nowrap shadow-sm">
                  Отвори досие →
                </Link>
              </div>

              {/* ДЕСКТОП ИЗГЛЕД: Редакторска мрежа (7 документа) */}
              <div className="hidden md:grid grid-cols-7 gap-px bg-slate-100/50 p-4">
                {ALL_DOC_TYPES.map(docType => {
                  const doc = docMap.get(`${row.student.id}_${docType}`)
                  const status: DocumentStatus = doc?.status || 'empty'
                  return (
                    <Link
                      key={docType}
                      href={`/documents/${row.student.id}/${docType}`}
                      className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl hover:bg-white transition-all text-center group border border-transparent hover:border-slate-200/50 hover:shadow-sm"
                    >
                      {getModernBadge(status)}
                      <span className={`text-[10px] font-bold tracking-wider uppercase mt-1 transition-colors ${status === 'completed' ? 'text-emerald-600' : status === 'in_progress' ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                        {DOC_SHORT[docType]}
                      </span>
                      <span className="text-[9px] text-slate-400 scale-90 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 font-medium whitespace-nowrap">
                        Редактирай
                      </span>
                    </Link>
                  )
                })}
              </div>

              {/* МОБИЛЕН ИЗГЛЕД: Удобни таблетки */}
              <div className="md:hidden flex flex-wrap gap-2 p-4 bg-slate-50/40">
                {ALL_DOC_TYPES.map(docType => {
                  const doc = docMap.get(`${row.student.id}_${docType}`)
                  const status: DocumentStatus = doc?.status || 'empty'
                  return (
                    <Link
                      key={docType}
                      href={`/documents/${row.student.id}/${docType}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
                        status === 'completed'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : status === 'in_progress'
                          ? 'bg-amber-50 border-amber-100 text-amber-700'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      {status === 'completed' ? (
                        <Check size={12} strokeWidth={3} className="text-emerald-500" />
                      ) : status === 'in_progress' ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                      )}
                      <span>{DOC_SHORT[docType]}</span>
                    </Link>
                  )
                })}
              </div>

            </div>
          )
        })}

        {/* Екран при празен резултат */}
        {filteredRows.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-sm max-w-xl mx-auto">
            <AlertCircle className="mx-auto mb-3 text-slate-300" size={40} />
            <h3 className="text-base font-semibold text-slate-700">Няма намерени съвпадения</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Промени филтъра или ключовата дума за търсене, за да видиш други документи.</p>
          </div>
        )}
      </div>
    </div>
  )
}
