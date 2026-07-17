'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { GraduationCap, Home, Wifi, Plus, X, Loader2, Check, Calendar } from 'lucide-react'

interface OresRecord {
  id: string
  from_date: string
  to_date: string | null
  reason: string | null
}

interface Props {
  studentId: string
  enrollmentId: string | null
  educationForm: string
  coudEnrolled: boolean
  oresRecords: OresRecord[]
  canManage: boolean
}

export default function StudentStatusSection({
  studentId, enrollmentId, educationForm: initialForm, coudEnrolled: initialCoud, oresRecords: initialOres, canManage
}: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [form, setForm] = useState(initialForm || 'daily')
  const [coud, setCoud] = useState(initialCoud || false)
  const [ores, setOres] = useState<OresRecord[]>(initialOres || [])
  const [saving, setSaving] = useState(false)
  const [showOresForm, setShowOresForm] = useState(false)
  const [oresFrom, setOresFrom] = useState(new Date().toISOString().split('T')[0])
  const [oresTo, setOresTo] = useState('')
  const [oresReason, setOresReason] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const activeOres = ores.find(o => o.from_date <= today && (!o.to_date || o.to_date >= today))

  async function updateForm(newForm: string) {
    if (!enrollmentId) return
    setForm(newForm)
    setSaving(true)
    await supabase.from('student_enrollments').update({ education_form: newForm }).eq('id', enrollmentId)
    setSaving(false)
    router.refresh()
  }

  async function toggleCoud() {
    if (!enrollmentId) return
    const newVal = !coud
    setCoud(newVal)
    setSaving(true)
    await supabase.from('student_enrollments').update({ coud_enrolled: newVal }).eq('id', enrollmentId)
    setSaving(false)
    router.refresh()
  }

  async function addOres() {
    if (!oresFrom) return
    setSaving(true)
    const { data, error } = await supabase.from('student_ores').insert({
      student_id: studentId,
      from_date: oresFrom,
      to_date: oresTo || null,
      reason: oresReason || null,
    }).select().single()
    if (!error && data) {
      setOres(prev => [data, ...prev])
      setShowOresForm(false)
      setOresFrom(new Date().toISOString().split('T')[0])
      setOresTo('')
      setOresReason('')
    }
    setSaving(false)
    router.refresh()
  }

  async function deleteOres(oresId: string) {
    if (!confirm('Изтриване на записа за ОРЕС?')) return
    await supabase.from('student_ores').delete().eq('id', oresId)
    setOres(prev => prev.filter(o => o.id !== oresId))
    router.refresh()
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('bg-BG')
  }

  return (
    <div className="space-y-4">
      {/* Форма на обучение */}
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Форма на обучение</div>
        {canManage ? (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => updateForm('daily')} disabled={saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                form === 'daily' ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}>
              <GraduationCap size={13} /> Дневна
            </button>
            <button type="button" onClick={() => updateForm('ifo')} disabled={saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                form === 'ifo' ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}>
              <Home size={13} /> ИФО
            </button>
          </div>
        ) : (
          <div className="text-sm font-medium text-slate-700">
            {form === 'ifo' ? 'ИФО (индивидуална)' : 'Дневна'}
          </div>
        )}
      </div>

      {/* ЦОУД */}
      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">ЦОУД (занималня)</div>
        {canManage ? (
          <button type="button" onClick={toggleCoud} disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              coud ? 'bg-[#0f2240] text-white border-[#0f2240]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}>
            {coud ? <Check size={13} /> : <span className="w-3 h-3 rounded border border-current" />}
            {coud ? 'Записан' : 'Не е записан'}
          </button>
        ) : (
          <div className="text-sm font-medium text-slate-700">{coud ? 'Записан' : 'Не е записан'}</div>
        )}
      </div>

      {/* ОРЕС */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ОРЕС</div>
          {activeOres && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <Wifi size={10} /> Активен
            </span>
          )}
        </div>

        {ores.length > 0 ? (
          <div className="space-y-1.5">
            {ores.map(o => {
              const isActive = o.from_date <= today && (!o.to_date || o.to_date >= today)
              return (
                <div key={o.id} className={`group flex items-start justify-between p-2 rounded-lg border text-xs ${
                  isActive ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <div className="flex items-center gap-1 text-slate-700 font-medium">
                      <Calendar size={11} />
                      {fmtDate(o.from_date)}{o.to_date ? ` — ${fmtDate(o.to_date)}` : ' — безсрочно'}
                    </div>
                    {o.reason && <div className="text-slate-500 mt-0.5">{o.reason}</div>}
                  </div>
                  {canManage && (
                    <button type="button" onClick={() => deleteOres(o.id)}
                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          !showOresForm && <div className="text-sm text-slate-400">Няма периоди в ОРЕС</div>
        )}

        {canManage && showOresForm && (
          <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[9px] font-medium text-slate-400 uppercase mb-1">От дата</label>
                <input type="date" value={oresFrom} onChange={e => setOresFrom(e.target.value)} className="input w-full text-xs" />
              </div>
              <div className="flex-1">
                <label className="block text-[9px] font-medium text-slate-400 uppercase mb-1">До дата</label>
                <input type="date" value={oresTo} onChange={e => setOresTo(e.target.value)} className="input w-full text-xs" />
              </div>
            </div>
            <input type="text" value={oresReason} onChange={e => setOresReason(e.target.value)}
              placeholder="Причина (незадължително)" className="input w-full text-xs" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowOresForm(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs transition-colors">
                Отказ
              </button>
              <button type="button" onClick={addOres} disabled={saving || !oresFrom}
                className="px-3 py-1.5 text-white rounded-lg text-xs flex items-center gap-1 disabled:opacity-50"
                style={{ backgroundColor: '#0f2240' }}>
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Запази
              </button>
            </div>
          </div>
        )}

        {canManage && !showOresForm && (
          <button type="button" onClick={() => setShowOresForm(true)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors mt-2">
            <Plus size={13} /> Добави период
          </button>
        )}
      </div>
    </div>
  )
}
