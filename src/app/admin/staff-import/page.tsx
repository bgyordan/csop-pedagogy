// Импорт на данни за педагогическия персонал от НЕИСПУО: образование, квалификации, ПКС, длъжност (без стажа).
// Данните отиват в профила на професионалното портфолио — оттам ги ползват атестирането и ДТВ.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { FileSpreadsheet } from 'lucide-react'
import { fetchAll } from '@/lib/supabase/fetch-all'
import StaffImportClient from './StaffImportClient'

export const dynamic = 'force-dynamic'

export default async function StaffImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(me?.role || '')) redirect('/dashboard')

  const staffRes = await supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, email, phone, position, neispuo_id, is_active')
  const ready = !staffRes.error
  const staff = ready ? staffRes.data
    : (await supabase.from('staff_profiles').select('id, first_name, middle_name, last_name, email, phone, position, is_active')).data?.map((s: any) => ({ ...s, neispuo_id: null }))
  const profiles = await fetchAll(() => supabase.from('pp_profile').select('*').order('staff_id'))

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700">
          <FileSpreadsheet size={22} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Импорт на персонала от НЕИСПУО</h1>
          <p className="text-sm text-slate-500 mt-0.5">Образование, квалификации и ПКС → профил в професионалното портфолио (за атестирането и ДТВ)</p>
        </div>
      </header>
      {(!ready || profiles.error) && (
        <div className="mb-5 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-2xl px-4 py-3">
          Пуснете SQL файла {profiles.error ? '2026-10-26_pro_portfolio.sql, а после ' : ''}2026-10-31_neispuo_staff_import.sql, за да може да се записва.
        </div>
      )}
      <StaffImportClient
        staff={((staff || []) as any[]).map(s => ({ ...s, is_active: s.is_active !== false }))
          .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'bg'))}
        profiles={(profiles.data || []) as any}
      />
    </div>
  )
}
