import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { ListChecks } from 'lucide-react'
import { loadLecturerRates } from '@/lib/lecturer-rates'
import CheckClient from './CheckClient'
import RatesPanel from '../lecturer-review/RatesPanel'
export const dynamic = 'force-dynamic'

// „Отчитане лекторски“ — горе периодът, отдолу табове Заместване | Над норматив.
// Деловодството сверява хартиената декларация с реда в системата и отмята.
export default async function LecturerCheckPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director', 'secretary'].includes(me?.role || '')) redirect('/dashboard')
  const rates = await loadLecturerRates(supabase)

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 shadow-sm text-teal-600">
          <ListChecks size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Отчитане лекторски</h1>
          <p className="text-sm text-slate-500 font-light mt-0.5">Подписаните декларации — сверяване със системата, отметки и заповед за изплащане</p>
        </div>
      </header>
      <CheckClient rates={rates} />
      {/* ставките за лекторски час (преместени от старата „Проверка лекторски“) */}
      <div className="mt-10"><RatesPanel rates={rates} /></div>
    </div>
  )
}
