'use client'

// Досие → „Лични данни“: показва и редактира НА МЯСТО (без отделна страница).
// Запис през update_student_personal (SQL 2026-10-19_student_personal_edit.sql) — пипа само личните полета.
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Pencil, Save, Loader2, Search, X, Bus } from 'lucide-react'

interface School { id: string; name: string; city: string | null }
interface Props {
  studentId: string
  firstName: string
  middleName: string | null
  lastName: string
  birthDate: string | null
  school: School | null
  externalClass: string | null
  externalClassLetter: string | null
  isTraveling: boolean
  canEdit: boolean
}

const LBL = 'block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1'
const INP = 'w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:border-[#0f2240] focus:ring-4 focus:ring-[#0f2240]/10'
const fmtDate = (d: string | null) => d ? d.slice(0, 10).split('-').reverse().join('.') : ''

function errText(m: string) {
  if (/permission denied|row-level security/i.test(m)) return 'Нямате права да редактирате данните на това дете. Редактират класният на паралелката, ЗДУД и деловодството.'
  if (/update_student_personal|function .* does not exist|PGRST202/i.test(m)) return 'Липсва SQL файлът 2026-10-19_student_personal_edit.sql — пусни го в Studio.'
  return 'Записът не стана: ' + m
}

export default function StudentPersonalCard(p: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // показваните стойности (обновяват се след запис, без да чакаме презареждане)
  const [cur, setCur] = useState(p)
  useEffect(() => { setCur(p) }, [p])

  // формата
  const [f, setF] = useState({ first: '', middle: '', last: '', birth: '', extClass: '', extLetter: '', traveling: false })
  const [school, setSchool] = useState<School | null>(null)
  const [schools, setSchools] = useState<School[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function startEdit() {
    setErr('')
    setF({
      first: cur.firstName || '', middle: cur.middleName || '', last: cur.lastName || '',
      birth: (cur.birthDate || '').slice(0, 10), extClass: cur.externalClass || '', extLetter: cur.externalClassLetter || '',
      traveling: !!cur.isTraveling,
    })
    setSchool(cur.school); setQ(cur.school ? `${cur.school.name}${cur.school.city ? ' — ' + cur.school.city : ''}` : '')
    if (schools.length === 0) {
      supabase.from('sending_schools').select('id, name, city').eq('is_active', true).order('name')
        .then(({ data }) => setSchools((data as School[]) || []))
    }
    setEdit(true)
  }

  async function save() {
    if (!f.first.trim() || !f.last.trim()) { setErr('Името и фамилията са задължителни.'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.rpc('update_student_personal', {
      sid: p.studentId,
      p_first_name: f.first, p_middle_name: f.middle, p_last_name: f.last,
      p_birth_date: f.birth || null,
      p_sending_school_id: school?.id || null,
      p_external_class: f.extClass, p_external_class_letter: f.extLetter,
      p_is_traveling: f.traveling,
    })
    setSaving(false)
    if (error) { setErr(errText(error.message + ' ' + ((error as any).code || ''))); return }
    setCur(c => ({
      ...c, firstName: f.first.trim(), middleName: f.middle.trim() || null, lastName: f.last.trim(),
      birthDate: f.birth || null, school, externalClass: f.extClass.trim() || null,
      externalClassLetter: f.extLetter.trim().toLowerCase() || null, isTraveling: f.traveling,
    }))
    setEdit(false)
    router.refresh()   // горната лента и „Обзор“ показват новите данни
  }

  const filtered = schools.filter(s => `${s.name} ${s.city || ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40)

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 text-right min-w-0">{value}</span>
    </div>
  )
  const empty = <span className="text-slate-300">—</span>

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <h2 className="font-semibold text-slate-800 text-sm flex-1">Лични данни</h2>
        {p.canEdit && !edit && (
          <button type="button" onClick={startEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-[#0f2240] hover:bg-slate-50 hover:border-[#0f2240]">
            <Pencil size={13} /> Редактирай
          </button>
        )}
      </div>

      {!edit ? (
        <div>
          {row('Име', [cur.firstName, cur.middleName, cur.lastName].filter(Boolean).join(' '))}
          {row('Дата на раждане', cur.birthDate ? fmtDate(cur.birthDate) : empty)}
          {row('Изпращащо училище', cur.school ? <>{cur.school.name}{cur.school.city && <span className="text-slate-400"> — {cur.school.city}</span>}</> : empty)}
          {row('Клас в училището', cur.externalClass ? `${cur.externalClass}${cur.externalClassLetter ? ' ' + cur.externalClassLetter : ''}` : empty)}
          {row('Пътуващ', cur.isTraveling ? <span className="inline-flex items-center gap-1 text-amber-700"><Bus size={13} /> да</span> : <span className="text-slate-500">не</span>)}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className={LBL}>Име *</label><input value={f.first} onChange={e => setF({ ...f, first: e.target.value })} className={INP} /></div>
            <div><label className={LBL}>Презиме</label><input value={f.middle} onChange={e => setF({ ...f, middle: e.target.value })} className={INP} /></div>
            <div><label className={LBL}>Фамилия *</label><input value={f.last} onChange={e => setF({ ...f, last: e.target.value })} className={INP} /></div>
          </div>
          <div className="grid sm:grid-cols-[1fr_2fr] gap-3">
            <div><label className={LBL}>Дата на раждане</label><input type="date" value={f.birth} onChange={e => setF({ ...f, birth: e.target.value })} className={INP} /></div>
            <div>
              <label className={LBL}>Изпращащо училище</label>
              <div ref={boxRef} className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} placeholder="Търси училище…"
                  onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) setSchool(null) }}
                  onFocus={() => setOpen(true)} className={INP + ' pl-8 pr-8'} />
                {school && (
                  <button type="button" onClick={() => { setSchool(null); setQ('') }} title="Изчисти"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700"><X size={13} /></button>
                )}
                {open && (filtered.length > 0 ? (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    {filtered.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setSchool(s); setQ(`${s.name}${s.city ? ' — ' + s.city : ''}`); setOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                        <div className="text-slate-800">{s.name}</div>
                        {s.city && <div className="text-xs text-slate-400">{s.city}</div>}
                      </button>
                    ))}
                  </div>
                ) : q && schools.length > 0 ? (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm text-slate-500">
                    Няма такова училище — добавя се от Администрация → Училища.
                  </div>
                ) : null)}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_90px] sm:grid-cols-[160px_90px_1fr] gap-3 items-end">
            <div><label className={LBL}>Клас в училището</label><input value={f.extClass} onChange={e => setF({ ...f, extClass: e.target.value })} placeholder="напр. IX, II, ПГ" className={INP} /></div>
            <div><label className={LBL}>Буква</label><input value={f.extLetter} maxLength={3} onChange={e => setF({ ...f, extLetter: e.target.value.toLowerCase() })} className={INP + ' text-center'} /></div>
            {/* пътуващ — плъзгач с два етикета */}
            <div className="col-span-2 sm:col-span-1">
              <label className={LBL}>Пътуващ (от друго населено място)</label>
              <button type="button" onClick={() => setF({ ...f, traveling: !f.traveling })}
                className="relative inline-flex items-center h-9 rounded-full border transition-colors select-none"
                style={{ width: '120px', backgroundColor: f.traveling ? '#0f2240' : '#f1f5f9', borderColor: f.traveling ? '#0f2240' : '#cbd5e1' }}>
                <span className={f.traveling ? 'absolute left-4 text-xs font-medium text-white' : 'absolute right-4 text-xs font-medium text-slate-600'}>{f.traveling ? 'Да' : 'Не'}</span>
                <span className="absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all" style={{ left: f.traveling ? 'calc(100% - 32px)' : '4px' }} />
              </button>
            </div>
          </div>
          {err && <p className="text-xs text-rose-700">{err}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={() => { setEdit(false); setErr('') }} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">Отказ</button>
            <button type="button" onClick={save} disabled={saving || !f.first.trim() || !f.last.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#0f2240] hover:bg-[#1a3560] disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Запази
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
