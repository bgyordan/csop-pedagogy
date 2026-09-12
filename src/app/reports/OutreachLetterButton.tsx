'use client'
import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { generateOutreachGroupsLetter } from '@/lib/docx-generator'

interface RuoRow { className: string; students: { name: string; school: string; externalClass: string }[] }
interface Group { location: string; items: RuoRow[] }

export default function OutreachLetterButton({ yearName, groups }: { yearName: string; groups: Group[] }) {
  const [busy, setBusy] = useState(false)
  const empty = groups.reduce((a, g) => a + g.items.length, 0) === 0
  async function gen() {
    if (empty) { alert('Няма отбелязани изнесени паралелки. Отбележи ги в Администрация → Паралелки.'); return }
    setBusy(true)
    try { await generateOutreachGroupsLetter(yearName, groups) }
    catch (e: any) { alert(`Грешка: ${e.message}`) }
    setBusy(false)
  }
  return (
    <button onClick={gen} disabled={busy || empty}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} className="text-slate-400" />} Свали Word
    </button>
  )
}
