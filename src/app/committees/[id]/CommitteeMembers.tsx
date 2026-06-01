'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, X, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getFullName } from '@/lib/utils'

interface Member {
  id: string
  staff_id: string
  role: string | null
  staff: any
}

interface StaffMember {
  id: string
  first_name: string
  middle_name?: string
  last_name: string
  role: string
}

interface Props {
  committeeId: string
  members: Member[]
  allStaff: StaffMember[]
  canManage: boolean
}

export function CommitteeMembers({ committeeId, members: initial, allStaff, canManage }: Props) {
  const supabase = createClient()
  const { toast } = useToast()
  const [members, setMembers] = useState<Member[]>(initial)
  const [selectedStaff, setSelectedStaff] = useState('')
  const [memberRole, setMemberRole] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const availableStaff = allStaff.filter(s => !members.find(m => m.staff_id === s.id))

  async function handleAdd() {
    if (!selectedStaff) { toast('Избери служител', 'error'); return }
    setAdding(true)

    const { data, error } = await supabase
      .from('committee_members')
      .insert({
        committee_id: committeeId,
        staff_id: selectedStaff,
        role: memberRole || null,
      })
      .select('*, staff:staff_profiles(*)')
      .single()

    if (error) { toast('Грешка при добавяне', 'error'); setAdding(false); return }

    setMembers(prev => [...prev, data])
    setSelectedStaff('')
    setMemberRole('')
    setShowForm(false)
    setAdding(false)
    toast('Членът е добавен')
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Премахни члена от комисията?')) return

    const { error } = await supabase
      .from('committee_members').delete().eq('id', memberId)

    if (error) { toast('Грешка', 'error'); return }

    setMembers(prev => prev.filter(m => m.id !== memberId))
    toast('Членът е премахнат')
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-slate-400" />
          <h2 className="font-medium text-slate-700 text-sm">Членове ({members.length})</h2>
        </div>
        {canManage && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
            <Plus size={12} />
            Добави
          </button>
        )}
      </div>

      {/* Форма за добавяне */}
      {showForm && canManage && (
        <div className="mb-4 p-3 bg-slate-50 rounded-lg space-y-2">
          <select className="input text-sm w-full" value={selectedStaff}
            onChange={e => setSelectedStaff(e.target.value)}>
            <option value="">— Избери служител —</option>
            {availableStaff.map(s => (
              <option key={s.id} value={s.id}>{getFullName(s)}</option>
            ))}
          </select>
          <input
            className="input text-sm w-full"
            placeholder="Роля в комисията (по избор)..."
            value={memberRole}
            onChange={e => setMemberRole(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={adding}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: '#0f2240' }}>
              {adding ? 'Добавяне...' : 'Добави'}
            </button>
            <button onClick={() => { setShowForm(false); setSelectedStaff(''); setMemberRole('') }}
              className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 hover:bg-slate-100">
              Отказ
            </button>
          </div>
        </div>
      )}

      {/* Списък с членове */}
      <div className="space-y-2">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-600 flex-shrink-0">
              {m.staff?.first_name?.charAt(0)}{m.staff?.last_name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700 truncate">{getFullName(m.staff)}</div>
              {m.role && <div className="text-xs text-slate-400">{m.role}</div>}
            </div>
            {canManage && (
              <button onClick={() => handleRemove(m.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-slate-400">Няма членове</p>}
      </div>
    </div>
  )
}
