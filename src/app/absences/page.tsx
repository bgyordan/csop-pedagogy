import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getMonthName, getFullName } from '@/lib/utils'
import OutreachBadge from '@/components/OutreachBadge'
import { iupPeriod, inIup, IUP_OPEN_DAY, IUP_CLOSE_DAY } from '@/lib/iup-period'

export default async function AbsencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role, id')
    .eq('user_id', user.id)
    .single()

  const { data: currentYear } = await supabase
    .from('academic_years').select('*').eq('is_current', true).single()

  // Едно правило за периода (lib/iup-period): 27-ми – 8-ми; септември и октомври — два отделни отчета в прозореца 27.10–8.11
  const P = iupPeriod()
  const isSummer = P.offSeason
  const isActivePeriod = P.open
  const deadlinePassed = P.overdue
  const months = P.months                                       // [септември, октомври] или [ноември]…
  const nextMonth = P.month === 12 ? 1 : P.month + 1            // месецът на срока (8-ми)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  // следващият прозорец (за съобщението към класните извън периода)
  const nextReport = P.offSeason ? P.month : (P.month === 6 ? 10 : P.month === 12 ? 1 : P.month + 1)
  const nextWindow = `${IUP_OPEN_DAY} ${getMonthName(nextReport)} до ${IUP_CLOSE_DAY} ${getMonthName(nextReport === 12 ? 1 : nextReport + 1)}`

  const isAdmin = ['admin', 'zdud', 'director'].includes(profile?.role || '')

  // Лятна ваканция и септември — показваме съобщение на всички
  if (isSummer && !isAdmin) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-2">Реализация на ИУП</h1>
        <p className="text-slate-500 text-sm mb-8">{currentYear?.name}</p>
        <div className="card text-center py-12">
          <p className="text-slate-500 text-sm">
            Сега няма отворен отчет за реализация на ИУП. За <strong>юли</strong> и <strong>август</strong> отчет няма.
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Отчетите за <strong>септември</strong> и за <strong>октомври</strong> (два отделни) се въвеждат от {IUP_OPEN_DAY} октомври до {IUP_CLOSE_DAY} ноември.
          </p>
        </div>
      </div>
    )
  }

  let classes: any[] = []

  if (isAdmin) {
    const { data } = await supabase
      .from('classes').select('*').eq('academic_year_id', currentYear?.id).order('name')
    classes = data || []
  } else if (profile?.role === 'class_teacher') {
    const { data } = await supabase
      .from('class_teacher_assignments')
      .select('class:classes(*)')
      .eq('staff_id', profile.id)
      .eq('academic_year_id', currentYear?.id)
    classes = data?.map((d: any) => d.class).filter(Boolean) || []
  }

  classes = classes.filter((c: any) => inIup(c.name))

  const classIds = classes.map((c: any) => c.id)
  const [{ data: submitted }, { data: cta }, { data: enr }] = await Promise.all([
    supabase.from('monthly_absences')
      .select('class_id, month, submitted_at, entries:absence_entries(count)')
      .eq('year', P.year)
      .in('month', months.map(m => m.month)),
    isAdmin && classIds.length
      ? supabase.from('class_teacher_assignments').select('class_id, staff:staff_profiles(first_name, last_name, is_active)')
          .eq('academic_year_id', currentYear?.id).in('class_id', classIds)
      : Promise.resolve({ data: [] as any[] }),
    isAdmin && classIds.length
      ? supabase.from('student_enrollments').select('class_id, student:students!inner(status)')
          .eq('academic_year_id', currentYear?.id).in('class_id', classIds).is('left_at', null).eq('student.status', 'active')
      : Promise.resolve({ data: [] as any[] }),
  ])

  // подадено ли е за паралелка + месец (+ кога и за колко деца)
  const sub = new Map<string, { at: string | null; n: number }>()
  ;(submitted || []).forEach((s: any) => sub.set(`${s.class_id}-${s.month}`, { at: s.submitted_at, n: s.entries?.[0]?.count ?? 0 }))
  const isDone = (classId: string, month: number) => sub.has(`${classId}-${month}`)
  const subInfo = (classId: string, month: number) => sub.get(`${classId}-${month}`)
  const ddmm = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Sofia' }) : ''

  // класен ръководител(и) и брой деца СЕГА в паралелката
  const teachers = new Map<string, string[]>()
  ;(cta || []).forEach((a: any) => {
    if (!a.staff || a.staff.is_active === false) return
    if (!teachers.has(a.class_id)) teachers.set(a.class_id, [])
    teachers.get(a.class_id)!.push(getFullName(a.staff))
  })
  const kids = new Map<string, number>()
  ;(enr || []).forEach((e: any) => kids.set(e.class_id, (kids.get(e.class_id) || 0) + 1))

  // Извън активен период — само класен вижда това съобщение
  if (!isActivePeriod && !isAdmin) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800 mb-2">Реализация на ИУП</h1>
        <p className="text-slate-500 text-sm mb-8">{currentYear?.name}</p>
        <div className="card text-center py-12">
          <p className="text-slate-500 text-sm">
            Периодът за въвеждане е от <strong>{IUP_OPEN_DAY}-ми</strong> до <strong>{IUP_CLOSE_DAY}-ми на следващия месец</strong>.
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Следващ период: от {nextWindow}
          </p>
        </div>
      </div>
    )
  }

  const Badge = ({ ok, small }: { ok: boolean; small?: boolean }) => ok ? (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium bg-green-100 text-green-700 ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1 text-xs'}`}>✓ Въведено</span>
  ) : (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1 text-xs'} ${
      deadlinePassed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
    }`}>{deadlinePassed ? '⚠ Просрочено' : '— Невъведено'}</span>
  )

  return (
    <div className="p-4 md:p-8">
     <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Реализация на ИУП</h1>
          <p className="text-slate-500 text-sm mt-1 flex flex-wrap gap-x-2">
            <span>{currentYear?.name}</span>
            <span>· {months.length > 1 ? 'Отчети' : 'Месец'}: <strong>{cap(P.label)}</strong></span>
            <span>· Срок: <strong className={deadlinePassed ? 'text-red-600' : 'text-green-600'}>
              до {IUP_CLOSE_DAY} {getMonthName(nextMonth)}
            </strong></span>
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {months.map(m => (
              <a key={m.month} href={`/absences/export/${m.month}/${m.year}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white flex-shrink-0 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#0f6e56' }}>
                📊 Excel — {m.label}
              </a>
            ))}
          </div>
        )}
      </div>
      {isAdmin ? (
        <>
          {/* ДЕСКТОП: таблица — паралелка, класен, деца + по една колона за всеки отчет на прозореца */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Паралелка</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Класен ръководител</th>
                  <th className="text-center px-3 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Деца</th>
                  {months.map(m => (
                    <th key={m.month} className="text-center px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {cap(m.label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((cls, idx) => (
                  <tr key={cls.id}
                      className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                      {cls.name} {cls.outreach_location && <OutreachBadge location={cls.outreach_location} size="xs" />}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 font-light">{(teachers.get(cls.id) || []).join(', ') || <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600">{kids.get(cls.id) || 0}</td>
                    {months.map(m => {
                      const info = subInfo(cls.id, m.month)
                      const n = kids.get(cls.id) || 0
                      return (
                        <td key={m.month} className="px-4 py-2.5 text-center">
                          <Link href={`/absences/${cls.id}/${m.month}`} className="inline-flex flex-col items-center hover:opacity-80" title={`Преглед — ${m.label}`}>
                            <Badge ok={!!info} />
                            {info && (
                              <span className={`text-[11px] mt-0.5 ${info.n !== n ? 'text-amber-600' : 'text-slate-400'}`}
                                title={info.n !== n ? 'Броят деца в отчета се различава от сегашния списък на паралелката' : ''}>
                                {ddmm(info.at)} · {info.n} деца
                              </span>
                            )}
                          </Link>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>

          {/* МОБИЛЕН: карти */}
          <div className="md:hidden space-y-2">
            {classes.map(cls => (
              <div key={cls.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-800">Пар. {cls.name}</span>
                  {cls.outreach_location && <OutreachBadge location={cls.outreach_location} size="xs" />}
                  <span className="ml-auto text-xs text-slate-400 font-light truncate">{(teachers.get(cls.id) || []).join(', ')} · {kids.get(cls.id) || 0} деца</span>
                </div>
                {months.map(m => (
                  <Link key={m.month} href={`/absences/${cls.id}/${m.month}`}
                    className="flex items-center justify-between gap-3 text-sm text-slate-600 hover:text-[#0f2240]">
                    <span>{cap(m.label)}</span>
                    <span className="flex items-center gap-2"><Badge ok={isDone(cls.id, m.month)} small /><span className="text-slate-300">›</span></span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        // Класен ръководител — по един ред за всеки отчет (септември и октомври са отделни)
        <div className="grid gap-4">
          {classes.map(cls => (
            <div key={cls.id} className="card">
              <h2 className="font-medium text-slate-700 mb-4">Паралелка {cls.name}</h2>
              <div className="space-y-2">
                {months.map(m => (
                  <Link key={m.month}
                    href={`/absences/${cls.id}/${m.month}`}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-slate-700">{cap(m.label)} {m.year}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Срок до {IUP_CLOSE_DAY} {getMonthName(nextMonth)}</div>
                    </div>
                    <span className={`text-xs font-medium px-3 py-1 rounded-full flex-shrink-0 ${
                      isDone(cls.id, m.month) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {isDone(cls.id, m.month) ? '✓ Въведено' : '— Невъведено'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
