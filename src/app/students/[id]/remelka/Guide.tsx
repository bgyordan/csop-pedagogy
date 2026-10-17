'use client'
// Наръчник по РЕМЕЛКА за колегите — принципите, нивата на действие и идеи по областите.
// Наш текст по принципите на методиката; авторските тестове и материали се ползват от наръчниците.

import { X, BookOpen } from 'lucide-react'
import { PRINCIPLES, LEVELS, LEVEL_COLOR, LEVEL_TEXT, AREA_IDEAS, PARTS } from '@/lib/remelka'

export default function Guide({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-3xl mx-auto my-0 md:my-8 bg-white md:rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex items-center gap-3 px-6 py-4 border-b border-slate-200">
          <BookOpen size={18} className="text-indigo-600" />
          <h2 className="flex-1 text-base text-[#0f2240]">РЕМЕЛКА — наръчник за работа</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-6 text-slate-700">
          <p className="text-[13.5px] leading-relaxed">
            РЕМЕЛКА е методика за обучение по смятане и социални умения на деца с обучителни затруднения (българска адаптация на нидерландска методика).
            Детето първо прави диагностика, която показва <b>къде и как</b> греши; после получава програма, насочена точно към тези грешки,
            с игри и примери от ежедневието.
          </p>

          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Как работим — 8 принципа</h3>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {PRINCIPLES.map((p, i) => (
                <div key={p.title} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="text-[14px] font-medium text-slate-800"><span className="text-indigo-500 mr-1.5">{i + 1}.</span>{p.title}</div>
                  <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">{p.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Нивата в ЕИС</h3>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {(['math', 'social'] as const).map(p => (
                <div key={p} className="rounded-2xl border border-slate-200 px-4 py-3">
                  <div className="text-[12px] font-medium mb-1.5" style={{ color: PARTS[p].color }}>{PARTS[p].label}</div>
                  {LEVELS[p].map(l => (
                    <div key={l.n} className="flex items-center gap-2 text-[12.5px] py-0.5">
                      <span className="w-5 h-5 rounded-md text-[11px] font-semibold flex items-center justify-center" style={{ background: LEVEL_COLOR[l.n], color: LEVEL_TEXT[l.n] }}>{l.n}</span>{l.label}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-[12px] text-slate-500 mt-2">Трудно ли е на дадено ниво — върнете се едно ниво назад, вместо да повтаряте същото.
              Умението е „овладяно“, когато детето е <b>само</b> на целевото ниво три занимания подред — ЕИС подсказва кога.</p>
          </section>

          <section>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Идеи по областите</h3>
            <div className="space-y-2">
              {Object.entries(AREA_IDEAS).map(([area, ideas]) => (
                <div key={area} className="rounded-xl bg-slate-50 px-4 py-2.5">
                  <div className="text-[13px] font-medium text-slate-800">{area}</div>
                  <ul className="text-[12.5px] text-slate-600 list-disc pl-5 mt-0.5">{ideas.map(x => <li key={x}>{x}</li>)}</ul>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-slate-500 mt-2">Готови тематични листове за печат по всяко умение и ниво — „РЕМЕЛКА“ → „Работни листове“ (или бутона „Лист“ до умението в програмата). Пиктограми — в „Материали“; дневният режим — във „Визуален график“.</p>
          </section>

          <p className="text-[11.5px] text-slate-400 border-t border-slate-100 pt-3">
            Текстовете в ЕИС са наши, по принципите на методиката. Авторските тестове и материали на РЕМЕЛКА се ползват от наръчниците —
            каталогът с уменията се приспособява към тях от координаторите („РЕМЕЛКА“ → „Каталог“).
          </p>
        </div>
      </div>
    </div>
  )
}
