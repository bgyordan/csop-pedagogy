'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, ExternalLink, Pencil, Check, X, RotateCcw, Info } from 'lucide-react'
import { ACCENT, SITE_URL, Switch, Toast, useFlash } from './shared'

export interface StaffRow { id: string; first_name: string; last_name: string; role: string; position: string | null }
export interface TeamSetting { staff_id: string; show: boolean; title: string | null }

// Същата логика като изгледа public_team в базата (миграция 2026-10-01_site_team.sql) — при промяна да се смени и там.
const GROUPS = [
  { key: 'admin', label: 'Администрация' },
  { key: 'therapy', label: 'Терапевти и специалисти' },
  { key: 'teachers', label: 'Педагогически екип' },
  { key: 'educators', label: 'Възпитатели ЦОУД' },
  { key: 'assistants', label: 'Помощник на учителя' },
  { key: 'other', label: 'Помощен персонал' },
]
const isAssistant = (p: StaffRow, title?: string | null) => p.role === 'support' && `${p.position || ''} ${title || ''}`.toLowerCase().includes('помощник')
function groupOf(p: StaffRow, title?: string | null) {
  if (['director', 'zdud', 'admin', 'secretary'].includes(p.role)) return 'admin'
  if (['psychologist', 'speech_therapist', 'rehabilitator'].includes(p.role)) return 'therapy'
  if (['class_teacher', 'teacher', 'coordinator'].includes(p.role)) return 'teachers'
  if (p.role === 'educator') return 'educators'
  return isAssistant(p, title) ? 'assistants' : 'other'
}
function autoTitle(p: StaffRow) {
  const pos = (p.position || '').trim()
  switch (p.role) {
    case 'director': return 'Директор'
    case 'zdud': return 'Зам.-директор УД'
    case 'class_teacher': case 'teacher': return 'Учител'
    case 'psychologist': return 'Психолог'
    case 'speech_therapist': return 'Логопед'
    case 'rehabilitator': return pos.toLowerCase().startsWith('ерготерапевт') ? 'Ерготерапевт' : 'Рехабилитатор'
    case 'educator': return 'Възпитател'
  }
  if (isAssistant(p)) return 'Помощник на учителя'
  return pos || 'Служител'
}
const ROLE_SORT: Record<string, number> = { director: 1, zdud: 2, admin: 3, secretary: 4, psychologist: 5, speech_therapist: 6, rehabilitator: 7 }
const initials = (p: StaffRow) => ((p.first_name[0] || '') + (p.last_name[0] || '')).toUpperCase()

/* ═══════════════ ЕКИП ═══════════════ */
export default function TeamManager({ staff, initial, ready }: { staff: StaffRow[]; initial: TeamSetting[]; ready: boolean }) {
  const supabase = createClient(); const router = useRouter()
  const { notice, flash } = useFlash()
  const [settings, setSettings] = useState<Record<string, TeamSetting>>(() => Object.fromEntries(initial.map((s) => [s.staff_id, s])))
  const [q, setQ] = useState(''); const [vis, setVis] = useState<'all' | 'on' | 'off'>('all')
  const [editId, setEditId] = useState<string | null>(null); const [editVal, setEditVal] = useState('')

  const shownOnSite = (p: StaffRow) => settings[p.id]?.show ?? groupOf(p) !== 'other'
  const titleOf = (p: StaffRow) => settings[p.id]?.title?.trim() || autoTitle(p)

  const onCount = staff.filter(shownOnSite).length
  const groups = useMemo(() => {
    const query = q.trim().toLowerCase()
    return GROUPS.map((g) => ({
      ...g,
      people: staff
        .filter((p) => groupOf(p, settings[p.id]?.title) === g.key)
        .filter((p) => (vis === 'all' ? true : vis === 'on' ? shownOnSite(p) : !shownOnSite(p)))
        .filter((p) => !query || `${p.first_name} ${p.last_name} ${titleOf(p)}`.toLowerCase().includes(query))
        .sort((a, b) => (ROLE_SORT[a.role] || 9) - (ROLE_SORT[b.role] || 9) || a.last_name.localeCompare(b.last_name, 'bg')),
    })).filter((g) => g.people.length)
  }, [staff, settings, q, vis]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(p: StaffRow, patch: Partial<TeamSetting>) {
    const prev = settings[p.id]
    const next: TeamSetting = { staff_id: p.id, show: shownOnSite(p), title: prev?.title ?? null, ...patch }
    setSettings((s) => ({ ...s, [p.id]: next }))
    const { error } = await supabase.from('site_team').upsert({ ...next, updated_at: new Date().toISOString() })
    if (error) { setSettings((s) => { const c = { ...s }; if (prev) c[p.id] = prev; else delete c[p.id]; return c }); flash('Не се запази: ' + error.message, true); return }
    router.refresh()
  }
  function startEdit(p: StaffRow) { setEditId(p.id); setEditVal(settings[p.id]?.title || '') }
  async function commitEdit(p: StaffRow) {
    const v = editVal.trim(); setEditId(null)
    if (v === (settings[p.id]?.title || '')) return
    await save(p, { title: v || null }); flash(v ? 'Надписът е сменен.' : 'Върнат е автоматичният надпис.')
  }

  return (
    <div>
      <Toast notice={notice} />
      {!ready && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          Таблицата за екипа още не е създадена в базата — промените няма да се запазват, докато не се пусне миграцията <code>2026-10-01_site_team.sql</code>.
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="px-5 pt-4 pb-3.5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: ACCENT }}>Екип на сайта</h2>
              <div className="text-slate-500 text-[12.5px] mt-0.5 flex items-center gap-2 flex-wrap">
                {onCount} души се показват на страницата „Екип“
                <a href={SITE_URL + '/za-nas/ekip'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-700 hover:underline">виж страницата <ExternalLink size={12} /></a>
              </div>
            </div>
          </div>
          <p className="mt-3 flex gap-2 text-[12.5px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5">
            <Info size={15} className="shrink-0 mt-px text-slate-400" />
            <span>Хората идват автоматично от ЕИС → Служители: нов колега се появява сам, напусналият (неактивен) изчезва сам. Тук се избира само дали някой да се вижда на сайта и какъв надпис да стои под името.</span>
          </p>
          <div className="flex gap-2.5 items-center flex-wrap mt-3.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси по име или длъжност…" className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-[13px] bg-slate-50 focus:outline-none focus:bg-white focus:border-slate-400" />
            </div>
            <div className="inline-flex bg-slate-50 border border-slate-200 rounded-xl p-0.5">
              {([['all', 'Всички'], ['on', 'На сайта'], ['off', 'Скрити']] as const).map(([k, lbl]) => (
                <button key={k} onClick={() => setVis(k)} className={`text-[12.5px] px-3 py-1.5 rounded-lg ${vis === k ? 'bg-white shadow-sm font-medium' : 'text-slate-500'}`} style={vis === k ? { color: ACCENT } : {}}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Няма съвпадения.</p>
        ) : groups.map((g) => (
          <div key={g.key} className="px-5 py-4 border-b border-slate-100 last:border-0">
            <div className="flex items-baseline gap-2 mb-3">
              <h3 className="text-[14px] font-semibold" style={{ color: ACCENT }}>{g.label}</h3>
              <span className="text-[12px] text-slate-400">{g.people.filter(shownOnSite).length} на сайта{g.people.some((p) => !shownOnSite(p)) ? ` · ${g.people.filter((p) => !shownOnSite(p)).length} скрити` : ''}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {g.people.map((p) => {
                const on = shownOnSite(p); const custom = !!settings[p.id]?.title?.trim(); const editing = editId === p.id
                return (
                  <div key={p.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${on ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/70'}`}>
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 ${on ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-400'}`}>{initials(p)}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13.5px] font-medium truncate ${on ? 'text-slate-800' : 'text-slate-400'}`}>{p.first_name} {p.last_name}</div>
                      {editing ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <input autoFocus value={editVal} placeholder={autoTitle(p)} onChange={(e) => setEditVal(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') setEditId(null) }}
                            className="flex-1 min-w-0 text-[12.5px] border border-slate-300 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-[#0f2240]" />
                          <button onClick={() => commitEdit(p)} className="p-1 rounded text-emerald-600 hover:bg-emerald-50" title="Запази"><Check size={14} /></button>
                          <button onClick={() => setEditId(null)} className="p-1 rounded text-slate-400 hover:bg-slate-100" title="Откажи"><X size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(p)} className="group/t flex items-center gap-1 max-w-full text-left" title="Смени надписа под името">
                          <span className={`text-[12px] truncate ${custom ? 'text-slate-700' : 'text-slate-500'}`}>{titleOf(p)}</span>
                          <Pencil size={11} className="shrink-0 text-slate-300 opacity-0 group-hover/t:opacity-100" />
                        </button>
                      )}
                    </div>
                    {custom && !editing && (
                      <button onClick={() => { save(p, { title: null }); flash('Върнат е автоматичният надпис.') }} className="p-1 rounded text-slate-300 hover:text-slate-500" title={`Върни „${autoTitle(p)}“`}><RotateCcw size={13} /></button>
                    )}
                    <Switch on={on} onClick={() => { save(p, { show: !on }); flash(on ? `${p.first_name} ${p.last_name} е скрит(а) от сайта.` : `${p.first_name} ${p.last_name} се показва на сайта.`) }} label={undefined} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
