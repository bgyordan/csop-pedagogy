'use client'
import { useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { generateStudentsBySchoolPDF } from '@/lib/pdf-generator'

type Group = { school: string; externalClass: string; students: { name: string; className: string; classTeacher: string }[] }

export default function BySchoolClient({ groups, yearName }: { groups: Group[]; yearName: string }) {
  const [busy, setBusy] = useState(false)
  async function pdf() {
    setBusy(true)
    try { await generateStudentsBySchoolPDF(groups, yearName) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={pdf} disabled={busy || groups.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: '#0f2240' }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />} Изтегли PDF
        </button>
      </div>
      {groups.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-dashed border-slate-300">Няма ученици с изпращащо училище.</div>
      ) : (
        <div className="space-y-3">
          {groups.map((g, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-800">{g.school}</span>
                <span className="text-xs text-slate-500"> · {g.externalClass} клас · {g.students.length} деца</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {g.students.map((s, j) => (
                    <tr key={j} className={`border-b border-slate-50 last:border-0 ${j % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-4 py-1.5 text-slate-800">{s.name}</td>
                      <td className="px-4 py-1.5 text-slate-500 w-24 text-center">{s.className}</td>
                      <td className="px-4 py-1.5 text-slate-500 w-56">{s.classTeacher}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
