'use client'
// Импорт от НЕИСПУО: файлът се чете в браузъра (не се качва никъде), показва се какво ще се промени
// за всеки човек, и чак след потвърждение се записват избраните промени.

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { Upload, Loader2, Check, AlertTriangle, ChevronDown, ChevronRight, X, Search } from 'lucide-react'
import { notify, confirmDialog } from '@/components/ui/Toast'
import { yearsSince, type PPProfile } from '@/lib/pro-portfolio'
import {
  parsePersonnel, matchPerson, planFor, asOfFromFileName, FIELD_LABEL,
  type NeispuoPerson, type StaffRef, type FieldKey, type Mode, type Change,
} from '@/lib/neispuo-staff'
import { importStaff, type ImportRow } from './actions'

const ALL_FIELDS = Object.keys(FIELD_LABEL) as FieldKey[]
const dmy = (iso: string) => iso.split('-').reverse().join('.')
const fullName = (s: { first_name: string; middle_name?: string | null; last_name: string }) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')

const STATE: Record<Change['state'], { l: string; c: string }> = {
  new: { l: 'ново', c: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  diff: { l: 'различно', c: 'bg-amber-50 text-amber-800 border-amber-200' },
  same: { l: 'същото', c: 'bg-slate-50 text-slate-500 border-slate-200' },
}

export default function StaffImportClient({ staff, profiles }: { staff: StaffRef[]; profiles: PPProfile[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; rows: unknown[][] } | null>(null)
  const [asOf, setAsOf] = useState('')
  const [mode, setMode] = useState<Mode>('fill')
  const [fields, setFields] = useState<Set<FieldKey>>(new Set(ALL_FIELDS))
  const [pick, setPick] = useState<Record<string, string>>({})     // ръчно избран служител (key → staff id, '' = пропусни)
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [only, setOnly] = useState<'all' | 'changes' | 'problems'>('all')
  const [saving, setSaving] = useState(false)

  const staffById = useMemo(() => new Map(staff.map(s => [s.id, s])), [staff])
  const profileBy = useMemo(() => new Map(profiles.map(p => [p.staff_id, p])), [profiles])

  const parsed = useMemo(() => (file && asOf ? parsePersonnel(file.rows, asOf) : null), [file, asOf])

  async function onFile(f: File) {
    try {
      const wb = XLSX.read(await f.arrayBuffer())
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false })
      const d = asOfFromFileName(f.name)
      const test = parsePersonnel(rows, d)
      if (test.error) { notify(test.error); return }
      if (!test.people.length) { notify('Във файла няма редове със служители'); return }
      setFile({ name: f.name, rows }); setAsOf(d); setPick({}); setSkip(new Set()); setOpen(new Set())
    } catch { notify('Файлът не може да се прочете') }
    finally { if (fileRef.current) fileRef.current.value = '' }
  }

  // свързване и план за всеки човек
  const plans = useMemo(() => {
    if (!parsed) return []
    const at = (since: string | null | undefined, extra = 0) => yearsSince(since, asOf, extra)
    return parsed.people.map(p => {
      const m = matchPerson(p, staff)
      const staffId = p.key in pick ? pick[p.key] || null : m.id
      const s = staffId ? staffById.get(staffId) : undefined
      const plan = s ? planFor(p, profileBy.get(s.id) || null, s, mode, fields, at) : null
      const writes = plan ? Object.keys(plan.set).length + Object.keys(plan.staff).length : 0
      return { p, m, staffId, s, plan, writes, manual: p.key in pick }
    })
  }, [parsed, staff, staffById, profileBy, pick, mode, fields, asOf])

  const dupIds = useMemo(() => {
    const c = new Map<string, number>()
    plans.forEach(x => { if (x.staffId && !skip.has(x.p.key)) c.set(x.staffId, (c.get(x.staffId) || 0) + 1) })
    return new Set(Array.from(c.entries()).filter(([, n]) => n > 1).map(([id]) => id))
  }, [plans, skip])

  const included = plans.filter(x => x.staffId && !skip.has(x.p.key) && !dupIds.has(x.staffId))
  const unmatched = plans.filter(x => !x.staffId && !skip.has(x.p.key))
  const withWrites = included.filter(x => x.writes > 0)
  const shown = plans.filter(x => {
    if (q && !`${x.p.first} ${x.p.middle} ${x.p.last}`.toLowerCase().includes(q.toLowerCase())) return false
    if (only === 'changes') return x.writes > 0 && !skip.has(x.p.key)
    if (only === 'problems') return !x.staffId || (x.staffId && dupIds.has(x.staffId)) || x.manual || x.plan?.changes.some(c => c.state === 'diff')
    return true
  })

  async function save() {
    if (!included.length) return
    if (dupIds.size) { notify('Един служител е избран за повече от един човек от файла — оправете го преди запис'); return }
    const keep = mode === 'replace' ? ' Различните стойности ще бъдат заменени с тези от НЕИСПУО.' : ' Попълнените ръчно стойности няма да бъдат променяни.'
    const ok = await confirmDialog(`Ще се запишат данните на ${included.length} служители (${withWrites.length} с промени в профила).${keep}`, { title: 'Запис на импорта', confirmLabel: 'Запиши' })
    if (!ok) return
    setSaving(true)
    const rows: ImportRow[] = included.map(x => ({
      staff_id: x.staffId!, neispuo_id: x.p.poid, set: x.plan!.set, staff: x.plan!.staff, neispuo: x.p.snap,
    }))
    const res = await importStaff(rows)
    setSaving(false)
    if ('error' in res && res.error) { notify(res.error); return }
    notify(`Записани данни за ${'count' in res ? res.count : rows.length} служители`, 'success')
    setFile(null)
    router.refresh()
  }

  if (!file || !parsed) return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-[15px] font-semibold text-slate-800 mb-2">Как става</h2>
        <ol className="list-decimal pl-5 text-sm text-slate-600 space-y-1">
          <li>В НЕИСПУО изтеглете справката <b>„Персонал“</b> като Excel (един ред за всяко образование / квалификация на човека).</li>
          <li>Качете файла тук. Той се чете само в браузъра — не се записва в системата и не се качва никъде.</li>
          <li>Прегледайте кой с кого е свързан и какво ще се промени. Докато не натиснете „Запиши“, нищо не се променя.</li>
        </ol>
        <p className="text-xs text-slate-500 mt-3">Взимат се: образование (степен, специалност, ПК), допълнителни квалификации, ПКС, стаж, длъжност и телефон. Адресите и датата на раждане не се пазят.</p>
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary mt-4 inline-flex items-center gap-2"><Upload size={16} /> Избери файл от НЕИСПУО (.xlsx)</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{file.name}</div>
            <div className="text-xs text-slate-500">{parsed.people.length} души · пробен преглед, още нищо не е записано</div>
          </div>
          <label className="text-xs text-slate-600 flex items-center gap-2">Данни към
            <input type="date" value={asOf} onChange={e => e.target.value && setAsOf(e.target.value)} className="input py-1 w-40" /></label>
          <button type="button" onClick={() => setFile(null)} className="btn-secondary inline-flex items-center gap-1"><X size={14} /> Друг файл</button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-[13px]">
          <div>
            <div className="label">Ако в профила вече има стойност</div>
            <label className="flex items-start gap-2 mt-1"><input type="radio" checked={mode === 'fill'} onChange={() => setMode('fill')} className="mt-0.5" />
              <span><b>Само допълни</b> — попълват се празните полета, липсващото образование се добавя; ръчно въведеното остава.</span></label>
            <label className="flex items-start gap-2 mt-1"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-0.5" />
              <span><b>Замени</b> — различните стойности се заменят с данните от НЕИСПУО.</span></label>
          </div>
          <div>
            <div className="label">Кои данни да се вземат</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {ALL_FIELDS.map(f => (
                <label key={f} className="inline-flex items-center gap-1.5">
                  <input type="checkbox" checked={fields.has(f)} onChange={e => setFields(prev => { const n = new Set(prev); if (e.target.checked) n.add(f); else n.delete(f); return n })} />
                  {FIELD_LABEL[f]}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">Стажът се записва като начална дата, изчислена от годините в НЕИСПУО към датата на справката, и после се смята сам.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <Stat n={included.length} l="свързани" tone="text-emerald-700" />
        <Stat n={withWrites.length} l="с промени" tone="text-indigo-700" />
        <Stat n={unmatched.length} l="без служител" tone={unmatched.length ? 'text-amber-700' : 'text-slate-400'} />
        <Stat n={skip.size} l="пропуснати" tone="text-slate-500" />
      </div>

      {dupIds.size > 0 && <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-2xl px-4 py-3 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /> Един служител е избран за двама души от файла: {Array.from(dupIds).map(id => staffById.get(id)).filter(Boolean).map(s => fullName(s!)).join(', ')}.</div>}
      {unmatched.length > 0 && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">За {unmatched.length} души не намерих служител в системата. Изберете го от списъка или ги пропуснете — нови служители не се създават оттук.</div>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Търси по име" className="input pl-8" /></div>
        {(['all', 'changes', 'problems'] as const).map(k => (
          <button key={k} type="button" onClick={() => setOnly(k)} className={`px-3 py-1.5 rounded-lg text-[13px] border ${only === k ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>
            {k === 'all' ? 'Всички' : k === 'changes' ? 'С промени' : 'За проверка'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {shown.map(x => {
          const isOpen = open.has(x.p.key)
          const skipped = skip.has(x.p.key)
          const dup = x.staffId && dupIds.has(x.staffId)
          const diffs = x.plan?.changes.filter(c => c.state === 'diff').length || 0
          return (
            <div key={x.p.key} className={skipped ? 'opacity-50' : ''}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setOpen(prev => { const n = new Set(prev); if (n.has(x.p.key)) n.delete(x.p.key); else n.add(x.p.key); return n })} className="text-slate-400" aria-label="Детайли">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div className="min-w-[180px] flex-1">
                  <div className="text-sm font-medium text-slate-800">{x.p.first} {x.p.middle} {x.p.last}</div>
                  <div className="text-xs text-slate-500">{[x.p.position, x.p.snap.pks].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={x.staffId || ''} onChange={e => setPick(prev => ({ ...prev, [x.p.key]: e.target.value }))}
                    className={`input py-1 text-[13px] w-64 ${!x.staffId ? 'border-amber-400' : dup ? 'border-rose-400' : ''}`}>
                    <option value="">— не е свързан —</option>
                    {x.m.candidates.length > 0 && <optgroup label="Възможни">{x.m.candidates.map(id => staffById.get(id)).filter(Boolean).map(s => <option key={s!.id} value={s!.id}>{fullName(s!)}{s!.is_active ? '' : ' (неактивен)'}</option>)}</optgroup>}
                    <optgroup label="Всички служители">{staff.map(s => <option key={s.id} value={s.id}>{fullName(s)}{s.is_active ? '' : ' (неактивен)'}</option>)}</optgroup>
                  </select>
                  <span className="text-[11px] text-slate-400 w-28">{x.manual ? 'избран ръчно' : x.m.how}</span>
                </div>
                <div className="w-28 text-right text-xs">
                  {x.plan ? (x.writes ? <span className="text-indigo-700">{x.writes} промени{diffs && mode === 'fill' ? ` · ${diffs} запазени` : ''}</span> : <span className="text-slate-400">без промени</span>) : null}
                </div>
                <label className="text-xs text-slate-500 inline-flex items-center gap-1"><input type="checkbox" checked={skipped} onChange={e => setSkip(prev => { const n = new Set(prev); if (e.target.checked) n.add(x.p.key); else n.delete(x.p.key); return n })} /> пропусни</label>
              </div>
              {isOpen && (
                <div className="px-4 pb-4 pl-11 text-[13px]">
                  {!x.plan ? <p className="text-slate-500">Изберете служител, за да видите промените.</p> : (
                    <table className="w-full">
                      <thead><tr className="text-left text-[11px] uppercase tracking-wide text-slate-400"><th className="py-1 w-40">Поле</th><th>Сега в системата</th><th>От НЕИСПУО</th><th className="w-24"></th></tr></thead>
                      <tbody>
                        {x.plan.changes.map(c => {
                          const applied = c.state === 'new' || (c.state === 'diff' && mode === 'replace')
                          return (
                            <tr key={c.field} className="align-top border-t border-slate-50">
                              <td className="py-1.5 text-slate-500">{FIELD_LABEL[c.field]}</td>
                              <td className="py-1.5 pr-3 text-slate-600">{c.from || <span className="text-slate-300">—</span>}</td>
                              <td className={`py-1.5 pr-3 ${applied ? 'text-slate-900 font-medium' : 'text-slate-400 line-through'}`}>{c.to}</td>
                              <td className="py-1.5"><span className={`text-[11px] px-1.5 py-0.5 rounded border ${STATE[c.state].c}`}>{c.field === 'education' && c.from && c.state === 'new' ? 'добавя' : STATE[c.state].l}</span></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  <div className="text-xs text-slate-500 mt-2">
                    {[x.p.snap.years_specialty != null ? `стаж по специалността ${x.p.snap.years_specialty} г.` : null,
                      x.p.snap.credits != null ? `${x.p.snap.credits} кредита` : null, x.p.snap.titular, x.p.snap.contract_basis,
                      x.p.poid ? `№ в НЕИСПУО: ${x.p.poid}` : null].filter(Boolean).join(' · ')}
                    {' '}— пазят се като справка в профила.
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!shown.length && <div className="px-4 py-6 text-sm text-slate-500 text-center">Няма редове за показване</div>}
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <button type="button" disabled={saving || !included.length || dupIds.size > 0} onClick={save} className="btn-primary inline-flex items-center gap-2 shadow-lg disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Запиши ({included.length} служители)
        </button>
      </div>
      <p className="text-xs text-slate-500">Към датата на справката {dmy(asOf)}. При повторен импорт хората се разпознават по номера им в НЕИСПУО, а образованието не се дублира.</p>
    </div>
  )
}

function Stat({ n, l, tone }: { n: number; l: string; tone: string }) {
  return <div className="bg-white rounded-2xl border border-slate-200 py-3"><div className={`text-2xl font-semibold ${tone}`}>{n}</div><div className="text-xs text-slate-500">{l}</div></div>
}
