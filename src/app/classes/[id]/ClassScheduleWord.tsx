'use client'
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { generateClassSchedule } from '@/lib/docx-generator'

export default function ClassScheduleWord({ className, yearName, slots, maxPeriod, term }: {
  className: string
  yearName: string
  slots: Record<string, string>   // "ден-час" -> предмет
  maxPeriod: number
  term: number
}) {
  const [busy, setBusy] = useState(false)
  const empty = Object.keys(slots).length === 0
  async function download() {
    setBusy(true)
    try {
      await generateClassSchedule(
        `Паралелка ${className}`,
        `${term === 1 ? 'I' : 'II'} срок · ${yearName}`,
        yearName, slots, maxPeriod
      )
    } catch (e) { /* noop */ }
    setBusy(false)
  }
  return (
    <button onClick={download} disabled={busy || empty}
      title={empty ? 'Няма въведено разписание' : 'Изтегли разписание (Word)'}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 shadow-sm transition-all">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      Разписание (Word)
    </button>
  )
}
