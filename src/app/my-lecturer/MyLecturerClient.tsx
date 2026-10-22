'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarClock, Trash2, UserX, IdCard, GraduationCap, ChevronDown } from 'lucide-react'
import type { MySubRow } from '@/lib/my-substitutions'
import { sofiaTodayIso } from '@/lib/declaration-periods'
import { useToast, confirmDialog } from '@/components/ui/Toast'
import { deleteMyDeclaration } from './actions'
import MyDeclarationsCard from '@/components/lecturer/MyDeclarationsCard'

type Slot = { id: string; day: number; period: number; subject: string; holderType?: string; holderLabel: string; dateFrom: string; dateTo: string; orderNumber: string }
type Decl = { id: string; periodFrom: string; periodTo: string; totalHours: number; status: string }
const DAY_L = ['', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък']
function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '' }
// дати на заместването: при няколко заместника — само моите дни
const datesOf = (r: MySubRow) => r.myDays || (r.dateFrom === r.dateTo ? fmt(r.dateFrom) : `${fmt(r.dateFrom)} – ${fmt(r.dateTo)}`)
const STATUS: Record<string, { l: string; c: string }> = {
  submitted: { l: 'Подадена', c: 'bg-blue-50 text-blue-600' },
  verified: { l: 'Проверена', c: 'bg-emerald-50 text-emerald-600' },
  paid: { l: 'Изплатена', c: 'bg-slate-100 text-slate-500' },
}

export default function MyLecturerClient({ slots, subs, declarations: initialDecls }: {
  teacherName: string; position: string; slots: Slot[]; subs: MySubRow[]; declarations: Decl[]; suggestFrom?: string
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

  const today = sofiaTodayIso()
  const currentSubs = subs.filter(r => r.dateTo >= today).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
  const pastSubs = subs.filter(r => r.dateTo < today)
  const [showPast, setShowPast] = useState(false)
  const sectionHead = 'flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2'

  return (
    <div className="space-y-5">
      {/* Декларациите за периода — един бутон, един файл (над норматив + ИФО + заместване) */}
      <MyDeclarationsCard onDone={() => router.refresh()} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Заместване ── */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className={sectionHead}><UserX size={14} /> Заместване</div>
          {currentSubs.length === 0 && pastSubs.length === 0 && (
            <p className="text-sm text-slate-400 font-light">Нямате замествания тази година.</p>
          )}
          {currentSubs.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] text-slate-400">Сега и предстоящи</div>
              {currentSubs.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/40">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-800">{r.absentName}{r.bsch && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">НП</span>}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{datesOf(r)}</div>
                  </div>
                  {r.absentId && (
                    <Link href={`/passports?staff=${r.absentId}`} target="_blank" title="Паспортите на децата, с които работи отсъстващият колега"
                      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-300 text-[12px] text-slate-700 hover:border-[#0f2240] bg-white">
                      <IdCard size={13} /> Паспорти
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
          {currentSubs.length === 0 && pastSubs.length > 0 && <p className="text-sm text-slate-400 font-light">В момента не замествате.</p>}
          {pastSubs.length > 0 && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowPast(v => !v)} className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-slate-800">
                <ChevronDown size={13} className={`transition-transform ${showPast ? 'rotate-180' : ''}`} /> Предишни ({pastSubs.length})
              </button>
              {showPast && (
                <div className="mt-2 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {pastSubs.map((r, i) => (
                    <div key={r.id} className={`flex items-center gap-2 px-3 py-1.5 text-[13px] ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                      <span className="text-slate-700 flex-1 min-w-0 truncate">{r.absentName}</span>
                      {r.bsch && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">НП</span>}
                      <span className="text-slate-500 tabular-nums">{datesOf(r)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Над норматив (рамка от заповедта) ── */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className={sectionHead}><GraduationCap size={14} /> Над норматив — по заповед</div>
          {slots.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 font-light"><CalendarClock size={16} className="text-slate-300" /> Нямате определени часове над норматива.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm">
                  {DAY_L[s.day]} {s.period}. час · {s.subject} {s.holderLabel && <span className="text-slate-400">· {s.holderLabel}</span>}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

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
                      if (!await confirmDialog('Изтрий тази декларация?')) return
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
