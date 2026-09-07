import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, FileText, Users, ArrowRightLeft, Archive, UserCog, 
  Pencil, School, Paperclip, History, Heart, CalendarClock, 
  ClipboardList, Sparkles, GraduationCap, Home, Wifi, Info, ShieldCheck
} from 'lucide-react'
import { formatDate, getFullName } from '@/lib/utils'
import { DocumentType } from '@/types'
import { AttachmentsSection } from './AttachmentsSection'
import GuardiansSection from './GuardiansSection'
import StudentStatusSection from './StudentStatusSection'
import { EplrDocumentsSection } from './EplrDocumentsSection'
import MarkProcessedButton from './MarkProcessedButton'
import StudentDeclarations from './StudentDeclarations'

// --- ПОМОЩНИ ФУНКЦИИ ---
function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) { years--; months += 12 }
  if (years === 0) return `${months} м.`
  return months === 0 ? `${years} г.` : `${years} г. ${months} м.`
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`
}

// --- СТИЛИЗИРАНИ КОМПОНЕНТИ (ВЪТРЕШНИ) ---
const Card = ({ children, title, icon: Icon, className = "" }: any) => (
  <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <Icon size={18} className="text-blue-600" />
        <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide">{title}</h2>
      </div>
    )}
    <div className="p-5">{children}</div>
  </div>
)

const InfoItem = ({ label, value, icon: Icon }: any) => (
  <div>
    <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
      {Icon && <Icon size={10} />} {label}
    </dt>
    <dd className="text-sm font-semibold text-slate-700 mt-1">{value || '—'}</dd>
  </div>
)

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // --- FETCHING DATA (Запазваме оригиналната логика) ---
  const { data: student } = await supabase
    .from('students')
    .select(`*,
      sending_school:sending_schools(name, city),
      therapist_psychologist:staff_profiles!students_therapist_psychologist_id_fkey(id, first_name, middle_name, last_name),
      therapist_speech:staff_profiles!students_therapist_speech_id_fkey(id, first_name, middle_name, last_name),
      therapist_rehab:staff_profiles!students_therapist_rehab_id_fkey(id, first_name, middle_name, last_name)
    `)
    .eq('id', id).single()

  if (!student) notFound()

  const { data: profile } = await supabase.from('staff_profiles').select('id, role, is_coordinator').eq('user_id', user.id).single()
  const { data: currentYear } = await supabase.from('academic_years').select('*').eq('is_current', true).single()
  const { data: enrollment } = await supabase.from('student_enrollments').select('*, class:classes(*)').eq('student_id', id).eq('academic_year_id', currentYear?.id).single()
  const { data: externalMembers } = await supabase.from('eplr_external_members').select('*').eq('student_id', id).eq('academic_year_id', currentYear?.id)
  const { data: eplrDocs } = await supabase.from('eplr_attachments').select('*').eq('student_id', id).eq('academic_year_id', currentYear?.id).order('created_at', { ascending: false })
  const { data: eplr } = await supabase.from('eplr_teams').select(`*, psychologist:staff_profiles!eplr_teams_psychologist_id_fkey(*), speech_therapist:staff_profiles!eplr_teams_speech_therapist_id_fkey(*), rehabilitator:staff_profiles!eplr_teams_rehabilitator_id_fkey(*), class_teacher:staff_profiles!eplr_teams_class_teacher_id_fkey(*)`).eq('student_id', id).eq('academic_year_id', currentYear?.id).single()
  const { data: attachments } = await supabase.from('student_attachments').select('*').eq('student_id', id).order('created_at', { ascending: false })
  const { data: allEnrollments } = await supabase.from('student_enrollments').select('*, class:classes(*), academic_year:academic_years(*)').eq('student_id', id).order('enrolled_at', { ascending: false })
  const { data: guardians } = await supabase.from('student_guardians').select('*').eq('student_id', id).order('relation')
  const { data: oresRecords } = await supabase.from('student_ores').select('*').eq('student_id', id).order('from_date', { ascending: false })
  const { data: coudEnroll } = await supabase.from('coud_enrollments').select('coud_group:coud_groups(name, teacher:staff_profiles(first_name, last_name))').eq('student_id', id).eq('academic_year_id', currentYear?.id).maybeSingle()

  // --- LOGIC ---
  const canManage = ['admin', 'zdud'].includes(profile?.role || '')
  const canEditDossier = canManage || profile?.role === 'secretary'
  const age = student.birth_date ? calculateAge(student.birth_date) : null
  const coudGroup = (coudEnroll as any)?.coud_group
  const activeOres = (oresRecords || []).find(o => {
    const today = new Date().toISOString().split('T')[0]
    return o.from_date <= today && (!o.to_date || o.to_date >= today)
  })

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-700">
      
      {/* TOP NAVIGATION */}
      <div className="flex items-center justify-between">
        <Link href="/students" className="group inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
          <div className="p-2 rounded-full group-hover:bg-blue-50 transition-colors">
            <ArrowLeft size={18} />
          </div>
          Назад към списъка
        </Link>
        <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-tighter">
          Учебна година: {currentYear?.name}
        </div>
      </div>

      {/* HEADER SECTION */}
      <div className="relative bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 opacity-50" />
        
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-[#0f2240] to-[#1e3a5f] flex items-center justify-center text-white text-3xl font-bold shadow-xl">
            {getInitials(student.first_name, student.last_name)}
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                {getFullName(student)}
              </h1>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                  student.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  {student.status === 'active' ? 'Активен' : 'Архив'}
                </span>
                {student.is_new && (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-violet-100 text-violet-700 border border-violet-200">
                    <Sparkles size={10} /> Нов
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8">
              <InfoItem label="Възраст" value={age} />
              <InfoItem label="Паралелка" value={(enrollment?.class as any)?.name} />
              <InfoItem label="Дата на раждане" value={student.birth_date ? formatDate(student.birth_date) : null} />
              <InfoItem label="Форма" value={(enrollment as any)?.education_form === 'ifo' ? 'ИФО' : 'Дневна'} />
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {canManage && (
              <Link href={`/students/${id}/edit`} className="flex-1 md:flex-none justify-center inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
                <Pencil size={16} /> Редактиране
              </Link>
            )}
            {canManage && (
              <Link href={`/students/${id}/eplr`} className="flex-1 md:flex-none justify-center inline-flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-xl text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
                <UserCog size={16} /> ЕПЛР Екип
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Educational Info & Team (4 units) */}
        <div className="lg:col-span-4 space-y-6">
          
          <Card title="Организация на обучението" icon={GraduationCap}>
            <div className="space-y-4">
              <StudentStatusSection
                studentId={id}
                enrollmentId={enrollment?.id || null}
                educationForm={(enrollment as any)?.education_form}
                coudEnrolled={!!coudGroup}
                coudGroupName={coudGroup?.name}
                coudTeacher={coudGroup?.teacher ? `${coudGroup.teacher.first_name} ${coudGroup.teacher.last_name}` : null}
                externalClass={student.external_class}
                oresRecords={oresRecords || []}
                intensity={(student as any).intensity}
                canManage={canManage}
              />
              {activeOres && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3 text-amber-800 text-xs font-bold">
                  <Wifi size={16} /> В момента е в ОРЕС
                </div>
              )}
            </div>
          </Card>

          <Card title="ЕПЛР Екип" icon={Users}>
             <EplrTeam 
              eplr={eplr} 
              id={id} 
              canManage={canManage} 
              externals={externalMembers || []} 
              realPsy={(student as any).therapist_psychologist_id}
              realSpe={(student as any).therapist_speech_id}
              realReh={(student as any).therapist_rehab_id}
            />
          </Card>

          <Card title="Терапевтична подкрепа" icon={Heart}>
            <div className="grid gap-4">
              {[
                { label: 'Психолог', member: (student as any).therapist_psychologist },
                { label: 'Логопед', member: (student as any).therapist_speech },
                { label: 'Рехабилитатор', member: (student as any).therapist_rehab },
              ].map(({ label, member }) => (
                <div key={label} className="flex justify-between items-center group">
                  <span className="text-xs font-bold text-slate-400 uppercase">{label}</span>
                  <span className="text-sm font-semibold text-slate-700">{member ? getFullName(member) : '—'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Documents & History (8 units) */}
        <div className="lg:col-span-8 space-y-6">
          
          <Card title="Документи ЕПЛР (ЦСОП)" icon={FileText}>
            <EplrDocumentsSection
              studentId={student.id}
              academicYearId={currentYear?.id || ''}
              documents={eplrDocs || []}
              canManage={canManage || canEditDossier}
              staffId={profile?.id || ''}
            />
          </Card>

          <Card title="Външна документация" icon={Paperclip}>
            <AttachmentsSection
              studentId={id}
              attachments={attachments || []}
              canManage={canEditDossier}
              staffId={profile?.id || ''}
              typeLabels={{
                enrollment_application: 'Заявление за прием',
                medical_expertise: 'Медицинска експертиза',
                other: 'Друг документ',
              }}
              currentYearName={currentYear?.name || ''}
              yearOptions={[]}
            />
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Настойници" icon={ShieldCheck}>
              <GuardiansSection studentId={id} guardians={guardians || []} canManage={canEditDossier} />
            </Card>
            
            <Card title="История" icon={History}>
              <div className="space-y-3">
                {allEnrollments?.map((e: any) => (
                  <div key={e.id} className={`flex justify-between items-center p-3 rounded-xl border ${e.academic_year_id === currentYear?.id ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                    <span className="text-xs font-bold text-slate-600">{e.academic_year?.name}</span>
                    <span className="text-xs font-medium text-slate-500">Паралелка {e.class?.name}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <StudentDeclarations studentId={id} canManage={canEditDossier} />
        </div>
      </div>

      {/* ARCHIVE REASON FOOTER */}
      {student.status === 'archived' && (
        <div className="p-6 bg-rose-50 border-2 border-rose-100 rounded-3xl flex gap-4 items-center">
          <Archive className="text-rose-500" size={24} />
          <div>
            <h4 className="text-sm font-bold text-rose-900 uppercase tracking-tight">Архивирано досие</h4>
            <p className="text-sm text-rose-700">{student.archive_reason} {student.archived_at && `на ${formatDate(student.archived_at)}`}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// --- СУБ-КОМПОНЕНТ: ЕПЛР ЕКИП (Почистен) ---
function EplrTeam({ eplr, id, canManage, externals, realPsy, realSpe, realReh }: any) {
  if (!eplr) return (
    <div className="text-center py-4">
      <p className="text-xs text-slate-400 italic mb-3">Няма назначен екип</p>
      {canManage && <Link href={`/students/${id}/eplr`} className="text-xs font-bold text-blue-600 hover:text-blue-700 underline underline-offset-4">+ Назначи сега</Link>}
    </div>
  )

  const roles = [
    { label: 'Психолог', member: eplr.psychologist, isReal: eplr.psychologist?.id === realPsy },
    { label: 'Логопед', member: eplr.speech_therapist, isReal: eplr.speech_therapist?.id === realSpe },
    { label: 'Рехабилитатор', member: eplr.rehabilitator, isReal: eplr.rehabilitator?.id === realReh },
    { label: 'Класен ръководител', member: eplr.class_teacher, isReal: false },
  ]

  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <div key={role.label} className="flex flex-col border-b border-slate-50 pb-2 last:border-0">
          <span className="text-[9px] font-black text-slate-400 uppercase">{role.label}</span>
          <span className={`text-sm ${role.isReal ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
            {role.member ? getFullName(role.member) : '—'}
          </span>
        </div>
      ))}
      {externals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <span className="text-[9px] font-black text-blue-500 uppercase block mb-2">Външни членове</span>
          {externals.map((ext: any) => (
            <div key={ext.id} className="text-sm font-medium text-slate-700">{ext.full_name}</div>
          ))}
        </div>
      )}
    </div>
  )
}
