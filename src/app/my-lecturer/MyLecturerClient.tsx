'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { deleteMyDeclaration } from './actions'
import MyDeclarationsCard from '@/components/lecturer/MyDeclarationsCard'

type Slot = { id: string; day: number; period: number; subject: string; holderType?: string; holderLabel: string; dateFrom: string; dateTo: string; orderNumber: string }
type Decl = { id: string; periodFrom: string; periodTo: string; totalHours: number; status: string }
const DAY_L = ['', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък']
function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '' }
const STATUS: Record<string, { l: string; c: string }> = {
  submitted: { l: 'Подадена', c: 'bg-blue-50 text-blue-600' },
  verified: { l: 'Проверена', c: 'bg-emerald-50 text-emerald-600' },
  paid: { l: 'Изплатена', c: 'bg-slate-100 text-slate-500' },
}

export default function MyLecturerClient({ slots, declarations: initialDecls }: {
  teacherName: string; position: string; slots: Slot[]; declarations: Decl[]; suggestFrom?: string
  /** „Заповед № 80/10.10.2025г.“ — от регистъра (над норматив / ИФО) */
  orderOver?: string; orderIfo?: string
  /** логопед: колона „Учебен час“ (часът от графика) вместо паралелката, предметът — по учебния план */
  isSpeech?: boolean
  rate?: number   // ставка €/час над норматив (lecturer_rates) — попълва реда в декларацията
}) {
  const { toast } = useToast()
  const [declarations, setDeclarations] = useState<Decl[]>(initialDecls)
  const router = useRouter()
  useEffect(() => { setDeclarations(initialDecls) }, [initialDecls])

  if (slots.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-14 text-center">
        <CalendarClock size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">Нямате определени лекторски часове над норматива.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Моите слотове (рамка от заповедта) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Определени лекторски (по заповед)</div>
        <div className="flex flex-wrap gap-2">
          {slots.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm">
              {DAY_L[s.day]} {s.period}. час · {s.subject} {s.holderLabel && <span className="text-slate-400">· {s.holderLabel}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Декларациите за периода — един бутон, един файл (над норматив + ИФО + заместване) */}
      <MyDeclarationsCard onDone={() => router.refresh()} />

      {/* Предишни декларации */}
      {declarations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 text-sm font-semibold text-slate-800">Подадени декларации</div>
          <div className="divide-y divide-slate-100">
            {declarations.map(d => {
              const st = STATUS[d.status] || STATUS.submitted
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 group">
                  <div className="flex-1 text-sm text-slate-700">{fmt(d.periodFrom)} – {fmt(d.periodTo)} · <span className="font-medium">{d.totalHours} ч.</span></div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${st.c}`}>{st.l}</span>
                  {d.status === 'submitted' && (
                    <button onClick={async () => {
                      if (!confirm('Изтрий тази декларация?')) return
                      const r: any = await deleteMyDeclaration(d.id)
                      if (r.error) { toast(r.error, 'error'); return }
                      setDeclarations(prev => prev.filter(x => x.id !== d.id))
                      toast('Изтрито')
                    }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100" title="Изтрий"><Trash2 size={14} /></button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
