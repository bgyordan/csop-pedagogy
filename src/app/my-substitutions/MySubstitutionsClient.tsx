'use client'
import Link from 'next/link'
import { UserX, IdCard } from 'lucide-react'
import type { MySubRow } from './page'
import { sofiaTodayIso } from '@/lib/declaration-periods'
import MyDeclarationsCard from '@/components/lecturer/MyDeclarationsCard'

function fmt(d: string) { return d ? d.split('-').reverse().join('.') : '—' }
// дати на заместването: при няколко заместника — само моите дни
const datesOf = (r: MySubRow) => r.myDays || (r.dateFrom === r.dateTo ? fmt(r.dateFrom) : `${fmt(r.dateFrom)} – ${fmt(r.dateTo)}`)


export default function MySubstitutionsClient({ rows }: { rows: MySubRow[] }) {
  const today = sofiaTodayIso()
  // текущи и предстоящи — с паспортите на децата
  const current = rows.filter(r => r.dateTo >= today).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))

  return (
    <div className="space-y-6">
      {/* ── Текущи и предстоящи ── */}
      {current.length > 0 && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Сега замествам</h2>
          <div className="space-y-2">
            {current.map(r => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_4px_rgba(15,34,64,0.06)]">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-500 shrink-0"><UserX size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800">{r.absentName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{datesOf(r)}</div>
                </div>
                {r.absentId && (
                  <Link href={`/passports?staff=${r.absentId}`} target="_blank"
                    title="Паспортите на децата, с които работи отсъстващият колега"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-[13px] text-slate-700 hover:border-[#0f2240]">
                    <IdCard size={14} /> Паспорти на децата
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Декларациите за периода — един бутон, един файл (заместване + над норматив) ── */}
      <MyDeclarationsCard />
    </div>
  )
}
