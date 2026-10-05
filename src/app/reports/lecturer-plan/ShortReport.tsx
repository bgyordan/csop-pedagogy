'use client'
// Кратко: всички от учебния план — Име и годишните лекторски по двете правила.
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Printer } from 'lucide-react'

type Row = { name: string; position: string; norm: number; normYear: number; ich: number; ichW1: number; ichW2: number; diff1: number | null; diff2: number | null; diffY: number | null; simple: number; mixed: number }

const f = (n: number) => String(n).replace('.', ',')
// седмично: „5“ или „5/4“, ако II срок е различен
const ichWeek = (r: Row) => r.ichW1 === r.ichW2 ? f(r.ichW1) : `${f(r.ichW1)}/${f(r.ichW2)}`
// под/над нормата: „+0,2“ / „−3,5“ на седмица (I/II срок, ако са различни); при годишна норма — за годината
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + f(Math.abs(n))
const diffText = (r: Row) => r.diffY !== null ? `${sign(r.diffY)} г.` : r.diff1 === null ? '' : r.diff1 === r.diff2 || r.diff2 === null ? sign(r.diff1) : `${sign(r.diff1)} / ${sign(r.diff2)}`
const diffVal = (r: Row) => r.diffY ?? r.diff1 ?? 0
const normText = (r: Row) => r.normYear ? `${r.normYear} ч. годишно` : r.norm ? `${r.norm} ч./седм.` : 'без норма'

export default function ShortReport({ rows, yearName, unlinked = [] }: { rows: Row[]; yearName: string; unlinked?: { name: string; h: number }[] }) {
  // всички с часове в плана — и тези без лекторски (0), за да се вижда, че са сметнати
  const list = rows.slice().sort((a, b) => a.name.localeCompare(b.name, 'bg'))
  const tS = list.reduce((a, r) => a + r.simple, 0), tM = list.reduce((a, r) => a + r.mixed, 0), tI = list.reduce((a, r) => a + r.ich, 0)
  const H1 = 'Лекторски — терапиите по 0,7', H2 = 'Лекторски — 0,7 до нормата, после по 1'
  function exportXlsx() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['№', 'Име', 'Длъжност', 'Норма', 'Под/над нормата', 'ИЧ за годината (вкл. в лекторските)', H1, H2],
      ...list.map((r, i) => [i + 1, r.name, r.position, normText(r), diffText(r), r.ich ? `${r.ich} (${ichWeek(r)} седм.)` : '', r.simple, r.mixed]),
      [], ['', 'Общо', '', '', '', tI, tS, tM],
    ])
    ws['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 26 }, { wch: 32 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Лекторски')
    XLSX.writeFile(wb, `лекторски_${(yearName || '').replace(/\W+/g, '-')}.xlsx`)
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-4xl">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 print:hidden">
        <span className="text-sm text-slate-500">{list.length} души с часове в учебния план · годишно · {list.filter(r => r.mixed > 0).length} с лекторски</span>
        <div className="ml-auto flex gap-2">
          <button onClick={exportXlsx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border border-slate-200 text-slate-700 hover:border-[#0f2240]"><FileSpreadsheet size={15} /> Excel</button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border border-slate-200 text-slate-700 hover:border-[#0f2240]"><Printer size={15} /> Печат</button>
        </div>
      </div>
      <table className="w-full text-[15px]">
        <thead>
          <tr className="text-left text-[12px] text-slate-500 align-bottom">
            <th className="px-5 py-2 font-medium w-10">№</th>
            <th className="px-2 py-2 font-medium">Име</th>
            <th className="px-2 py-2 font-medium text-center w-20">Норма</th>
            <th className="px-2 py-2 font-medium text-center w-24" title="Натоварването по плана минус нормата — на седмица (I / II срок); при годишна норма — за годината">Под/над<div className="font-normal text-slate-400">нормата</div></th>
            <th className="px-2 py-2 font-medium text-right w-32 text-violet-700" title="Индивидуални часове с ИФО деца за годината — включени в лекторските">ИЧ<div className="font-normal text-slate-400">за годината (седмично)</div></th>
            <th className="px-3 py-2 font-medium text-right w-36">Лекторски<div className="font-normal text-slate-400">терапиите по 0,7</div></th>
            <th className="px-5 py-2 font-medium text-right w-44">Лекторски<div className="font-normal text-slate-400">0,7 до нормата, после по 1</div></th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={r.name + i} className="border-t border-slate-100">
              <td className="px-5 py-2 text-slate-400 tabular-nums">{i + 1}</td>
              <td className="px-2 py-2 text-slate-800">{r.name}{r.position && <div className="text-[11px] text-slate-400">{r.position}</div>}</td>
              <td className="px-2 py-2 text-center tabular-nums text-slate-500 text-[13px]">{r.normYear ? <span title="Годишна норма">{r.normYear} г.</span> : r.norm || <span title="Длъжност без преподавателска норма — всичките часове са лекторски">—</span>}</td>
              <td className={`px-2 py-2 text-center tabular-nums text-[13px] ${diffVal(r) > 0 ? 'text-teal-700' : diffVal(r) < 0 ? 'text-amber-700' : 'text-slate-500'}`}>{diffText(r) || <span className="text-slate-300">—</span>}</td>
              <td className={`px-2 py-2 text-right tabular-nums ${r.ich ? 'text-violet-700' : 'text-slate-300'}`}>{r.ich ? <>{r.ich} <span className="text-[12px] text-violet-400">({ichWeek(r)} седм.)</span></> : '—'}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${r.simple ? 'text-slate-700' : 'text-slate-300'}`}>{r.simple}</td>
              <td className={`px-5 py-2 text-right tabular-nums font-medium ${!r.mixed ? 'text-slate-300 font-normal' : r.mixed !== r.simple ? 'text-teal-800' : 'text-slate-900'}`}>{r.mixed}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Няма лекторски</td></tr>}
        </tbody>
        {list.length > 0 && (
          <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50/70">
            <td /><td className="px-2 py-2.5 font-medium text-slate-700" colSpan={3}>Общо</td>
            <td className="px-2 py-2.5 text-right tabular-nums text-violet-700">{tI || '—'}</td>
            <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">{tS}</td>
            <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-slate-900">{tM}</td>
          </tr></tfoot>
        )}
      </table>
      {unlinked.length > 0 && (
        <div className="mx-5 my-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[13px] text-amber-900">
          <b>Не са в списъка — преподавателят от НЕИСПУО не е свързан със служител в EIS:</b>
          <div className="mt-1">{unlinked.map(u => `${u.name} (${String(u.h).replace('.', ',')} ч./седм.)`).join(' · ')}</div>
          <div className="text-[12px] text-amber-800 mt-1">Свързват се в Администрация → Учебни планове при следващия внос (името от НЕИСПУО → служителя).</div>
        </div>
      )}
      <div className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100 space-y-1">
        <p><b className="text-slate-700">Терапиите по 0,7:</b> всички часове от плана се приравняват към нормата (терапия = 0,7 ч.), вади се нормата; × учебните седмици на срока.</p>
        <p><b className="text-slate-700">0,7 до нормата, после по 1</b> (Наредба № 4/2017, чл. 8 и чл. 10, ал. 2): приравняват се само часовете, които допълват нормата — първо обикновените часове, после терапиите по 0,7; всеки час над нормата е цял лекторски час.</p>
        <p>Норма по длъжност: учител, логопед, рехабилитатор — 21 ч./седм.; психолог, възпитател — 30 ч./седм. (часовете в ЦОУД са с норма 30); ЗДУД и ЗДАСД — 144 ч. годишно; директор — 72 ч. годишно; без преподавателска норма (други) — „—“, всички часове са лекторски. <b className="text-slate-700">ИЧ</b> са часове на учителя като всички останали — влизат в нормата и над нея; колоната „ИЧ“ показва колко от годишните часове са ИЧ (ако част от тях се плащат по отделна заповед, се вижда колко).</p>
      </div>
    </div>
  )
}
