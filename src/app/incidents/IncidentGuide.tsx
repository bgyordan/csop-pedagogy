'use client'
// „Как работи“ — алгоритъмът на дневника на случаите по Механизма за противодействие на тормоза (МОН):
// кой, какво, кога. Показва се горе в Дневника и в Координационния съвет, сгъваем.

import { useEffect, useState } from 'react'
import { ChevronDown, Route } from 'lucide-react'

const STEPS: { who: string; what: React.ReactNode }[] = [
  { who: 'Всеки служител, на място', what: <>Прекратява ситуацията, успокоява децата, при нужда — медицинска помощ. <b>В EIS не пише нищо.</b></> },
  { who: 'Същия ден', what: <>Уведомява <b>ЗДУД/директора</b> и <b>член на К. Съвет</b>. При <b>II и III ниво</b> пише кратка <b>докладна до директора</b> — завежда се в деловодството (вх. №).</> },
  { who: 'Член на К. Съвет или класният', what: <>Вписва случая тук — <b>„Констатирай случай“</b> (или от досието на детето → „Случаи“) → статус <b>Нов</b>. Тормоз <b>I ниво не се вписва</b> (овладява се от учителя), освен ако се повтаря — тогава е II ниво. Поведенческите инциденти се вписват на всички нива — за анализа.</> },
  { who: 'Уведомяване', what: <>Разговорът с родителя се записва в дирята като <b>„Разговор с родител“</b>. При <b>III ниво</b> директорът незабавно подава сигнал до <b>ОЗД/полиция</b> — отбелязва се в „Направено веднага“.</> },
  { who: 'К. Съвет разглежда', what: <>Статус <b>Разглежда се</b>. Заседанието се води в „К. Съвет“ → „Ново заседание“ → „По казус“ → <b>избира се случаят от дневника</b> (нищо не се преписва). <b>Протоколът</b> съдържа решенията; случаят и протоколът се свързват сами.</> },
  { who: 'Мерки', what: <>Всяка мярка се записва в дирята като <b>„Мярка“</b> — каква, кой, докога. Статусът сам става <b>Взети мерки</b>.</> },
  { who: 'Проследяване', what: <>Когато поведението спре — статус <b>Приключен</b> + резултат. Отворени над 2 седмици излизат в „Анализ“.</> },
  { who: 'Класният ръководител', what: <>Вписва случаи и ги поправя, докато са <b>Нови</b>; вижда случаите на децата си (и в досието → <b>„Случаи“</b>), добавя бележки и разговори с родител. Статуса движи съветът.</> },
  { who: 'Края на годината', what: <>К. Съвет изготвя <b>годишен доклад</b> до ръководството — „Анализ“ → <b>„Годишен доклад (Word)“</b> го сглобява от дневника; съветът допълва изводите и подписва.</> },
]

export default function IncidentGuide({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { try { if (localStorage.getItem('incident-guide-open') === '1') setOpen(true) } catch {} }, [])
  const toggle = () => setOpen(v => { const n = !v; try { localStorage.setItem('incident-guide-open', n ? '1' : '0') } catch {}; return n })

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${compact ? '' : 'mb-5'}`}>
      <button type="button" onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/70 rounded-2xl">
        <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0"><Route size={16} /></span>
        <span className="flex-1">
          <span className="block text-[14px] text-slate-800">Как работи — кой, какво, кога</span>
          <span className="block text-[12px] text-slate-500">Докладна — свидетелят · Дневник — К. Съвет · Протокол — заседанието · Годишен доклад — К. Съвет</span>
        </span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="px-4 pb-4 pt-1 space-y-2">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[12px] flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
              <div className="flex-1 text-[13px] text-slate-700 leading-relaxed">
                <span className="text-slate-500">{s.who} — </span>{s.what}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
