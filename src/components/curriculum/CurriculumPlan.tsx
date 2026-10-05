// Справочен изглед на учебния план (НЕИСПУО) — за учител или за паралелка. Само за четене.
import Link from 'next/link'
import { BookOpenCheck, AlertTriangle, UserRound } from 'lucide-react'
import type { CurLine } from '@/lib/curriculum'
import { planTotals, overWithIch } from '@/lib/curriculum'

const f = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
const byBg = (a: string, b: string) => a.localeCompare(b, 'bg', { numeric: true })
// ред: ЗП, ИУЧ, ДПЛР, ОФПВ, ЦОУД, без вид
const KIND_ORDER = ['ЗП', 'ИУЧ', 'ДПЛР', 'ОФПВ', 'ЦОУД', '']
const kindRank = (l: CurLine) => KIND_ORDER.indexOf(l.kind)

export default function CurriculumPlan({ mode, lines, importedAt, norm, schedule, title = 'Учебен план', compact = false, ichLect = 0 }: {
  mode: 'teacher' | 'class'
  lines: CurLine[]
  importedAt: string | null
  /** норматив на учителя (21); без него — без „над норматива“ */
  norm?: number
  /** часовете в разписанието на EIS по паралелки (само за учител) — за сравнение */
  schedule?: Record<string, { t1: number; t2: number; name?: string }>
  title?: string
  compact?: boolean
  /** ИЧ, признати за лекторски по заповед (ч./седм.) */
  ichLect?: number
}) {
  const main = lines.filter(l => !l.individual)
    .sort((a, b) => mode === 'teacher'
      ? byBg(a.holder, b.holder) || kindRank(a) - kindRank(b) || byBg(a.subject, b.subject)
      : kindRank(a) - kindRank(b) || byBg(a.subject, b.subject) || byBg(a.teacher, b.teacher))
  const ich = lines.filter(l => l.individual)
    .sort((a, b) => mode === 'teacher' ? byBg(a.holder, b.holder) || byBg(a.subject, b.subject) : byBg(a.teacher, b.teacher) || byBg(a.subject, b.subject))
  const t = planTotals(lines)
  // разбивка по вид (без ИЧ): ЗП / ИУЧ / …
  const byKind: Record<string, number> = {}
  main.forEach(l => { const k = l.kind || 'друго'; byKind[k] = (byKind[k] || 0) + l.h1 })
  const kindParts = Object.entries(byKind).filter(([, h]) => h > 0)
  const ORDER = ['ЗП', 'ИУЧ', 'ДПЛР', 'ОФПВ', 'ЦОУД', 'друго']
  kindParts.sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
  const same = main.every(l => l.h1 === l.h2) && ich.every(l => l.h1 === l.h2)

  // разлики разписание ↔ план по паралелки (само за учител)
  const diffs: { holder: string; plan: number; sched: number; term: 1 | 2 }[] = []
  if (mode === 'teacher' && schedule) {
    const per: Record<string, { holder: string; p1: number; p2: number }> = {}
    main.forEach(l => { if (!l.classId) return; const o = (per[l.classId] ||= { holder: l.holder, p1: 0, p2: 0 }); o.p1 += l.h1; o.p2 += l.h2 })
    Object.entries(per).forEach(([cid, o]) => {
      const s = schedule[cid] || { t1: 0, t2: 0 }
      if (Math.round(o.p1) !== s.t1) diffs.push({ holder: o.holder, plan: o.p1, sched: s.t1, term: 1 })
      else if (s.t2 > 0 && Math.round(o.p2) !== s.t2) diffs.push({ holder: o.holder, plan: o.p2, sched: s.t2, term: 2 })
    })
    // часове в разписанието в паралелка, която я няма в плана на учителя
    Object.entries(schedule).forEach(([cid, s]) => {
      if (!per[cid] && s.t1 > 0) diffs.push({ holder: s.name || '?', plan: 0, sched: s.t1, term: 1 })
    })
    diffs.sort((a, b) => byBg(a.holder, b.holder))
  }

  const th = 'px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide'
  const td = 'px-3 py-2 border-t border-slate-100'
  const hours = (l: CurLine) => (
    <>
      <td className={`${td} text-center tabular-nums`}>{f(l.h1)}</td>
      {!same && <td className={`${td} text-center tabular-nums`}>{f(l.h2)}</td>}
      <td className={`${td} text-center tabular-nums text-slate-500`}>{f(l.total)}</td>
    </>
  )
  const hoursHead = (
    <>
      <th className={`${th} text-center w-20`}>{same ? 'ч./седм.' : 'I срок'}</th>
      {!same && <th className={`${th} text-center w-20`}>II срок</th>}
      <th className={`${th} text-center w-24`}>за годината</th>
    </>
  )
  const KIND_CLS: Record<string, string> = {
    'ИУЧ': 'bg-sky-50 text-sky-700 border-sky-200', 'ДПЛР': 'bg-violet-50 text-violet-700 border-violet-200',
    'ЦОУД': 'bg-orange-50 text-orange-700 border-orange-200', 'ОФПВ': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  const KIND_TITLE: Record<string, string> = {
    'ИУЧ': 'Избираеми учебни часове — раздел Б (РП/УП-А)', 'ДПЛР': 'Допълнителна подкрепа за личностно развитие',
    'ЦОУД': 'Целодневна организация (ДЦО)', 'ОФПВ': 'Организирани форми за физическо възпитание',
  }
  // вид на часа (ЗП не се отбелязва — той е по подразбиране)
  const kindTag = (l: CurLine) => l.kind && l.kind !== 'ЗП' && <span title={`${KIND_TITLE[l.kind] || ''}${l.mode ? ` · „${l.mode}“` : ''}`} className={`ml-1.5 text-[10px] px-1.5 py-px rounded border ${KIND_CLS[l.kind] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{l.kind}</span>
  const therapy = (l: CurLine) => l.norm !== 21 && <span title="Норма 30 — един час се брои 0,7 към норматива" className="ml-1.5 text-[10px] px-1.5 py-px rounded bg-violet-50 text-violet-700 border border-violet-200">0,7</span>
  const who = (l: CurLine) => l.staffId
    ? <span className="inline-flex items-center gap-1.5"><UserRound size={12} className="text-slate-400" />{l.teacher}</span>
    : <span className="text-slate-500" title="Не е свързан със служител в EIS">{l.teacher || '—'}</span>

  return (
    <section className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${compact ? '' : 'mb-6'}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 bg-slate-50/70 border-b border-slate-100">
        <BookOpenCheck size={16} className="text-teal-700" />
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {lines.length > 0 && <span className="text-xs text-slate-500">по НЕИСПУО{importedAt ? ` · качен ${fmtDate(importedAt)}` : ''}</span>}
      </div>

      {lines.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          {mode === 'teacher' ? 'Няма редове от учебния план за този служител.' : 'Няма редове от учебния план за тази паралелка.'}
          <div className="text-xs text-slate-400 mt-1">Учебният план се качва от НЕИСПУО (Администрация → Учебни планове).</div>
        </div>
      ) : (
        <>
          {diffs.length > 0 && (
            <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900">
              <div className="flex items-center gap-1.5 font-medium mb-1"><AlertTriangle size={14} /> Разписанието в EIS не съвпада с учебния план</div>
              <ul className="space-y-0.5">
                {diffs.map(d => (
                  <li key={d.holder + d.term}>Паралелка <b>{d.holder}</b>{d.term === 2 ? ' (II срок)' : ''}: по плана {f(d.plan)} ч., в разписанието {d.sched} ч.</li>
                ))}
              </ul>
            </div>
          )}

          {main.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    {mode === 'teacher' && <th className={`${th} w-32`}>Паралелка</th>}
                    <th className={th}>Предмет</th>
                    {hoursHead}
                    {mode === 'class' && <th className={th}>Учител</th>}
                  </tr>
                </thead>
                <tbody>
                  {main.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/60">
                      {mode === 'teacher' && <td className={`${td} text-slate-700`}>{l.classId ? <Link href={`/classes/${l.classId}`} className="hover:underline">{l.holder}</Link> : l.holder}</td>}
                      <td className={`${td} text-slate-800`}>{l.subject}{kindTag(l)}{therapy(l)}</td>
                      {hours(l)}
                      {mode === 'class' && <td className={`${td} text-slate-700`}>{who(l)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ich.length > 0 && (
            <div className="mt-2">
              <div className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                Индивидуални часове (ИЧ) <span className="normal-case tracking-normal font-normal text-slate-500">— по отделна заповед, не влизат в норматива</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {ich.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50/60">
                        {mode === 'teacher' && <td className={`${td} w-32 text-slate-700`}>{l.holder}</td>}
                        <td className={`${td} text-slate-800`}>{l.subject}{kindTag(l)}{therapy(l)}</td>
                        {hours(l)}
                        {mode === 'class' && <td className={`${td} text-slate-700`}>{who(l)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* сбор */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-5 py-3 mt-2 border-t border-slate-200 bg-slate-50/50 text-[13px] text-slate-600">
            <span>Общо {mode === 'class' ? 'за паралелката' : 'по плана'}: <b className="text-slate-800 tabular-nums">{f(t.h1)}</b> ч./седм.{!same && <> (II срок <b className="text-slate-800 tabular-nums">{f(t.h2)}</b>)</>}
              {kindParts.length > 1 && <span className="text-slate-500"> — {kindParts.map(([k, h]) => `${k} ${f(h)}`).join(' · ')}</span>}</span>
            {mode === 'teacher' && t.therapy1 > 0 && <span>към норматива (терапиите по 0,7): <b className="text-slate-800 tabular-nums">{f(t.n1)}</b>{!same && <> / {f(t.n2)}</>}</span>}
            {(t.ich1 > 0 || t.ich2 > 0) && <span>ИЧ: <b className="text-violet-700 tabular-nums">{f(t.ich1)}</b>{!same && <> / {f(t.ich2)}</>} ч./седм.</span>}
            <span>За годината: <b className="text-slate-800 tabular-nums">{f(t.year)}</b> ч.</span>
            {mode === 'teacher' && norm ? (
              <span className="ml-auto">Норматив <b className="text-slate-800">{norm}</b>
                {(() => { const c1 = overWithIch(t.n1, t.ich1, norm, ichLect), c2 = overWithIch(t.n2, t.ich2, norm, ichLect)
                  return <>{c1.fill > 0 && <span className="text-violet-700"> · ИЧ допълват {f(c1.fill)}</span>}{c1.lect > 0 && <span className="text-violet-700"> · ИЧ лект. {f(c1.lect)}</span>}
                    {' '}· над норматива: <b className="text-teal-700 tabular-nums">{f(c1.over)}</b>{!same && <> / {f(c2.over)}</>} ч./седм.</> })()}
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
