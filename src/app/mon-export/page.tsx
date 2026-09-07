import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { FileSpreadsheet } from 'lucide-react'
import MonExportClient from './MonExportClient'
export const dynamic = 'force-dynamic'

export default async function MonExportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!['admin', 'zdud', 'director'].includes(me?.role || '')) redirect('/dashboard')

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-7 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 shadow-sm text-emerald-600">
          <FileSpreadsheet size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Отчет НП „Без свободен час"</h1>
          <p className="text-sm text-slate-500 mt-0.5">Генериране на файл за импорт в платформата на МОН</p>
        </div>
      </header>
      <MonExportClient />
    </div>
  )
}
