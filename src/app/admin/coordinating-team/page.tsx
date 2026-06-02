'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { useToast } from '@/components/ui/Toast'
import { getFullName } from '@/lib/utils'
import { Plus, X, Star } from 'lucide-react'

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
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [currentYearId, setCurrentYearId] = useState('')
  const [currentYearName, setCurrentYearName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedStaff, setSelectedStaff] = useState('')
  const [roleInTeam, setRoleInTeam] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: year } = await supabase
      .from('academic_years').select('id, name').eq('is_current', true).single()

    if (!year) { setLoading(false); return }
    setCurrentYearId(year.id)
    setCurrentYearName(year.name)

    const [{ data: teamData }, { data: staffData }] = await Promise.all([
      supabase.from('coordinating_team')
        .select('*, staff:staff_profiles(first_name, middle_name, last_name, role, position)')
        .eq('academic_year_id', year.id)
        .order('created_at'),
      supabase.from('staff_profiles')
        .select('id, first_name, middle_name, last_name, role, position')
        .eq('is_active', true).order('last_name'),
    ])

    setMembers(teamData || [])
    setAllStaff(staffData || [])
    setLoading(false)
  }

  const availableStaff = allStaff.filter(s => !members.find(m => m.staff_id === s.id))

  async function handleAdd() {
    if (!selectedStaff) { toast('Избери служител', 'error'); return }
    setSaving(true)

    const { data, error } = await supabase
      .from('coordinating_team')
      .insert({
        staff_id: selectedStaff,
        academic_year_id: currentYearId,
        role_in_team: roleInTeam || null,
      })
      .select('*, staff:staff_profiles(first_name, middle_name, last_name, role, position)')
      .single()

    if (error) { toast('Грешка при добавяне', 'error'); setSaving(false); return }

    // Обнови ролята на служителя на coordinator
    await supabase.from('staff_profiles')
      .update({ role: 'coordinator' })
      .eq('id', selectedStaff)

    setMembers(prev => [...prev, data])
    setSelectedStaff('')
    setRoleInTeam('')
    setShowForm(false)
    setSaving(false)
    toast('Членът е добавен и ролята е обновена на Координатор')
  }

  async function handleRemove(member: TeamMember) {
    if (!confirm(`Премахни ${getFullName(member.staff)} от координиращия екип?`)) return

    const { error } = await supabase
      .from('coordinating_team').delete().eq('id', member.id)

    if (error) { toast('Грешка', 'error'); return }

    setMembers(prev => prev.filter(m => m.id !== member.id))
    toast('Членът е премахнат')
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <BackButton />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Координиращ екип</h1>
          <p className="text-slate-500 text-sm mt-1">{currentYearName}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#0f2240' }}>
            <Plus size={16} />
            Добави член
          </button>
        )}
      </div>

      {/* Форма за добавяне */}
      {showForm && (
        <div className="card mb-6 border-2 border-indigo-100">
          <h2 className="font-medium text-slate-700 text-sm mb-4">Нов член на координиращия екип</h2>
          <div className="space-y-3">
            <div>
              <label className="label">Служител <span className="text-red-500">*</span></label>
              <select className="input" value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}>
                <option value="">— Избери служител —</option>
                {availableStaff.map(s => (
                  <option key={s.id} value={s.id}>
                    {getFullName(s)} — {ROLE_LABELS[s.role] || s.role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Роля в екипа</label>
              <input className="input" placeholder="напр. Председател, Секретар..."
                value={roleInTeam} onChange={e => setRoleInTeam(e.target.value)} />
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
              ℹ️ При добавяне ролята на служителя автоматично се обновява на <strong>Координатор</strong> — той получава достъп до матрицата за разпределение и справките.
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleAdd} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: '#0f2240' }}>
                {saving ? 'Запазване...' : 'Добави'}
              </button>
              <button onClick={() => { setShowForm(false); setSelectedStaff(''); setRoleInTeam('') }}
                className="px-4 py-2 rounded-lg text-sm border border-slate-200 hover:bg-slate-50">
                Отказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Списък с членове */}
      {loading ? (
        <div className="card text-center py-12 text-slate-400 text-sm">Зареждане...</div>
      ) : members.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <Star size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Няма определен координиращ екип за {currentYearName}</p>
          <p className="text-xs mt-1">Добави членовете чрез бутона горе</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="divide-y divide-slate-100">
            {members.map((member, idx) => (
              <div key={member.id} className={`flex items-center justify-between px-4 py-3 gap-3 ${idx % 2 === 1 ? 'bg-slate-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
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
                <button onClick={() => handleRemove(member)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
