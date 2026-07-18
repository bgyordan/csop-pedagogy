'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, Loader2, AlertTriangle, Archive, Pencil, CheckCheck, CalendarPlus } from 'lucide-react'
import { runRollover, confirmEnrollment, confirmAllEnrollments, archiveStudent, updateExternalClass } from './actions'

interface Row {
  enrollmentId: string
  studentId: string
  name: string
  className: string
  externalClass: string
  status: string
}

interface Props {
  currentYearId: string
  currentYearName: string
  suggestedName: string
  suggestedStart: string
  suggestedEnd: string
  rows: Row[]
  totalEnrollments: number
  confirmedCount: number
  preview: { classes: number; students: number; coudGroups: number }
}

// Проверява дали класът е над 12 (завършващ)
function isGraduating(external: string): boolean {
  const m = external.trim().match(/^(\d+)/)
  if (!m) return false
  return parseInt(m[1]) > 12
}

export default function RolloverClient({
  currentYearId, currentYearName, suggestedName, suggestedStart, suggestedEnd,
  rows, totalEnrollments, confirmedCount, preview,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [yearName, setYearName] = useState(suggestedName)
  const [startDate, setStartDate] = useState(suggestedStart)
  const [endDate, setEndDate] = useState(suggestedEnd)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const hasUnconfirmed = rows.length > 0

  async function handleRollover() {
    if (!confirm(`Ще се създаде учебна година ${yearName} и всички паралелки, ученици, ЕПЛР екипи и ЦОУД групи ще бъдат прехвърлени. Продължаваме?`)) return
    setMessage(null)
    startTransition(async () => {
      const res = await runRollover(yearName, startDate, endDate)
      if (res.error) {
        setMessage({ type: 'err', text: res.error })
      } else {
        const s = res.stats!
        setMessage({
          type: 'ok',
          text: `Готово! Прехвърлени: ${s.classes} паралелки, ${s.students} ученици, ${s.teachers} класни, ${s.eplr} ЕПЛР екипа, ${s.coudGroups} ЦОУД групи (${s.coudStudents} ученици).`,
        })
        router.refresh()
      }
    })
  }

  async function handleConfirm(id: string) {
    setBusy(id)
    await confirmEnrollment(id)
    setBusy(null)
    router.refresh()
  }

  async function handleConfirmAll() {
    if (!confirm(`Потвърждаване на всички ${rows.length} записа наведнъж?`)) return
    setBusy('all')
    await confirmAllEnrollments(currentYearId)
    setBusy(null)
    router.refresh()
  }

  async function handleArchive(studentId: string, name: string) {
    const reason = prompt(`Причина за архивиране на ${name}:`, 'Завършил обучението си')
    if (reason === null) return
    setBusy(studentId)
    await archiveStudent(studentId, reason || 'Завършил')
    setBusy(null)
    router.refresh()
  }

  async function saveExternalClass(studentId: string) {
    setBusy(studentId)
    await updateExternalClass(studentId, editValue.trim())
    setBusy(null)
    setEditing(null)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {message && (
        <div className={`px-5 py-3 rounded-2xl border text-sm ${
          message.type === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* ── РЕЖИМ 1: ВЕРИФИКАЦИЯ ── */}
      {hasUnconfirmed ? (
        <>
          <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="font-semibold text-slate-800 text-sm">Верификация на прехвърлените ученици</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Прегледай всеки ученик: провери класа в изпращащото училище и потвърди.
                  Завършилите (над 12 клас) са отбелязани в червено — архивирай ги.
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${totalEnrollments > 0 ? (confirmedCount / totalEnrollments) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                    {confirmedCount} от {totalEnrollments} потвърдени
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleConfirmAll} disabled={busy === 'all'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors">
              {busy === 'all' ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
              Потвърди всички ({rows.length})
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ученик</th>
                  <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Паралелка</th>
                  <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Клас в училище</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(r => {
                  const graduating = isGraduating(r.externalClass)
                  return (
                    <tr key={r.enrollmentId} className={`transition-colors ${graduating ? 'bg-red-50/40' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-5 py-2.5 text-slate-700">{r.name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{r.className}</td>
                      <td className="px-3 py-2.5">
                        {editing === r.studentId ? (
                          <div className="flex items-center gap-1">
                            <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)}
                              className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs" />
                            <button onClick={() => saveExternalClass(r.studentId)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={13} /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditing(r.studentId); setEditValue(r.externalClass) }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs group ${
                              graduating ? 'text-red-600 font-semibold bg-red-100/60' : 'text-slate-600 hover:bg-slate-100'
                            }`}>
                            {r.externalClass || '—'}
                            <Pencil size={10} className="opacity-0 group-hover:opacity-60" />
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {graduating && (
                            <button onClick={() => handleArchive(r.studentId, r.name)} disabled={busy === r.studentId}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors">
                              <Archive size={12} /> Архивирай
                            </button>
                          )}
                          <button onClick={() => handleConfirm(r.enrollmentId)} disabled={busy === r.enrollmentId}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: '#0f2240' }}>
                            {busy === r.enrollmentId ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Потвърди
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* ── РЕЖИМ 2: СТАРТИРАНЕ ── */
        <>
          {totalEnrollments > 0 && confirmedCount === totalEnrollments && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-sm text-emerald-800 flex items-center gap-2">
              <Check size={16} /> Всички {totalEnrollments} записа за {currentYearName} са потвърдени.
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-800 text-sm mb-1">Какво ще се прехвърли</h2>
            <p className="text-xs text-slate-500 mb-4">От {currentYearName} в новата учебна година</p>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{preview.classes}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">паралелки</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{preview.students}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">ученици</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-slate-800">{preview.coudGroups}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">ЦОУД групи</div>
              </div>
            </div>

            <ul className="text-xs text-slate-500 space-y-1 mb-5 pl-4 list-disc">
              <li>Паралелки със същите имена и класни ръководители</li>
              <li>Ученици в същите паралелки, форма на обучение се запазва</li>
              <li>ЕПЛР екипи и ЦОУД групи със състава им</li>
              <li>Класът в изпращащото училище се вдига с 1 (4 а → 5 а)</li>
              <li className="text-slate-400">Не се прехвърлят: документи, ОРЕС периоди</li>
              <li className="text-slate-400">Деловодството не се засяга</li>
            </ul>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Име на годината</label>
                <input value={yearName} onChange={e => setYearName(e.target.value)} className="input w-full text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Начало</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input w-full text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Край</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input w-full text-sm" />
              </div>
            </div>

            <button onClick={handleRollover} disabled={pending || !yearName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#0f2240' }}>
              {pending ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />}
              {pending ? 'Прехвърляне...' : `Премини в ${yearName}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
