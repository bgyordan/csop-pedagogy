'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Search, Plus, Loader2, UserMinus, Coffee } from 'lucide-react'

interface Props {
  group: { id: string; name: string }
  academicYearId: string
  onClose: () => void
  onChanged: () => void
}

interface Member {
  enrollmentId: string
  studentId: string
  name: string
}

export default function CoudGroupModal({ group, academicYearId, onClose, onChanged }: Props) {
  const supabase = createClient()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [available, setAvailable] = useState<{ id: string; name: string; inOtherGroup: boolean }[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    // Членове на тази група
    const { data: enrolls } = await supabase
      .from('coud_enrollments')
      .select('id, student_id, student:students(first_name, middle_name, last_name)')
      .eq('coud_group_id', group.id)
      .eq('academic_year_id', academicYearId)

    const mem: Member[] = (enrolls || []).map((e: any) => ({
      enrollmentId: e.id,
      studentId: e.student_id,
      name: `${e.student.first_name} ${e.student.middle_name || ''} ${e.student.last_name}`.replace(/\s+/g, ' ').trim(),
    })).sort((a, b) => a.name.localeCompare(b.name, 'bg'))
    setMembers(mem)

    // Всички активни ученици с текущо enrollment (в паралелка)
    const { data: allEnroll } = await supabase
      .from('student_enrollments')
      .select('student_id, student:students(id, first_name, middle_name, last_name, status)')
      .eq('academic_year_id', academicYearId)

    // Кои вече са в ЦОУД (в която и да е група)
    const { data: allCoud } = await supabase
      .from('coud_enrollments')
      .select('student_id, coud_group_id')
      .eq('academic_year_id', academicYearId)

    const inCoudMap = new Map<string, string>()
    ;(allCoud || []).forEach(c => inCoudMap.set(c.student_id, c.coud_group_id))

    const memberIds = new Set(mem.map(m => m.studentId))

    const avail = (allEnroll || [])
      .filter((e: any) => e.student?.status === 'active' && !memberIds.has(e.student_id))
      .map((e: any) => ({
        id: e.student_id,
        name: `${e.student.first_name} ${e.student.middle_name || ''} ${e.student.last_name}`.replace(/\s+/g, ' ').trim(),
        inOtherGroup: inCoudMap.has(e.student_id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'bg'))
    setAvailable(avail)

    setLoading(false)
  }

  async function addStudent(studentId: string) {
    setBusy(studentId)
    // Ученик може да е в само една ЦОУД група — трием стар запис ако има
    await supabase.from('coud_enrollments')
      .delete()
      .eq('student_id', studentId)
      .eq('academic_year_id', academicYearId)

    await supabase.from('coud_enrollments').insert({
      student_id: studentId,
      coud_group_id: group.id,
      academic_year_id: academicYearId,
    })
    setBusy(null)
    await load()
    onChanged()
  }

  async function removeStudent(enrollmentId: string) {
    setBusy(enrollmentId)
    await supabase.from('coud_enrollments').delete().eq('id', enrollmentId)
    setBusy(null)
    await load()
    onChanged()
  }

  const filteredAvailable = available.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl border border-slate-200/80 max-w-2xl w-full shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Coffee size={17} className="text-slate-500" />
            </div>
            <div>
              <h3 className="font-medium text-slate-800 text-sm">{group.name}</h3>
              <p className="text-[11px] text-slate-400">{members.length} ученика в групата</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-300" /></div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-x divide-slate-100 min-h-0">
            {/* В групата */}
            <div className="flex flex-col min-h-0">
              <div className="px-5 py-3 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex-shrink-0">
                В групата ({members.length})
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {members.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Няма ученици</p>
                ) : members.map(m => (
                  <div key={m.enrollmentId} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 group">
                    <span className="text-sm text-slate-700 truncate">{m.name}</span>
                    <button onClick={() => removeStudent(m.enrollmentId)} disabled={busy === m.enrollmentId}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                      {busy === m.enrollmentId ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Налични за добавяне */}
            <div className="flex flex-col min-h-0">
              <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Търси ученик..." className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-400" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {filteredAvailable.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Няма ученици</p>
                ) : filteredAvailable.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 group">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-700 truncate">{s.name}</div>
                      {s.inOtherGroup && <div className="text-[10px] text-amber-600">вече в друга ЦОУД група</div>}
                    </div>
                    <button onClick={() => addStudent(s.id)} disabled={busy === s.id}
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-white opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                      {busy === s.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
