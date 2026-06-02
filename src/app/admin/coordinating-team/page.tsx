'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { useToast } from '@/components/ui/Toast'
import { getFullName, formatDate } from '@/lib/utils'
import { Plus, X, Star, Calendar, Download } from 'lucide-react'
import { generateCommitteeProtocol } from '@/lib/docx-generator'

interface TeamMember {
  id: string
  staff_id: string
  role_in_team: string | null
  staff: {
    first_name: string
    middle_name?: string
    last_name: string
    role: string
    position?: string
  }
}

interface Session {
  id: string
  session_date: string
  agenda: string | null
  protocol: string | null
  decisions: string | null
  deadline: string | null
}

interface StaffMember {
  id: string
  first_name: string
  middle_name?: string
  last_name: string
  role: string
  position?: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор', director: 'Директор', zdud: 'ЗДУД',
  coordinator: 'Координатор', psychologist: 'Психолог',
  speech_therapist: 'Логопед', rehabilitator: 'Рехабилитатор',
  class_teacher: 'Класен ръководител',
}

export default function CoordinatingTeamPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [currentYearId, setCurrentYearId] = useState('')
  const [currentYearName, setCurrentYearName] = useState('')
  const [loading, setLoading] = useState(true)

  // Форма за член
  const [selectedStaff, setSelectedStaff] = useState('')
  const [roleInTeam, setRoleInTeam] = useState('')
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [savingMember, setSavingMember] = useState(false)

  // Форма за заседание
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [savingSession, setSavingSession] = useState(false)
  const [sessionForm, setSessionForm] = useState({
    session_date: new Date().toISOString().split('T')[0],
    agenda: '', protocol: '', decisions: '', deadline: '',
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: year } = await supabase
      .from('academic_years').select('id, name').eq('is_current', true).single()

    if (!year) { setLoading(false); return }
    setCurrentYearId(year.id)
    setCurrentYearName(year.name)

    const [{ data: teamData }, { data: staffData }, { data: sessionData }] = await Promise.all([
      supabase.from('coordinating_team')
        .select('*, staff:staff_profiles(first_name, middle_name, last_name, role, position)')
        .eq('academic_year_id', year.id).order('created_at'),
      supabase.from('staff_profiles')
        .select('id, first_name, middle_name, last_name, role, position')
        .eq('is_active', true).order('last_name'),
      supabase.from('coordinating_team_sessions')
        .select('*').eq('academic_year_id', year.id)
        .order('session_date', { ascending: true }),
    ])

    setMembers(teamData || [])
    setAllStaff(staffData || [])
    setSessions(sessionData || [])
    setLoading(false)
  }

  const availableStaff = allStaff.filter(s => !members.find(m => m.staff_id === s.id))

  async function handleAddMember() {
    if (!selectedStaff) { toast('Избери служител', 'error'); return }
    setSavingMember(true)

    const { data, error } = await supabase
      .from('coordinating_team')
      .insert({ staff_id: selectedStaff, academic_year_id: currentYearId, role_in_team: roleInTeam || null })
      .select('*, staff:staff_profiles(first_name, middle_name, last_name, role, position)')
      .single()

    if (error) { toast('Грешка при добавяне', 'error'); setSavingMember(false); return }

    await supabase.from('staff_profiles').update({ role: 'coordinator' }).eq('id', selectedStaff)

    setMembers(prev => [...prev, data])
    setSelectedStaff('')
    setRoleInTeam('')
    setShowMemberForm(false)
    setSavingMember(false)
    toast('Членът е добавен и ролята е обновена на Координатор')
  }

  async function handleRemoveMember(member: TeamMember) {
    if (!confirm(`Премахни ${getFullName(member.staff)} от координиращия екип?`)) return
    const { error } = await supabase.from('coordinating_team').delete().eq('id', member.id)
    if (error) { toast('Грешка', 'error'); return }
    setMembers(prev => prev.filter(m => m.id !== member.id))
    toast('Членът е премахнат')
  }

  async function handleAddSession() {
    if (!sessionForm.session_date) { toast('Въведи дата', 'error'); return }
    setSavingSession(true)

    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('staff_profiles').select('id').eq('user_id', user.user?.id!).single()

    const { data, error } = await supabase
      .from('coordinating_team_sessions')
      .insert({
        academic_year_id: currentYearId,
        session_date: sessionForm.session_date,
        agenda: sessionForm.agenda || null,
        protocol: sessionForm.protocol || null,
        decisions: sessionForm.decisions || null,
        deadline: sessionForm.deadline || null,
        created_by: profile?.id,
      })
      .select().single()

    if (error) { toast('Грешка при запис', 'error'); setSavingSession(false); return }

    setSessions(prev => [...prev, data])
    setSessionForm({ session_date: new Date().toISOString().split('T')[0], agenda: '', protocol: '', decisions: '', deadline: '' })
    setShowSessionForm(false)
    setSavingSession(false)
    toast('Заседанието е записано')
  }

  async function handleDownloadProtocol(session: Session, idx: number) {
    await generateCommitteeProtocol(
      { name: 'Координиращ екип' },
      session,
      members.map(m => ({ staff: m.staff, role: m.role_in_team })),
      idx + 1,
      currentYearName
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Координиращ екип</h1>
        <p className="text-slate-500 text-sm mt-1">{currentYearName}</p>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-slate-400 text-sm">Зареждане...</div>
      ) : (
        <div className="space-y-6">
          {/* ── ЧЛЕНОВЕ ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-indigo-500" />
                <h2 className="font-medium text-slate-700 text-sm">Членове ({members.length})</h2>
              </div>
              {!showMemberForm && (
                <button onClick={() => setShowMemberForm(true)}
                  className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
                  <Plus size={12} /> Добави
                </button>
              )}
            </div>

            {showMemberForm && (
              <div className="mb-4 p-3 bg-indigo-50 rounded-lg space-y-2">
                <select className="input text-sm w-full" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                  <option value="">— Избери служител —</option>
                  {availableStaff.map(s => (
                    <option key={s.id} value={s.id}>{getFullName(s)} — {ROLE_LABELS[s.role] || s.role}</option>
                  ))}
                </select>
                <input className="input text-sm w-full" placeholder="Роля в екипа (Председател, Секретар...)"
                  value={roleInTeam} onChange={e => setRoleInTeam(e.target.value)} />
                <p className="text-xs text-indigo-600">ℹ️ Ролята на служителя се обновява автоматично на Координатор</p>
                <div className="flex gap-2">
                  <button onClick={handleAddMember} disabled={savingMember}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: '#0f2240' }}>
                    {savingMember ? 'Запазване...' : 'Добави'}
                  </button>
                  <button onClick={() => { setShowMemberForm(false); setSelectedStaff(''); setRoleInTeam('') }}
                    className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 hover:bg-slate-100">
                    Отказ
                  </button>
                </div>
              </div>
            )}

            {members.length === 0 ? (
              <p className="text-sm text-slate-400">Няма определени членове</p>
            ) : (
              <div className="space-y-2">
                {members.map((member, idx) => (
                  <div key={member.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg ${idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                        {member.staff.first_name?.charAt(0)}{member.staff.last_name?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{getFullName(member.staff)}</div>
                        <div className="text-xs text-slate-400">
                          {member.role_in_team && <span className="text-indigo-600 font-medium">{member.role_in_team} · </span>}
                          {member.staff.position || ROLE_LABELS[member.staff.role] || member.staff.role}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveMember(member)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── ЗАСЕДАНИЯ ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-400" />
                <h2 className="font-medium text-slate-700 text-sm">Заседания</h2>
              </div>
              {!showSessionForm && (
                <button onClick={() => setShowSessionForm(true)}
                  className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
                  <Plus size={12} /> Ново заседание
                </button>
              )}
            </div>

            {showSessionForm && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg space-y-3">
                <div>
                  <label className="label">Дата <span className="text-red-500">*</span></label>
                  <input type="date" className="input" value={sessionForm.session_date}
                    onChange={e => setSessionForm(p => ({ ...p, session_date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Дневен ред</label>
                  <textarea rows={3} className="input resize-y" placeholder="Точки от дневния ред..."
                    value={sessionForm.agenda}
                    onChange={e => setSessionForm(p => ({ ...p, agenda: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Протокол</label>
                  <textarea rows={3} className="input resize-y" placeholder="Съдържание на протокола..."
                    value={sessionForm.protocol}
                    onChange={e => setSessionForm(p => ({ ...p, protocol: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Решения</label>
                  <textarea rows={3} className="input resize-y" placeholder="Взети решения..."
                    value={sessionForm.decisions}
                    onChange={e => setSessionForm(p => ({ ...p, decisions: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Срок за изпълнение</label>
                  <input type="date" className="input" value={sessionForm.deadline}
                    onChange={e => setSessionForm(p => ({ ...p, deadline: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddSession} disabled={savingSession}
                    className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: '#0f2240' }}>
                    {savingSession ? 'Запазване...' : 'Запази заседанието'}
                  </button>
                  <button onClick={() => setShowSessionForm(false)}
                    className="px-4 py-2 rounded-lg text-sm border border-slate-200 hover:bg-slate-50">
                    Отказ
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {sessions.map((session, idx) => (
                <div key={session.id} className="p-4 border border-slate-100 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      Протокол № {idx + 1} / {formatDate(session.session_date)}
                    </span>
                    <div className="flex items-center gap-2">
                      {session.deadline && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Срок: {formatDate(session.deadline)}
                        </span>
                      )}
                      <button onClick={() => handleDownloadProtocol(session, idx)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
                        <Download size={12} />
                        Word
                      </button>
                    </div>
                  </div>
                  {session.agenda && (
                    <div className="text-xs text-slate-500 mb-1">
                      <span className="font-medium">Дневен ред:</span> {session.agenda}
                    </div>
                  )}
                  {session.decisions && (
                    <div className="text-xs text-slate-500">
                      <span className="font-medium">Решения:</span> {session.decisions}
                    </div>
                  )}
                </div>
              ))}
              {sessions.length === 0 && <p className="text-sm text-slate-400">Няма заседания</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
