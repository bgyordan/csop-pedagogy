'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserSearch, X, CalendarClock, ArrowRight, Users, GraduationCap } from 'lucide-react'
interface StaffRow {
  id: string
  first_name: string
  last_name: string
  role: string
}
interface StudentRow {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  className: string | null
  form: string | null
}
const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор', director: 'Директор', zdud: 'ЗДУД',
  secretary: 'Деловодител', psychologist: 'Психолог', speech_therapist: 'Логопед',
  rehabilitator: 'Рехабилитатор', class_teacher: 'Класен ръководител', educator: 'Възпитател',
}
const THERAPIST_ROLES = ['psychologist', 'speech_therapist', 'rehabilitator']
type Mode = 'staff' | 'student'
export default function StaffScheduleSearch() {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>('staff')
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('staff_profiles')
      .select('id, first_name, last_name, role')
      .eq('is_active', true)
      .order('first_name')
      .then(({ data }) => setStaff(data || []))
  }, [])

  // Учениците се зареждат лениво при първо превключване
  async function loadStudents() {
    if (loaded) return
    const { data: currentYear } = await supabase
      .from('academic_years').select('id').eq('is_current', true).single()
    const { data } = await supabase
      .from('student_enrollments')
      .select('education_form, student:students(id, first_name, middle_name, last_name, status), class:classes(name)')
      .eq('academic_year_id', currentYear?.id)
    const rows: StudentRow[] = (data || [])
      .filter((e: any) => e.student && e.student.status === 'active')
      .map((e: any) => ({
        id: e.student.id,
        first_name: e.student.first_name,
        middle_name: e.student.middle_name,
        last_name: e.student.last_name,
        className: e.class?.name || null,
        form: e.education_form || null,
      }))
      .sort((a, b) => a.first_name.localeCompare(b.first_name, 'bg'))
    setStudents(rows)
    setLoaded(true)
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function switchMode(m: Mode) {
    setMode(m)
    setSearch('')
    setOpen(false)
    if (m === 'student') loadStudents()
  }

  const filteredStaff = search.trim()
    ? staff.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()))
    : staff
  const filteredStudents = search.trim()
    ? students.filter(s => `${s.first_name} ${s.middle_name || ''} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()))
    : students

  function goStaff(s: StaffRow) {
    const href = THERAPIST_ROLES.includes(s.role)
      ? `/my-activities/schedule?staff=${s.id}`
      : `/my-schedule?staff=${s.id}`
    router.push(href)
  }
  function goStudent(s: StudentRow) {
    router.push(`/students/${s.id}/schedule?from=schedules`)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm" ref={boxRef}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0f2240]/10 flex items-center justify-center flex-shrink-0">
            <CalendarClock size={16} className="text-[#0f2240]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800">Бърз преглед на разписание</h3>
            <p className="text-[11px] text-slate-400 truncate">Избери {mode === 'staff' ? 'служител' : 'ученик'}, за да видиш разписанието</p>
          </div>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
          <button type="button" onClick={() => switchMode('staff')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'staff' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Users size={13} /> Служители
          </button>
          <button type="button" onClick={() => switchMode('student')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'student' ? 'bg-white text-[#0f2240] shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <GraduationCap size={13} /> Ученици
          </button>
        </div>
      </div>
      <div className="relative">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={mode === 'staff' ? 'Търси служител по име...' : 'Търси ученик по име...'}
          className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        {search && (
          <button type="button" onClick={() => { setSearch(''); setOpen(false) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        )}
        {open && mode === 'staff' && filteredStaff.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {filteredStaff.map(s => (
              <button key={s.id} type="button" onClick={() => goStaff(s)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{s.first_name} {s.last_name}</div>
                  <div className="text-[11px] text-slate-400">{ROLE_LABELS[s.role] || s.role}</div>
                </div>
                <ArrowRight size={14} className="text-blue-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
        {open && mode === 'student' && filteredStudents.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {filteredStudents.map(s => (
              <button key={s.id} type="button" onClick={() => goStudent(s)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{s.first_name} {s.middle_name ? s.middle_name + ' ' : ''}{s.last_name}</div>
                  <div className="text-[11px] text-slate-400">
                    {s.form === 'ifo' ? 'ИФО' : s.className ? `Паралелка ${s.className}` : 'без клас'}
                  </div>
                </div>
                <ArrowRight size={14} className="text-blue-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
        {open && search.trim() && ((mode === 'staff' && filteredStaff.length === 0) || (mode === 'student' && filteredStudents.length === 0)) && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm text-slate-400">
            Няма намерен {mode === 'staff' ? 'служител' : 'ученик'}
          </div>
        )}
      </div>
    </div>
  )
}
