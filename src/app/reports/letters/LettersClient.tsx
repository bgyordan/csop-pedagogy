'use client'
import RuoLetterButton from '../RuoLetterButton'
import { Mail } from 'lucide-react'

interface RuoRow { className: string; students: { name: string; school: string; externalClass: string }[] }

export default function LettersClient({ yearName, ruoData }: { yearName: string; ruoData: RuoRow[] }) {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl" style={{ backgroundColor: '#0f2240' }}><Mail size={20} className="text-white" /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Официални писма — паралелки</h1>
          <p className="text-slate-500 text-sm mt-0.5">{yearName} · списъци на групите и паралелките до РУО / РЦПППО</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Списък на паралелките</h3>
          <p className="text-xs text-slate-500 mb-3">Всички паралелки с децата им (без „Служебна"). Адресат и основания се задават в прозореца преди сваляне.</p>
          <div className="flex flex-wrap gap-2">
            <RuoLetterButton yearName={yearName} classes={ruoData} label="До РУО" />
            <RuoLetterButton yearName={yearName} classes={ruoData} label="До РЦПППО"
              defaultAddressee="ДО Г-ЖА МАРИЯНА ПАНТЕЛЕЕВА" defaultPosition="ДИРЕКТОР НА" defaultInstitution="РЦПППО ГРАД ВАРНА"
              subject="Организиране на групи и паралелки на деца и ученици със специални образователни потребности от училищата от гр. Варна в ЦСОП–Варна за учебната {year} г."
              intro="Предлагам, да ми бъде разрешено сформиране на {N} групи и паралелки с деца и ученици за учебна {year} г., насочени в ЦСОП –Варна на основание чл.195, ал.1 от ЗПУО и чл.185, ал.1 от Наредба за приобщаващо образование." />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
          Изнесени групи (до РЦПППО) — предстои.
        </div>
      </div>
    </div>
  )
}
