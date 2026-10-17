'use client'
// Анализ на дневника: тенденция по месеци, нива, къде и кога, деца с повторения, двойки,
// какво предшества поведението и коя реакция следва, неприключени случаи.

import Link from 'next/link'
import { AlertTriangle, Repeat, Users } from 'lucide-react'
import { KINDS, ROLE_LABEL, fmtDate } from '@/lib/incidents'
import type { Analysis, Case } from '@/lib/incidents'

const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm p-4'
const H = 'text-[13px] font-semibold text-slate-800 mb-3'

function Bars({ rows, color, max = 8 }: { rows: [string, number][]; color: string; max?: number }) {
  if (!rows.length) return <p className="text-[12.5px] text-slate-400">Няма данни.</p>
  const top = Math.max(...rows.map(r => r[1]))
  return (
    <div className="space-y-1.5">
      {rows.slice(0, max).map(([k, n]) => (
        <div key={k} className="flex items-center gap-2 text-[12.5px]">
          <span className="w-40 shrink-0 truncate text-slate-600" title={k}>{k}</span>
          <span className="flex-1 h-4 rounded bg-slate-100 overflow-hidden"><span className="block h-full rounded" style={{ width: `${(n / top) * 100}%`, background: color }} /></span>
          <span className="w-6 text-right tabular-nums text-slate-700">{n}</span>
        </div>
      ))}
    </div>
  )
}

export default function IncidentAnalysis({ a, cases, onOpen }: { a: Analysis; cases: Case[]; onOpen: (id: string) => void }) {
  if (!a.total) return <div className={`${card} text-center py-12 text-sm text-slate-500`}>Няма случаи за избрания период.</div>
  const mMax = Math.max(1, ...a.months.map(m => m.bullying + m.behavior))
  const hMax = Math.max(1, ...Object.values(a.heat))
  const byId = Object.fromEntries(cases.map(c => [c.id, c]))
  return (
    <div className="space-y-4">
      {/* числа */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ['случая', a.total, ''],
          ['тормоз', a.bullying, KINDS.bullying.color],
          ['поведение', a.behavior, KINDS.behavior.color],
          ['неприключени', a.open, a.stale.length ? '#b45309' : ''],
          ['дни до приключване (ср.)', a.avgClose ?? '—', ''],
        ].map(([l, v, c]) => (
          <div key={l as string} className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums" style={{ color: (c as string) || '#1e293b' }}>{v}</div>
            <div className="text-[12px] text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      {a.stale.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3">
          <AlertTriangle size={17} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="text-[13px] text-amber-900">
            <b>{a.stale.length}</b> {a.stale.length === 1 ? 'случай е отворен' : 'случая са отворени'} повече от 2 седмици:{' '}
            {a.stale.slice(0, 8).map(c => <button key={c.id} type="button" onClick={() => onOpen(c.id)} className="underline decoration-dotted mr-2">№ {c.number}</button>)}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* по месеци */}
        <section className={card}>
          <h3 className={H}>По месеци</h3>
          <div className="flex items-end gap-1.5 h-40">
            {a.months.map(m => (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${m.label}: тормоз ${m.bullying}, поведение ${m.behavior}`}>
                <span className="text-[11px] text-slate-500 tabular-nums">{m.bullying + m.behavior || ''}</span>
                <div className="w-full flex flex-col justify-end rounded-md overflow-hidden" style={{ height: `${((m.bullying + m.behavior) / mMax) * 120}px` }}>
                  <div style={{ height: `${(m.behavior / Math.max(1, m.bullying + m.behavior)) * 100}%`, background: KINDS.behavior.color }} />
                  <div style={{ height: `${(m.bullying / Math.max(1, m.bullying + m.behavior)) * 100}%`, background: KINDS.bullying.color }} />
                </div>
                <span className="text-[11px] text-slate-500">{m.label}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 text-[11.5px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: KINDS.bullying.color }} />тормоз</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: KINDS.behavior.color }} />поведение</span>
          </div>
        </section>

        {/* нива */}
        <section className={card}>
          <h3 className={H}>Нива / тежест</h3>
          <table className="w-full text-[13px]">
            <thead><tr className="text-[11.5px] text-slate-500"><th className="text-left font-normal pb-1"></th><th className="font-normal">тормоз</th><th className="font-normal">поведение</th></tr></thead>
            <tbody>
              {a.levels.map(l => (
                <tr key={l.n} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-600">{['', 'I ниво / леко', 'II ниво / средно', 'III ниво / тежко'][l.n]}</td>
                  <td className="text-center tabular-nums">{l.bullying || '—'}</td>
                  <td className="text-center tabular-nums">{l.behavior || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[12px] text-slate-500 mt-3">Уведомен родител: <b>{a.parentsPct}%</b> от случаите.</p>
        </section>

        {/* къде */}
        <section className={card}>
          <h3 className={H}>Къде</h3>
          <Bars rows={a.places} color="#0f2240" />
        </section>

        {/* кога */}
        <section className={card}>
          <h3 className={H}>Кога (ден × час)</h3>
          {a.hours.length === 0 ? <p className="text-[12.5px] text-slate-400">Няма посочен час.</p> : (
            <div className="overflow-x-auto">
              <table className="text-[11.5px] border-separate border-spacing-1">
                <thead><tr><th />{a.hours.map(h => <th key={h} className="font-normal text-slate-500 px-1">{h}ч</th>)}</tr></thead>
                <tbody>
                  {a.days.map(d => (
                    <tr key={d.d}>
                      <td className="text-slate-500 pr-1">{d.label}</td>
                      {a.hours.map(h => {
                        const n = a.heat[`${d.d}|${h}`] || 0
                        return <td key={h} className="w-8 h-7 rounded text-center tabular-nums" title={`${d.label} ${h}:00 — ${n}`}
                          style={{ background: n ? `rgba(185, 28, 28, ${0.15 + 0.75 * (n / hMax)})` : '#f8fafc', color: n / hMax > 0.5 ? '#fff' : '#475569' }}>{n || ''}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={card}>
          <h3 className={H}>Форми / видове поведение</h3>
          <Bars rows={a.forms} color="#b91c1c" />
        </section>

        <section className={card}>
          <h3 className={H}>Какво предшества</h3>
          <Bars rows={a.antecedents} color="#7c3aed" />
          {a.consequences.length > 0 && <>
            <h3 className={`${H} mt-4`}>Какво последва / реакция</h3>
            <Bars rows={a.consequences} color="#0891b2" />
          </>}
        </section>
      </div>

      {/* деца с повторения */}
      <section className={card}>
        <h3 className={`${H} flex items-center gap-2`}><Users size={15} /> Деца с повече от един случай</h3>
        {a.repeat.length === 0 ? <p className="text-[12.5px] text-slate-400">Няма повторения.</p> : (
          <div className="divide-y divide-slate-100">
            {a.repeat.slice(0, 20).map(k => (
              <div key={k.id} className="py-2 flex flex-wrap items-center gap-3">
                <span className={`w-8 h-8 rounded-full text-[13px] font-semibold flex items-center justify-center ${k.total >= 3 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{k.total}</span>
                <div className="flex-1 min-w-[180px]">
                  {k.id.startsWith('name:') ? <span className="text-[14px] text-slate-800">{k.name}</span>
                    : <Link href={`/students/${k.id}`} className="text-[14px] text-slate-800 hover:underline">{k.name}</Link>}
                  <div className="text-[12px] text-slate-500">{Object.entries(k.roles).map(([r, n]) => `${ROLE_LABEL[r as keyof typeof ROLE_LABEL]} ${n}`).join(' · ')} · последно {fmtDate(k.last)}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {k.cases.slice(-6).map(id => byId[id] && <button key={id} type="button" onClick={() => onOpen(id)}
                    className="text-[11.5px] px-1.5 py-0.5 rounded-md border border-slate-200 hover:border-slate-400" style={{ color: KINDS[byId[id].kind].color }}>№ {byId[id].number}</button>)}
                </div>
                {k.total >= 3 && <span className="text-[11.5px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">за план за подкрепа / ЕПЛР</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {a.pairs.length > 0 && (
        <section className={card}>
          <h3 className={`${H} flex items-center gap-2`}><Repeat size={15} /> Повтарящи се двойки (извършител → пострадал)</h3>
          <div className="space-y-1">
            {a.pairs.map(p => <div key={p.a + p.b} className="text-[13px] text-slate-700"><b className="tabular-nums">{p.n}×</b> {p.a} → {p.b}</div>)}
          </div>
        </section>
      )}
    </div>
  )
}
