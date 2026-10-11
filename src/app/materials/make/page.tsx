// „Създай табло“ — генератор на табла и карти с пиктограми или свои снимки (PDF за печат / в библиотеката).

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { Wand2 } from 'lucide-react'
import MakeClient from './MakeClient'
export const dynamic = 'force-dynamic'

export default async function MakePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('id').eq('user_id', user.id).single()
  if (!me) redirect('/dashboard')
  const { data: src } = await supabase.from('material_sources').select('id').eq('name', 'Собствен материал').maybeSingle()

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 text-violet-700">
          <Wand2 size={22} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Създай табло</h1>
          <p className="text-sm text-slate-500 mt-0.5">Табло, карти или история за конкретно дете — с пиктограми или свои снимки, готово за печат</p>
        </div>
      </header>
      <MakeClient meId={me.id} ownSourceId={src?.id || null} />
    </div>
  )
}
