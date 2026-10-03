'use client'

// Профил на детето: групи + стандартни нива (GMFCS/MACS/CFCS при ЦП, ниво на подкрепа при аутизъм, обща степен по МКФ-ДЮ).
// Сменя се рядко; от него зависи кои умения се показват първо.

import { useEffect, useState } from 'react'
import { Pencil, X, Loader2, Save, UserRound } from 'lucide-react'
import { GROUPS, GMFCS, MACS, CFCS, ASD, ICF, roman, severity } from './lib'
import type { Profile } from './lib'

const SEV_LABEL = { severe: 'тежки затруднения', moderate: 'умерени затруднения', mild: 'леки затруднения' }

export default function ProfileCard({ profile, studentId, canEdit, onSave }: {
  profile: Profile | null; studentId: string; canEdit: boolean; onSave: (p: Profile) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const p = profile
  const sev = severity(p)
  const chips: { k: string; t: string; title?: string }[] = []
  if (p) {
    p.groups.forEach(g => chips.push({ k: 'g' + g, t: GROUPS[g] || g }))
    if (p.gmfcs) chips.push({ k: 'gm', t: `GMFCS ${roman(p.gmfcs)}`, title: 'Груба моторика: ' + GMFCS[p.gmfcs] })
    if (p.macs) chips.push({ k: 'ma', t: `MACS ${roman(p.macs)}`, title: 'Работа с ръцете: ' + MACS[p.macs] })
    if (p.cfcs) chips.push({ k: 'cf', t: `CFCS ${roman(p.cfcs)}`, title: 'Комуникация: ' + CFCS[p.cfcs] })
    if (p.asd_level) chips.push({ k: 'asd', t: `Аутизъм ниво ${p.asd_level}`, title: ASD[p.asd_level] })
    if (p.icf !== null && p.icf !== undefined) chips.push({ k: 'icf', t: `МКФ: ${ICF[p.icf].toLowerCase()}` })
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3.5 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-slate-500"><UserRound size={14} /> Профил</span>
        {chips.length ? chips.map(c => (
          <span key={c.k} title={c.title} className="text-[12.5px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">{c.t}</span>
        )) : <span className="text-[13px] text-slate-400">не е попълнен</span>}
        {sev && <span className={`text-[12px] px-2.5 py-1 rounded-full ${sev === 'severe' ? 'bg-rose-50 text-rose-800' : sev === 'moderate' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{SEV_LABEL[sev]}</span>}
        {p?.note && <span className="text-[12.5px] text-slate-500 truncate max-w-[320px]" title={p.note}>{p.note}</span>}
        {canEdit && (
          <button type="button" onClick={() => setOpen(true)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
            <Pencil size={13} /> {p ? 'Промени' : 'Попълни'}
          </button>
        )}
      </div>
      {open && <ProfileEditor initial={p} studentId={studentId} onClose={() => setOpen(false)} onSave={async v => { await onSave(v); setOpen(false) }} />}
    </>
  )
}

function Levels({ label, hint, value, onChange, opts, fmt }: {
  label: string; hint: string; value: number | null; onChange: (v: number | null) => void; opts: Record<number, string>; fmt: (n: number) => string
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5"><span className="text-sm font-semibold text-slate-900">{label}</span><span className="text-[12px] text-slate-500">{hint}</span></div>
      <div className="space-y-1">
        {Object.entries(opts).map(([k, d]) => {
          const n = +k, on = value === n
          return (
            <button key={k} type="button" onClick={() => onChange(on ? null : n)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-[13px] border transition-colors ${on ? 'border-[#0f2240] bg-[#0f2240] text-white' : 'border-slate-200 hover:border-slate-400 text-slate-700'}`}>
              <span className={`w-9 shrink-0 font-semibold ${on ? 'text-white' : 'text-slate-900'}`}>{fmt(n)}</span>{d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ProfileEditor({ initial, studentId, onClose, onSave }: { initial: Profile | null; studentId: string; onClose: () => void; onSave: (p: Profile) => Promise<void> }) {
  const [p, setP] = useState<Profile>(initial || { student_id: studentId, groups: [], gmfcs: null, macs: null, cfcs: null, asd_level: null, icf: null, note: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const set = (patch: Partial<Profile>) => setP(x => ({ ...x, ...patch }))
  const has = (g: string) => p.groups.includes(g)

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto panel-in" onClick={onClose}>
      <div className="max-w-4xl mx-auto my-0 md:my-6 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3.5 bg-white/95 backdrop-blur border-b border-slate-200">
          <span className="font-semibold text-slate-900">Профил на детето</span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">Откажи</button>
            <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onSave(p) } finally { setBusy(false) } }}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium bg-[#0f2240] text-white hover:bg-[#1a3560] disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Запиши
            </button>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <div className="text-sm font-semibold text-slate-900 mb-2">Група</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(GROUPS).map(([k, l]) => (
                <button key={k} type="button" onClick={() => set({ groups: has(k) ? p.groups.filter(x => x !== k) : [...p.groups, k] })}
                  className={`px-3 py-1.5 rounded-full text-[13px] border ${has(k) ? 'bg-[#0f2240] border-[#0f2240] text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500'}`}>{l}</button>
              ))}
            </div>
          </div>

          <Levels label="Обща степен на затруднение" hint="по МКФ-ДЮ (СЗО)" value={p.icf} onChange={v => set({ icf: v })} opts={ICF} fmt={n => String(n)} />

          {(has('autism') || p.asd_level) && (
            <Levels label="Аутизъм — ниво на подкрепа" hint="по DSM-5" value={p.asd_level} onChange={v => set({ asd_level: v })} opts={ASD} fmt={n => String(n)} />
          )}

          {(has('cp') || p.gmfcs || p.macs || p.cfcs) && (
            <div className="grid md:grid-cols-3 gap-5">
              <Levels label="GMFCS" hint="груба моторика" value={p.gmfcs} onChange={v => set({ gmfcs: v })} opts={GMFCS} fmt={roman} />
              <Levels label="MACS" hint="работа с ръцете" value={p.macs} onChange={v => set({ macs: v })} opts={MACS} fmt={roman} />
              <Levels label="CFCS" hint="комуникация" value={p.cfcs} onChange={v => set({ cfcs: v })} opts={CFCS} fmt={roman} />
            </div>
          )}
          {!has('cp') && !has('autism') && (
            <p className="text-[12.5px] text-slate-500">При ЦП се показват GMFCS, MACS и CFCS; при аутизъм — нивото на подкрепа.</p>
          )}

          <div>
            <div className="text-sm font-semibold text-slate-900 mb-1.5">Бележка</div>
            <textarea value={p.note || ''} onChange={e => set({ note: e.target.value })} rows={2} placeholder="Напр. помощни средства, комуникационна система, особености…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-[#0f2240] resize-y" />
          </div>
        </div>
      </div>
    </div>
  )
}
