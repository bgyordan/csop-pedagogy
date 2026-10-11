'use client'

// „Паспорти“ — работен списък: всяко дете на ред, попълнен / не е попълнен, „Попълни“ / „Промени“ направо тук.
// Непопълнените са най-отгоре. Печатът (горе) печата само попълнените — всяко на отделен лист.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, CircleCheck, Circle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PassportEditor } from '../students/[id]/passport/PassportTab'
import { emptyPassport, passportRow } from '../students/[id]/passport/lib'
import type { Passport } from '../students/[id]/passport/lib'

export type ListKid = { id: string; name: string; group: string; passport: Passport | null; filled: boolean; updated: string; canEdit: boolean }

export default function PassportList({ kids, meId }: { kids: ListKid[]; meId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [edit, setEdit] = useState<ListKid | null>(null)
  const sorted = [...kids].sort((a, b) => Number(a.filled) - Number(b.filled))
  const missing = kids.filter(k => !k.filled).length

  return (
    <div className="space-y-2">
      {missing > 0 && <p className="text-[13px] text-slate-500">Непопълнени: <b className="font-medium text-slate-700">{missing}</b> от {kids.length}</p>}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {sorted.map((k, i) => (
          <div key={k.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
            {k.filled ? <CircleCheck size={16} className="text-emerald-600 shrink-0" /> : <Circle size={16} className="text-slate-300 shrink-0" />}
            <div className="flex-1 min-w-[180px]">
              <Link href={`/students/${k.id}?tab=passport`} className="text-[14px] text-slate-800 hover:text-[#0f2240] hover:underline">{k.name}</Link>
              <div className="text-[12px] text-slate-500">
                {k.group}{k.group && ' · '}{k.filled ? `попълнен${k.updated ? `, обновен ${k.updated}` : ''}` : 'не е попълнен'}
              </div>
            </div>
            {k.canEdit && (
              <button type="button" onClick={() => setEdit(k)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] ${k.filled ? 'border border-slate-300 text-slate-700 hover:border-[#0f2240]' : 'text-white hover:opacity-90'}`}
                style={k.filled ? undefined : { backgroundColor: '#0f2240' }}>
                {k.filled ? <><Pencil size={13} /> Промени</> : <><Plus size={13} /> Попълни</>}
              </button>
            )}
          </div>
        ))}
      </div>

      {edit && (
        <PassportEditor initial={edit.passport || emptyPassport(edit.id)} onClose={() => setEdit(null)}
          onSave={async v => {
            const { error } = await supabase.from('student_passports').upsert(passportRow(edit.id, meId, v))
            if (error) return error.message.includes('row-level security') ? 'нямате права да попълвате паспорта на това дете' : error.message
            setEdit(null)
            router.refresh()
            return null
          }} />
      )}
    </div>
  )
}
