'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Plus, Loader2, Search, X } from 'lucide-react'
import { getFullName } from '@/lib/utils'

interface Unassigned {
  id: string
  name: string
  isNew: boolean
}

export default function AddStudentsSection({
  classId, className, academicYearId, unassigned, canManage,
}: {
  classId: string
  className: string
  academicYearId: string
  unassigned: Unassigned[]
  canManage: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [list, setList] = useState<Unassigned[]>(unassigned)

  if (!canManage) return null

  const filtered = search.trim()
    ? list.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : list

  function addToClass(u: Unassigned) {
    setBusy(u.id)
    startTransition(async () => {
      const { error } = await supabase.from('student_enrollments').insert({
        student_id: u.id,
        class_id: classId,
        academic_year_id: academicYearId,
      })
      setBusy(null)
      if (!error) {
        setList(prev => prev.filter(x => x.id !== u.id))
        router.refresh()
      }
    })
  }

  return (
    <div className="mb-5">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
        <UserPlus size={16} className="text-slate-400" />
        Добави ученик в паралелката
        {list.length > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
            {list.length} неразпределени
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Търси неразпределен ученик..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 px-4 py-6 text-center">
                {list.length === 0 ? 'Няма неразпределени ученици' : 'Няма намерени'}
              </p>
            ) : (
              filtered.map(u => (
                <div key={u.id} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
                  <span className="text-sm text-slate-700 flex items-center gap-2">
                    {u.name}
                    {u.isNew && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 uppercase">Нов</span>
                    )}
                  </span>
                  <button onClick={() => addToClass(u)} disabled={busy === u.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ backgroundColor: '#0f2240' }}>
                    {busy === u.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Добави
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
