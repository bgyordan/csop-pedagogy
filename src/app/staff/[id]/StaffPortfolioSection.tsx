import Link from 'next/link'
import { BookUser, ChevronRight } from 'lucide-react'
import { qualificationTotals, fmtNum, INTERNAL_MIN_YEAR, type PPItem } from '@/lib/pro-portfolio'

// Професионалното портфолио в профила на служителя: брой записи, ПКС, вътрешна квалификация за годината.
export default async function StaffPortfolioSection({ supabase, staffId, year }: { supabase: any; staffId: string; year?: { start_date?: string | null; end_date?: string | null } | null }) {
  const [{ data: items, error }, { data: profile }] = await Promise.all([
    supabase.from('pp_items').select('id, section, kind, hours, credits, date_from, date_to, created_at').eq('staff_id', staffId),
    supabase.from('pp_profile').select('pks').eq('staff_id', staffId).maybeSingle(),
  ])
  if (error) return null   // таблиците още ги няма
  const list = (items || []) as PPItem[]
  const t = qualificationTotals(list, year?.start_date, year?.end_date)
  return (
    <Link href={`/pro-portfolio?staff=${staffId}`} className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3.5 mb-5 hover:bg-slate-50">
      <BookUser size={16} className="text-slate-500" />
      <span className="text-sm font-medium text-slate-700 flex-1">Професионално портфолио</span>
      <span className="text-xs text-slate-500">
        {list.length} записа{profile?.pks ? ` · ${profile.pks}` : ''} · вътрешна квалификация тази година{' '}
        <b className={t.internal >= INTERNAL_MIN_YEAR ? 'text-emerald-700' : 'text-amber-700'}>{fmtNum(t.internal)} ч.</b>
      </span>
      <ChevronRight size={16} className="text-slate-400" />
    </Link>
  )
}
