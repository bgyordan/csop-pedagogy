'use client'

import { useState } from 'react'
import { FileText, Loader2, X, AlertTriangle } from 'lucide-react'
import { generateRuoClassesLetter } from '@/lib/docx-generator'

interface Props {
  yearName: string
  classes: {
    className: string
    students: { name: string; school: string; externalClass: string }[]
  }[]
}

export default function RuoLetterButton({ yearName, classes }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [addressee, setAddressee] = useState('ДО Г-ЖА РАДЕВА')
  const [position, setPosition] = useState('НАЧАЛНИК НА')
  const [institution, setInstitution] = useState('РУО ВАРНА')
  const [director, setDirector] = useState('Светлана Иванова')

  async function generate() {
    const withStudents = classes.filter(c => c.students.length > 0)
    if (withStudents.length === 0) { alert('Няма ученици за включване'); return }
    setBusy(true)
    try {
      await generateRuoClassesLetter(yearName, withStudents, {
        addressee, position, institution, directorName: director,
      })
      setOpen(false)
    } catch (e: any) {
      alert(`Грешка: ${e.message}`)
    }
    setBusy(false)
  }

  const total = classes.reduce((s, c) => s + c.students.length, 0)

  // Проверка за непълни данни
  const missing = classes.flatMap(c =>
    c.students
      .filter(s => !s.school?.trim() || !s.externalClass?.trim())
      .map(s => ({
        name: s.name,
        className: c.className,
        what: [!s.school?.trim() ? 'училище' : null, !s.externalClass?.trim() ? 'клас' : null]
          .filter(Boolean).join(' и '),
      }))
  )

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors">
        <FileText size={14} /> Писмо до РУО
      </button>

      {open && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-3xl border border-slate-200/80 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-medium text-slate-800 text-sm">Писмо до РУО</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {classes.filter(c => c.students.length > 0).length} паралелки · {total} ученика
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-3">
              {missing.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-2">
                    <AlertTriangle size={13} />
                    {missing.length} {missing.length === 1 ? 'ученик е с непълни данни' : 'ученика са с непълни данни'}
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {missing.map((m, i) => (
                      <div key={i} className="text-[11px] text-amber-900 flex justify-between gap-2">
                        <span className="truncate">{m.name}</span>
                        <span className="text-amber-600 whitespace-nowrap">липсва {m.what}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-600 mt-2">
                    Ще излязат с тире. Може да генерирате и да ги допълните после.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">До кого</label>
                <input value={addressee} onChange={e => setAddressee(e.target.value)} className="input w-full text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Длъжност</label>
                  <input value={position} onChange={e => setPosition(e.target.value)} className="input w-full text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Институция</label>
                  <input value={institution} onChange={e => setInstitution(e.target.value)} className="input w-full text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Директор</label>
                <input value={director} onChange={e => setDirector(e.target.value)} className="input w-full text-sm" />
              </div>

              <button onClick={generate} disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#0f2240' }}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                {busy ? 'Генериране...' : 'Свали Word'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
