'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, FileDown, FileText, History, Loader2, Save, Send, Trash2, X } from 'lucide-react'
import DateInput from '@/components/ui/DateInput'
import { notify, confirmDialog } from '@/components/ui/Toast'
import { detailKey, type ChangeDetail, type ClassChange } from '@/lib/ruo-changes'
import { generateRuoChangesReport } from '@/lib/docx-ruo-changes'
import { saveSnapshot, saveDetails, deleteSnapshot } from './actions'

type Snap = { id: string; outNumber: string; outDate: string; note: string; createdAt: string; total: number }

const bgDate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('.') : '')
const classNo = (n: string) => n.trim().replace(/^0+(?=\d)/, '')
const emptyDetail = (studentId: string, kind: 'in' | 'out'): ChangeDetail =>
  ({ studentId, kind, parentName: '', applicationNo: '', opinionNo: '', opinionInNo: '', orderNo: '' })

export default function RuoChangesClient({ yearName, baseId, history, changes, details, currentTotal }: {
  yearName: string
  baseId: string | null
  history: Snap[]
  changes: ClassChange[]
  details: Record<string, ChangeDetail>
  currentTotal: number
}) {
  const router = useRouter()
  const [d, setD] = useState<Record<string, ChangeDetail>>(details)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'' | 'save' | 'word' | 'snap'>('')
  const [outForWord, setOutForWord] = useState('')
  const [snapOpen, setSnapOpen] = useState(false)

  const base = history[0]

  // Децата, за които трябват номера: нови в ЦСОП (in) и отписани (out). Преместените — не.
  const needed = useMemo(() => {
    const list: { key: string; kind: 'in' | 'out'; studentId: string }[] = []
    const seen = new Set<string>()
    changes.forEach(c => {
      c.ins.filter(s => !s.fromClass).forEach(s => { const k = detailKey(s.id, 'in'); if (!seen.has(k)) { seen.add(k); list.push({ key: k, kind: 'in', studentId: s.id }) } })
      c.outs.filter(s => !s.toClass).forEach(s => { const k = detailKey(s.id, 'out'); if (!seen.has(k)) { seen.add(k); list.push({ key: k, kind: 'out', studentId: s.id }) } })
    })
    return list
  }, [changes])
  const missing = needed.filter(n => {
    const x = d[n.key]
    if (!x) return true
    return n.kind === 'in'
      ? ![x.parentName, x.applicationNo, x.opinionNo, x.opinionInNo].every(v => v.trim())
      : ![x.applicationNo, x.orderNo].every(v => v.trim())
  }).length

  function set(studentId: string, kind: 'in' | 'out', field: keyof ChangeDetail, value: string) {
    const k = detailKey(studentId, kind)
    setD(prev => ({ ...prev, [k]: { ...(prev[k] || emptyDetail(studentId, kind)), [field]: value } }))
    setDirty(true)
  }

  async function onSave() {
    if (!baseId) return
    setBusy('save')
    const rows = needed.map(n => d[n.key] || emptyDetail(n.studentId, n.kind))
    const res = await saveDetails(baseId, rows)
    setBusy('')
    if (res.error) { notify(res.error); return }
    setDirty(false)
    notify('Номерата са запазени', 'success')
  }

  async function onWord() {
    setBusy('word')
    try {
      await generateRuoChangesReport({ yearName, changes, details: d, outNumber: outForWord })
    } catch (e: any) { notify(`Грешка: ${e.message}`) }
    setBusy('')
  }

  async function onDeleteSnap(id: string) {
    if (!(await confirmDialog('Да изтрия ли тази запазена основа? Сравнението ще започне от предишната.'))) return
    const res = await deleteSnapshot(id)
    if (res.error) { notify(res.error); return }
    router.refresh()
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><FileText size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Доклад за промени в паралелките</h1>
          <p className="text-slate-500 text-sm mt-0.5">{yearName} · разликата спрямо последния подаден доклад до РУО</p>
        </div>
      </div>

      {!base ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Още няма основа за сравнение</h3>
          <p className="text-sm text-slate-500 mb-4">
            Запази сегашния състав на паралелките като „подаден“ — с изходящия номер на последния доклад до РУО
            (началния или последния за промени). Оттук нататък системата показва всяка промяна спрямо него.
          </p>
          <SnapshotForm total={currentTotal} onDone={() => router.refresh()} />
        </div>
      ) : (
        <>
          {/* Основата и действията */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="text-slate-600">
                Спрямо: <span className="font-medium text-slate-800">{base.outNumber ? `Изх. № ${base.outNumber}` : 'запазен състав'}</span>
                {base.outDate && <span className="text-slate-500"> от {bgDate(base.outDate)}</span>}
              </div>
              <div className="text-slate-600">
                Деца: <span className="font-medium text-slate-800">{base.total}</span>
                <ArrowRight size={13} className="inline mx-1 text-slate-400" />
                <span className="font-medium text-slate-800">{currentTotal}</span>
              </div>
              {changes.length > 0 && (
                <div className="text-slate-600">Променени паралелки: <span className="font-medium text-slate-800">{changes.length}</span></div>
              )}
              {missing > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs">{missing} {missing === 1 ? 'дете' : 'деца'} с непопълнени номера</span>
              )}
            </div>

            {changes.length > 0 && (
              <div className="flex flex-wrap items-end gap-2 mt-4 pt-4 border-t border-slate-100">
                <label className="text-xs text-slate-500">
                  Изх. № на новия доклад (може и празно)
                  <input value={outForWord} onChange={e => setOutForWord(e.target.value)} placeholder="напр. 61/26.11.2026г."
                    className="block mt-1 w-56 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700" />
                </label>
                <button onClick={onWord} disabled={!!busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm disabled:opacity-50"
                  style={{ backgroundColor: '#0f2240' }}>
                  {busy === 'word' ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} Изтегли доклада (Word)
                </button>
                <button onClick={() => setSnapOpen(true)} disabled={!!busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
                  <Send size={13} className="text-slate-400" /> Докладът е подаден
                </button>
              </div>
            )}
          </div>

          {changes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center text-sm text-slate-500">
              Няма промени спрямо последния подаден доклад.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">Номерата се пазят и можеш да ги допълваш на части. Каквото липсва, излиза в жълто в Word.</p>
                <button onClick={onSave} disabled={!dirty || !!busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-40">
                  {busy === 'save' ? <Loader2 size={13} className="animate-spin" /> : dirty ? <Save size={13} className="text-slate-400" /> : <Check size={13} className="text-emerald-500" />}
                  {dirty ? 'Запази номерата' : 'Запазено'}
                </button>
              </div>

              <div className="space-y-3">
                {changes.map(c => (
                  <div key={c.className} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-sm font-semibold text-slate-800">Паралелка № {classNo(c.className)}</h3>
                      <span className="text-xs text-slate-500">
                        {c.before === 0 ? `нова · ${c.after} деца` : c.after === 0 ? 'закрива се' : `${c.before} → ${c.after} деца`}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {c.ins.map(s => (
                        <div key={'in' + s.id} className="py-2">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {s.fromClass ? `от № ${classNo(s.fromClass)}` : 'постъпва'}
                            </span>
                            <span className="text-slate-800">{s.name}</span>
                            <span className="text-xs text-slate-400">{s.externalClass} · {s.school}</span>
                          </div>
                          {!s.fromClass && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                              <Field label="Родител" value={d[detailKey(s.id, 'in')]?.parentName} onChange={v => set(s.id, 'in', 'parentName', v)} />
                              <Field label="Вх. № на заявлението" value={d[detailKey(s.id, 'in')]?.applicationNo} onChange={v => set(s.id, 'in', 'applicationNo', v)} placeholder="114/09.10.26г." />
                              <Field label="№ на заповедта за насочване (РЦПППО)" value={d[detailKey(s.id, 'in')]?.opinionNo} onChange={v => set(s.id, 'in', 'opinionNo', v)} placeholder="РДО07-244/24.09.2026г." />
                              <Field label="Вх. № на заповедта при нас" value={d[detailKey(s.id, 'in')]?.opinionInNo} onChange={v => set(s.id, 'in', 'opinionInNo', v)} placeholder="55/24.09.26г." />
                            </div>
                          )}
                        </div>
                      ))}
                      {c.outs.map(s => (
                        <div key={'out' + s.id} className="py-2">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="px-2 py-0.5 rounded-full text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
                              {s.toClass ? `в № ${classNo(s.toClass)}` : 'отписан'}
                            </span>
                            <span className="text-slate-800">{s.name}</span>
                            <span className="text-xs text-slate-400">{s.externalClass} · {s.school}</span>
                          </div>
                          {!s.toClass && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                              <Field label="Вх. № на заявлението за отписване" value={d[detailKey(s.id, 'out')]?.applicationNo} onChange={v => set(s.id, 'out', 'applicationNo', v)} placeholder="89/30.09.26г." />
                              <Field label="Заповед №" value={d[detailKey(s.id, 'out')]?.orderNo} onChange={v => set(s.id, 'out', 'orderNo', v)} placeholder="65/02.10.2026 г." />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* История на подадените */}
          <div className="mt-6">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2"><History size={13} /> Подадени доклади</h3>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
              {history.map((h, i) => (
                <div key={h.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                  <span className="text-slate-800">{h.outNumber ? `Изх. № ${h.outNumber}` : 'без номер'}</span>
                  <span className="text-slate-500">{bgDate(h.outDate || h.createdAt)}</span>
                  <span className="text-slate-500">{h.total} деца</span>
                  {h.note && <span className="text-slate-400 text-xs truncate">{h.note}</span>}
                  {i === 0 && (
                    <button onClick={() => onDeleteSnap(h.id)} title="Изтрий (запазено по грешка)"
                      className="ml-auto p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {snapOpen && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSnapOpen(false)}>
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-medium text-slate-800 text-sm">Докладът е подаден</h3>
              <button onClick={() => setSnapOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4">
                Сегашният състав ({currentTotal} деца) става новата основа. Следващият доклад ще показва само промените след него.
                {dirty && <span className="block mt-2 text-amber-700">Има незапазени номера — запази ги първо, ако ти трябват.</span>}
              </p>
              <SnapshotForm total={currentTotal} defaultOut={outForWord} onDone={() => { setSnapOpen(false); router.refresh() }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  const empty = !(value || '').trim()
  return (
    <label className="text-[11px] text-slate-500">
      {label}
      <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`block mt-0.5 w-full px-2.5 py-1.5 rounded-lg border text-sm text-slate-700 placeholder:text-slate-300 ${empty ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'}`} />
    </label>
  )
}

function SnapshotForm({ total, defaultOut = '', onDone }: { total: number; defaultOut?: string; onDone: () => void }) {
  const [out, setOut] = useState(defaultOut.replace(/\/.*$/, ''))
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    setBusy(true)
    const res = await saveSnapshot(out, date || null, note)
    setBusy(false)
    if (res.error) { notify(res.error); return }
    notify('Съставът е запазен като основа', 'success')
    onDone()
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-500">Изх. №
          <input value={out} onChange={e => setOut(e.target.value)} placeholder="43"
            className="block mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700" />
        </label>
        <label className="text-xs text-slate-500">Дата
          <DateInput value={date} onChange={setDate} className="mt-1" />
        </label>
      </div>
      <label className="block text-xs text-slate-500">Бележка (по желание)
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="напр. начален доклад"
          className="block mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700" />
      </label>
      <button onClick={submit} disabled={busy}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm disabled:opacity-50"
        style={{ backgroundColor: '#0f2240' }}>
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Запази състава ({total} деца)
      </button>
    </div>
  )
}
