// Профил на служител — същият изглед като „Моят профил“ (карта отгоре, Обзор · Данни · Класове и ученици · Оценяване · Портфолио).
// Управата вижда всичко и определя класния; колегите виждат само визитката (роля, контакти, паралелки).
// Ако отварям себе си → „Моят профил“.
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, CalendarClock, BookOpen, Mail, Phone, Users } from 'lucide-react'
import { ROLE_LABELS, type UserRole } from '@/types'
import { getFullName } from '@/lib/utils'
import StaffProfileView from '@/components/profile/StaffProfileView'
import { Hero, Card, Row } from '@/app/profile/parts'
import StaffClassesSection from './StaffClassesSection'
export const dynamic = 'force-dynamic'

const MGMT = ['admin', 'zdud', 'director']
const CAN_BE_CLASS_TEACHER = ['class_teacher', 'psychologist', 'speech_therapist', 'rehabilitator', 'educator']
const THER = ['psychologist', 'speech_therapist', 'rehabilitator']

export default async function StaffDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: viewer } = await supabase.from('staff_profiles').select('id, role').eq('user_id', user.id).single()
  if (viewer?.id === id) redirect(sp.tab ? `/profile?tab=${sp.tab}` : '/profile')
  const { data: staff } = await supabase.from('staff_profiles').select('*').eq('id', id).single()
  if (!staff) notFound()
  const { data: year } = await supabase.from('academic_years').select('id, name').eq('is_current', true).single()

  const isMgmt = MGMT.includes(viewer?.role || '')
  const roleLabel = ROLE_LABELS[staff.role as UserRole] || staff.role
  const back = (
    <Link href={isMgmt ? '/staff' : '/dashboard'} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
      <ArrowLeft size={15} /> {isMgmt ? 'Служители' : 'Начало'}
    </Link>
  )

  // Паралелки като класен (видимо за всички — „при кого е паралелката“)
  const { data: myCls } = await supabase.from('class_teacher_assignments')
    .select('id, class_id, class:classes(id, name)').eq('staff_id', id).eq('academic_year_id', year?.id)
  const assigned = ((myCls || []) as any[]).filter(a => a.class).map(a => ({ assignmentId: a.id, classId: a.class.id, name: a.class.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg', { numeric: true }))

  // ── Колега (не от управата): визитка ──
  if (!isMgmt) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5">
        {back}
        <Hero name={getFullName(staff)} initials={`${staff.first_name?.charAt(0) || ''}${staff.last_name?.charAt(0) || ''}`}
          photo={(staff as any).photo_url} subtitle={staff.position || roleLabel} kicker="Служител"
          badges={[{ label: roleLabel }, ...(staff.is_coordinator ? [{ label: 'Координатор', tone: 'accent' as const }] : []), ...assigned.map(c => ({ label: `Класен на ${c.name}` }))]}
          email={staff.email} phone={(staff as any).phone} />
        <Card title="Връзка" icon={<Users size={16} />}>
          <dl>
            <Row l="Длъжност" v={staff.position || roleLabel} />
            <Row l="Служебен имейл" v={staff.email ? <a href={`mailto:${staff.email}`} className="text-sky-700 hover:underline inline-flex items-center gap-1"><Mail size={12} />{staff.email}</a> : null} />
            <Row l="Телефон" v={(staff as any).phone ? <a href={`tel:${String((staff as any).phone).replace(/\s/g, '')}`} className="text-[#0f2240] hover:underline inline-flex items-center gap-1"><Phone size={12} />{(staff as any).phone}</a> : null} />
            <Row l="Класен на" v={assigned.length ? <span className="flex flex-wrap gap-1.5">{assigned.map(c => <Link key={c.classId} href={`/classes/${c.classId}`} className="inline-flex items-center gap-1 text-[#0f2240] hover:underline"><BookOpen size={12} />{c.name}</Link>)}</span> : null} />
          </dl>
        </Card>
      </div>
    )
  }

  // ── Управата: пълният профил + определяне за класен + бутони ──
  let workExtra: React.ReactNode = null
  if (CAN_BE_CLASS_TEACHER.includes(staff.role) || assigned.length > 0) {
    const [{ data: allClasses }, { data: taken }] = await Promise.all([
      supabase.from('classes').select('id, name').eq('academic_year_id', year?.id).order('name'),
      supabase.from('class_teacher_assignments').select('class_id, staff_id, staff:staff_profiles(first_name, middle_name, last_name)').eq('academic_year_id', year?.id),
    ])
    const takenMap: Record<string, string> = {}
    ;((taken || []) as any[]).forEach(a => { if (a.staff_id !== id) takenMap[a.class_id] = a.staff ? getFullName(a.staff) : 'зает' })
    workExtra = (
      <StaffClassesSection staffId={id} academicYearId={year?.id || ''} assigned={assigned}
        options={((allClasses || []) as any[]).map(c => ({ id: c.id, name: c.name, takenBy: takenMap[c.id] || null }))}
        canManage={['admin', 'zdud'].includes(viewer?.role || '')} />
    )
  }
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12.5px] bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
  const hasSchedule = !['secretary', 'admin', 'director', 'support'].includes(staff.role)
  const heroActions = (
    <>
      {hasSchedule && <Link href={`${THER.includes(staff.role) ? '/my-activities/schedule' : '/my-schedule'}?staff=${id}`} className={btn}><CalendarClock size={13} /> Разписание</Link>}
      {viewer?.role === 'admin' && <Link href={`/admin/staff?edit=${id}`} className={btn}><Pencil size={13} /> Редактирай (акаунт, роля)</Link>}
    </>
  )
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-4">{back}</div>
      <StaffProfileView supabase={supabase} me={staff} tab={sp.tab} self={false} workExtra={workExtra} heroActions={heroActions} />
    </div>
  )
}
