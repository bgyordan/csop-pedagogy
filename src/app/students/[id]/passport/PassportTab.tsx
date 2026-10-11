'use client'

// Таб „Паспорт“ в досието: показва паспорта на детето и го редактира (класен, ЕПЛР екип, терапевти, координатори, управа).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Pencil, Printer, X, Save, IdCard } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import PassportSheet from './PassportSheet'
import { COMMUNICATION, EATING, TOILET, MOBILITY, PASSPORT_COLS, emptyPassport, isFilled } from './lib'
import type { Passport } from './lib'

export default function PassportTab({ studentId, meId, canEdit }: { studentId: string; meId: string; canEdit: boolean }) {
  const supabase = createClient()
  const [p, setP] = useState<Passport | null | undefined>(undefined)
  const [who, setWho] = useState('')
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('student_passports').select(PASSPORT_COLS).eq('student_id', studentId).maybeSingle()
    if (error) { setErr('Паспортът още не е подготвен в базата — пуснете SQL файла 2026-10-11_student_passport.sql.'); return }
    const row = (data as Passport) || null
    setP(row)
    if (row?.updated_by) {
      const { data: s } = await supabase.from('staff_profiles').select('first_name, last_name').eq('id', row.updated_by).maybeSingle()
      setWho(s ? `${s.first_name} ${s.last_name}` : '')
    } else setWho('')
  }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  if (err) return <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">{err}</div>
  if (p === undefined) return <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>

  const filled = isFilled(p)
  const updated = p?.updated_at ? new Date(p.updated_at).toLocaleDateString('bg-BG') : ''

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3.5 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-slate-500"><IdCard size={14} /> Паспорт на детето</span>
        <span className="text-[12.5px] text-slate-500">
          {filled ? <>обновен {updated}{who ? ` · ${who}` : ''}</> : 'една страница за заместници, ЦОУД и нови колеги'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {filled && (
            <Link href={`/passports?student=${studentId}`} target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
              <Printer size={13} /> Печат
            </Link>
          )}
          {canEdit && (
            <button type="button" onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
              <Pencil size={13} /> {filled ? 'Промени' : 'Попълни'}
            </button>
          )}
        </div>
      </div>

      {filled && p ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5"><PassportSheet passport={p} /></div>
      ) : (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <IdCard size={30} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">Паспортът не е попълнен.</p>
          <p className="text-[12.5px] text-slate-400 mt-1">Попълват го класният, ЕПЛР екипът и терапевтите на детето.</p>
        </div>
      )}

      {open && (
        <PassportEditor initial={p || emptyPassport(studentId)} onClose={() => setOpen(false)}
          onSave={async v => {
            const { error } = await supabase.from('student_passports').upsert({
              student_id: studentId, communication: v.communication, communication_note: v.communication_note || null,
              likes: v.likes || null, triggers: v.triggers || null, calming: v.calming || null,
              eating: v.eating, eating_note: v.eating_note || null, toilet: v.toilet, mobility: v.mobility,
              safety: v.safety || null, updated_by: meId || null, updated_at: new Date().toISOString(),
            })
            if (error) return error.message
            setOpen(false)
            await load()
            return null
          }} />
      )}
    </div>
  )
}

// Избор от няколко — капсула; повторно щракване маха избора
function Choice({ value, opts, onChange }: { value: string | null; opts: Record<string, string>; onChange: (v: any) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
      {Object.entries(opts).map(([k, l]) => {
        const on = value === k
        return (
          <button key={k} type="button" onClick={() => onChange(on ? null : k)}
            className={`px-3 py-1.5 rounded-lg text-[13px] transition-all ${on ? 'bg-white text-[#0f2240] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        )
      })}
    </div>
  )
}

function PassportEditor({ initial, onClose, onSave }: { initial: Passport; onClose: () => void; onSave: (p: Passport) => Promise<string | null> }) {
  const { toast } = useToast()
  const [p, setP] = useState<Passport>({ ...initial, communication: [...(initial.communication || [])] })
  const [busy, setBusy] = useState(false)
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const set = (patch: Partial<Passport>) => setP(x => ({ ...x, ...patch }))
  const toggleComm = (k: string) => set({ communication: p.communication.includes(k) ? p.communication.filter(c => c !== k) : [...p.communication, k] })

  const label = (t: string, hint?: string) => (
    <div className="flex items-baseline gap-2 mb-1.5"><span className="text-sm font-medium text-slate-800">{t}</span>{hint && <span className="text-[12px] text-slate-400">{hint}</span>}</div>
  )
  const area = (key: 'communication_note' | 'likes' | 'triggers' | 'calming' | 'eating_note' | 'safety', ph: string, rows = 2) => (
    <textarea value={(p[key] as string) || ''} onChange={e => set({ [key]: e.target.value } as any)} rows={rows} placeholder={ph}
      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#0f2240] resize-y" />
  )

  async function save() {
    setBusy(true)
    const e = await onSave(p)
    setBusy(false)
    if (e) toast('Грешка при запис: ' + e, 'error')
    else toast('Паспортът е записан')
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto panel-in" onClick={onClose}>
      <div className="max-w-3xl mx-auto my-0 md:my-6 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3.5 bg-white/95 backdrop-blur border-b border-slate-200">
          <IdCard size={18} className="text-slate-500" />
          <h2 className="text-base font-medium text-[#0f2240] flex-1">Паспорт на детето</h2>
          <button type="button" onClick={save} disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f2240' }}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Запази
          </button>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            {label('Как общува', 'може няколко')}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {Object.entries(COMMUNICATION).map(([k, l]) => {
                const on = p.communication.includes(k)
                return (
                  <button key={k} type="button" onClick={() => toggleComm(k)}
                    className={`px-3 py-1.5 rounded-full text-[13px] border transition-colors ${on ? 'border-[#0f2240] text-[#0f2240] bg-slate-50 ring-1 ring-[#0f2240]/20' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                    {l}
                  </button>
                )
              })}
            </div>
            {area('communication_note', 'напр. „казва „да“ с кимане; посочва картинка за тоалетна“')}
          </div>

          <div>{label('Какво харесва и го мотивира')}{area('likes', 'напр. музика, балони, похвала с „дай пет“')}</div>
          <div>{label('Какво го тревожи или провокира')}{area('triggers', 'напр. силен шум, смяна на дейност без предупреждение')}</div>
          <div>{label('Какво го успокоява')}{area('calming', 'напр. тих ъгъл, тежко одеяло, любима песен')}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>{label('Хранене')}<Choice value={p.eating} opts={EATING} onChange={v => set({ eating: v })} />
              <div className="mt-2">{area('eating_note', 'напр. само пасирана храна; не дава да му се помага', 1)}</div></div>
            <div className="space-y-5">
              <div>{label('Тоалет')}<Choice value={p.toilet} opts={TOILET} onChange={v => set({ toilet: v })} /></div>
              <div>{label('Придвижване')}<Choice value={p.mobility} opts={MOBILITY} onChange={v => set({ mobility: v })} /></div>
            </div>
          </div>

          <div>
            {label('Важно за безопасността', 'кратко — подробните здравни данни не са тук')}
            {area('safety', 'напр. бяга при отворена врата; слага всичко в устата')}
          </div>
        </div>
      </div>
    </div>
  )
}
