'use client'
// „+ Отсъствие“ — класният отразява, че детето няма да е в ЦСОП от–до (семейни причини / медицинска бележка),
// за да го видят терапевтите и учителите. Без диагнози — само видът на бележката.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { REASONS, todaySofia } from '@/lib/student-absences'
import type { AbsenceReason } from '@/lib/student-absences'

export default function AddStudentAbsence({ students, fixedStudentId, label = 'Отсъствие', onSaved, compact }: {
  students?: { id: string; name: string }[]; fixedStudentId?: string; label?: string; onSaved?: () => void; compact?: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [sid, setSid] = useState(fixedStudentId || '')
  const [from, setFrom] = useState(todaySofia())
  const [to, setTo] = useState(todaySofia())
  const [reason, setReason] = useState<AbsenceReason>('family')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!sid || !from || !to || to < from) return
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: me } = user ? await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single() : { data: null }
    const { error } = await supabase.from('student_absences').insert({ student_id: sid, date_from: from, date_to: to, reason, note: note.trim() || null, created_by: me?.id || null })
    setBusy(false)
    if (error) { toast(error.message.includes('student_absences') ? 'Пуснете SQL файла 2026-10-17_student_absences.sql' : error.message, 'error'); return }
    toast('Отразено — терапевтите и учителите на детето го виждат')
    setOpen(false); setNote(''); if (!fixedStudentId) setSid('')
    onSaved ? onSaved() : router.refresh()
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={compact ? 'inline-flex items-center gap-1 text-[12px] text-[#0f2240] hover:underline' : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700 hover:bg-slate-50'}>
        <Plus size={compact ? 13 : 14} /> {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="max-w-md mx-auto mt-16 md:mt-24 bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
              <div className="flex-1"><h2 className="text-base text-[#0f2240]">Отсъствие на дете</h2>
                <p className="text-[12px] text-slate-500">Виждат го терапевтите и учителите на детето.</p></div>
              <button type="button" onClick={() => setOpen(false)} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {!fixedStudentId && (
                <select value={sid} onChange={e => setSid(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                  <option value="">Изберете дете…</option>
                  {(students || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500">От<input type="date" value={from} onChange={e => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value) }} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></label>
                <label className="text-[11px] text-slate-500">До (вкл.)<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" /></label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(REASONS) as AbsenceReason[]).map(r => (
                  <button key={r} type="button" onClick={() => setReason(r)} className="px-3 py-1.5 rounded-xl text-[13px] border"
                    style={reason === r ? { background: REASONS[r].bg, color: REASONS[r].color, borderColor: REASONS[r].color } : { borderColor: '#e2e8f0', color: '#64748b' }}>{REASONS[r].label}</button>
                ))}
              </div>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Бележка (по желание) — без диагнози" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm border border-slate-200">Отказ</button>
              <button type="button" onClick={save} disabled={busy || !sid || to < from}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Запиши
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
