import { UserX } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTodayAbsences } from '@/lib/today-absences'

// Лента „Днес отсъстват“ за всички колеги (без управата — тя има картата в OpsPanel).
// Кратко: кой отсъства, до кога, кой го замества — или че не се замества,
// за да не разчита никой на него. Чете през service-role (само имена и дати).
const short = (n: string) => { const [f, l] = n.trim().split(/\s+/); return l ? `${f} ${l[0]}.` : f }
const dm = (iso: string) => iso.split('-').reverse().slice(0, 2).join('.')

export default async function TodayAbsentStrip() {
  let rows: Awaited<ReturnType<typeof getTodayAbsences>> = []
  try { rows = await getTodayAbsences(createAdminClient()) } catch { return null }
  if (rows.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm px-5 py-3.5">
      <div className="flex items-center gap-2 mb-2">
        <UserX size={15} className="text-rose-500" />
        <h2 className="text-sm font-medium text-slate-800">Днес отсъстват</h2>
        <span className="text-xs text-slate-400">{rows.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {rows.map(r => (
          <div key={r.id} className="inline-flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-800">{r.absent}</span>
            {!r.substitutable && r.position && <span className="text-slate-400 text-[12px]">· {r.position.toLowerCase()}</span>}
            <span className="text-slate-400 text-[12px]">до {dm(r.to)}</span>
            {r.by
              ? <span className="text-emerald-700 text-[12px]">→ {r.by.split(', ').map(short).join(', ')}</span>
              : r.substitutable
                ? <span className="text-amber-700 text-[12px]">· без заместник</span>
                : <span className="text-slate-500 text-[12px]">· не се замества</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
