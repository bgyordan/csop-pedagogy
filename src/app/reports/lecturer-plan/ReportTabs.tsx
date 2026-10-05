'use client'
// Два изгледа на справката: по учители (лекторски) и по паралелки (както е във вноса от НЕИСПУО).
import { useState } from 'react'
import { UserRound, Users, ListOrdered } from 'lucide-react'

export default function ReportTabs({ short, teachers, classes }: { short: React.ReactNode; teachers: React.ReactNode; classes: React.ReactNode }) {
  const [tab, setTab] = useState<'short' | 'teachers' | 'classes'>('short')
  const T = (k: typeof tab, label: string, Icon: any) => (
    <button type="button" onClick={() => setTab(k)}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === k ? 'bg-white shadow-sm text-[#0f2240] font-medium' : 'text-slate-500 hover:text-slate-800'}`}>
      <Icon size={15} /> {label}
    </button>
  )
  return (
    <div className="space-y-4">
      <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 print:hidden">
        {T('short', 'Кратко', ListOrdered)}
        {T('teachers', 'По учители', UserRound)}
        {T('classes', 'По паралелки', Users)}
      </div>
      {/* и двата остават в паметта — филтрите не се губят при смяна */}
      <div className={tab === 'short' ? '' : 'hidden'}>{short}</div>
      <div className={tab === 'teachers' ? '' : 'hidden'}>{teachers}</div>
      <div className={tab === 'classes' ? '' : 'hidden'}>{classes}</div>
    </div>
  )
}
