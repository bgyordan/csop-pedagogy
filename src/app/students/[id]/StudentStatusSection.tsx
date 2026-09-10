'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { GraduationCap, Home, Wifi, Plus, X, Loader2, Check, Calendar, FileText, Activity } from 'lucide-react'

function coudEligible(ext?: string | null): boolean {
  if (!ext) return true
  const t = ext.trim().toUpperCase()
  if (t.startsWith('ПГ')) return true
  const R: Record<string, number> = { I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13 }
  if (R[t] !== undefined) return R[t] <= 7
  const m = t.match(/^(\d+)/)
  if (m) return parseInt(m[1]) <= 7
  return true
}

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
  coudGroupName?: string | null
  coudTeacher?: string | null
  externalClass?: string | null
  oresRecords: OresRecord[]
  intensity?: string | null
  canManage: boolean
  rcpppoValidUntil?: string | null
  supportType?: string | null
  telkValidUntil?: string | null
}

export default function StudentStatusSection({
  studentId, enrollmentId, educationForm: initialForm, coudGroupName, coudTeacher, externalClass, oresRecords: initialOres, intensity: initialIntensity, canManage, rcpppoValidUntil, supportType, telkValidUntil
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState(initialForm || 'daily')
  const [ores, setOres] = useState<OresRecord[]>(initialOres || [])
  const [saving, setSaving] = useState(false)
  
  // ORES State
  const [showOresForm, setShowOresForm] = useState(false)
  const [oresFrom, setOresFrom] = useState(new Date().toISOString().split('T')[0])
  const [oresTo, setOresTo] = useState('')
  const [oresReason, setOresReason] = useState('')
  
  // Intensity State
  const INTENSITY_PRESETS = ['8', '6', '4']
  const [intensity, setIntensity] = useState(initialIntensity || '')
  const [customIntensity, setCustomIntensity] = useState(
    !!(initialIntensity && !['8', '6', '4'].includes(initialIntensity))
  )

  // New Docs State
  const [isEditingDocs, setIsEditingDocs] = useState(false)
  const [docForm, setDocForm] = useState({
    rcpppo_valid_until: rcpppoValidUntil || '',
    support_type: supportType || '',
    telk_valid_until: telkValidUntil || '',
  })

  async function updateIntensity(val: string) {
    setIntensity(val)
    setSaving(true)
    await supabase.from('students').update({ intensity: val || null }).eq('id', studentId)
    setSaving(false)
    router.refresh()
  }

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

  async function saveDocs() {
    setSaving(true)
    await supabase.from('students').update({
      rcpppo_valid_until: docForm.rcpppo_valid_until || null,
      support_type: docForm.support_type || null,
      telk_valid_until: docForm.telk_valid_until || null,
    }).eq('id', studentId)
    setSaving(false)
    setIsEditingDocs(false)
    router.refresh()
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('bg-BG')
  }

  function renderDateStatus(dateStr?: string | null) {
    if (!dateStr) return <span className="text-slate-400">Няма въведена дата</span>
    const validUntil = new Date(dateStr)
    const now = new Date()
    const daysLeft = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 3600 * 24))
    
    let colorCls = "text-emerald-700 bg-emerald-50 border-emerald-200"
    let statusText = "Валиден"
    
    if (daysLeft < 0) {
      colorCls = "text-rose-700 bg-rose-50 border-rose-200"
      statusText = "Изтекъл"
    } else if (daysLeft <= 30) {
      colorCls = "text-amber-700 bg-amber-50 border-amber-200"
      statusText = `Изтича след ${daysLeft} дни`
    }

    return (
      <div className="flex flex-col gap-1 mt-1">
        <span className="text-sm font-medium text-slate-700">{fmtDate(dateStr)}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold w-fit ${colorCls}`}>
          {statusText}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Първи ред: Съществуващи карти (Интензитет, Форма, ЦОУД, ОРЕС) с обновен дизайн */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {/* Интензитет */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-full">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Интензитет (часове/седмица)</div>
          {canManage ? (
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {INTENSITY_PRESETS.map(p => (
                  <button key={p} type="button" onClick={() => { setCustomIntensity(false); updateIntensity(p) }} disabled={saving}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      !customIntensity && intensity === p ? 'bg-[#0f2240] text-white border-[#0f2240] shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {p} часа
                  </button>
                ))}
                <button type="button" onClick={() => setCustomIntensity(true)} disabled={saving}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    customIntensity ? 'bg-[#0f2240] text-white border-[#0f2240] shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}>
                  Друго
                </button>
              </div>
              {customIntensity && (
                <input type="text" value={intensity} onChange={e => setIntensity(e.target.value)}
                  onBlur={e => updateIntensity(e.target.value)}
                  placeholder="напр. 10 часа"
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:border-slate-400" />
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-slate-700">
              {intensity ? `${intensity}${/^\d+$/.test(intensity) ? ' часа' : ''}` : <span className="text-slate-400 font-normal">не е зададен</span>}
            </div>
          )}
        </div>

        {/* Форма на обучение */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-full">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Форма на обучение</div>
          {canManage ? (
            <div className="flex gap-1.5">
              <button type="button" onClick={() => updateForm('daily')} disabled={saving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  form === 'daily' ? 'bg-[#0f2240] text-white border-[#0f2240] shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}>
                <GraduationCap size={13} /> Дневна
              </button>
              <button type="button" onClick={() => updateForm('ifo')} disabled={saving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  form === 'ifo' ? 'bg-[#0f2240] text-white border-[#0f2240] shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
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
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-full flex flex-col">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">ЦОУД (занималня)</div>
          {coudGroupName ? (
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-700">{coudGroupName}</div>
              {coudTeacher && <div className="text-xs text-slate-500 mt-1">Възпитател: {coudTeacher}</div>}
            </div>
          ) : (
            <div className="text-sm text-slate-400 flex-1">Не е записан</div>
          )}
          <p className="text-[9px] text-slate-400 mt-2 border-t border-slate-100 pt-2">От Администрация → ЦОУД</p>
        </div>

        {/* ОРЕС */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 h-full">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ОРЕС</div>
            {activeOres && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <Wifi size={10} /> Активен
              </span>
            )}
          </div>
          {ores.length > 0 ? (
            <div className="space-y-2">
              {ores.map(o => {
                const isActive = o.from_date <= today && (!o.to_date || o.to_date >= today)
                return (
                  <div key={o.id} className={`group flex items-start justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                    isActive ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <div>
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Calendar size={11} className="text-slate-400" />
                        {fmtDate(o.from_date)}{o.to_date ? ` — ${fmtDate(o.to_date)}` : ' — безсрочно'}
                      </div>
                      {o.reason && <div className="text-slate-500 mt-1 pl-4 border-l-2 border-slate-200">{o.reason}</div>}
                    </div>
                    {canManage && (
                      <button type="button" onClick={() => deleteOres(o.id)}
                        className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            !showOresForm && <div className="text-sm text-slate-400">Няма активни периоди</div>
          )}
          {canManage && showOresForm && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[9px] font-medium text-slate-500 uppercase mb-1">От дата</label>
                  <input type="date" value={oresFrom} onChange={e => setOresFrom(e.target.value)} className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-slate-400" />
                </div>
                <div className="flex-1">
                  <label className="block text-[9px] font-medium text-slate-500 uppercase mb-1">До дата</label>
                  <input type="date" value={oresTo} onChange={e => setOresTo(e.target.value)} className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:border-slate-400" />
                </div>
              </div>
              <input type="text" value={oresReason} onChange={e => setOresReason(e.target.value)}
                placeholder="Причина (незадължително)" className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:border-slate-400" />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowOresForm(false)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs transition-colors">
                  Отказ
                </button>
                <button type="button" onClick={addOres} disabled={saving || !oresFrom}
                  className="px-3 py-1.5 text-white rounded-lg text-xs flex items-center gap-1 disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#0f2240' }}>
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Запази
                </button>
              </div>
            </div>
          )}
          {canManage && !showOresForm && (
            <button type="button" onClick={() => setShowOresForm(true)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors mt-3">
              <Plus size={13} /> Добави период
            </button>
          )}
        </div>
      </div>

      {/* НОВА СЕКЦИЯ: Документи и Подкрепа */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#0f2240]" />
            <h3 className="text-sm font-semibold text-slate-800">Експертни решения и срокове</h3>
          </div>
          {canManage && !isEditingDocs && (
            <button 
              onClick={() => setIsEditingDocs(true)}
              className="text-xs font-semibold text-[#0f2240] hover:underline"
            >
              Редактирай данни
            </button>
          )}
        </div>

        {isEditingDocs ? (
          <div className="bg-slate-50/80 border border-slate-200 p-4 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Вид подкрепа</label>
                <select 
                  value={docForm.support_type} 
                  onChange={e => setDocForm({...docForm, support_type: e.target.value})}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:border-slate-400"
                >
                  <option value="">-- Избери --</option>
                  <option value="Обща">Обща подкрепа</option>
                  <option value="Допълнителна">Допълнителна подкрепа</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Заповед РЦПППО валидна до</label>
                <input 
                  type="date" 
                  value={docForm.rcpppo_valid_until} 
                  onChange={e => setDocForm({...docForm, rcpppo_valid_until: e.target.value})}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">ТЕЛК / МЕ валиден до</label>
                <input 
                  type="date" 
                  value={docForm.telk_valid_until} 
                  onChange={e => setDocForm({...docForm, telk_valid_until: e.target.value})}
                  className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>
            
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-200/60 mt-4">
              <button 
                onClick={() => setIsEditingDocs(false)}
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Отказ
              </button>
              <button 
                onClick={saveDocs}
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white rounded-xl transition-colors flex items-center gap-1.5"
                style={{ backgroundColor: '#0f2240' }}
              >
                {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
                Запази
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <Activity size={13} /> Вид подкрепа
              </div>
              <div className="text-sm font-medium text-slate-700 mt-1">
                {supportType ? (
                  <span className="inline-flex px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                    {supportType}
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal">—</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">РЦПППО валидност</div>
              {renderDateStatus(rcpppoValidUntil)}
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">ТЕЛК валидност</div>
              {renderDateStatus(telkValidUntil)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
