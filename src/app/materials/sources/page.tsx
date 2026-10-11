// „Материали → Източници“ — само за ръководството: откъде са материалите, може ли да се дават на родител, до кога важат.
// Колегите не виждат тази страница; при качване само избират източник от списъка.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import { Settings2 } from 'lucide-react'
import SourcesClient from './SourcesClient'
import type { Source } from '../lib'
export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: me } = await supabase.from('staff_profiles').select('role').eq('user_id', user.id).single()
  if (!me || !['admin', 'zdud', 'director'].includes(me.role)) redirect('/materials')
  const [{ data: srcs }, { data: mats }] = await Promise.all([
    supabase.from('material_sources').select('*').order('sort').order('name'),
    supabase.from('materials').select('source_id'),
  ])
  const counts: Record<string, number> = {}
  ;(mats || []).forEach((m: any) => { if (m.source_id) counts[m.source_id] = (counts[m.source_id] || 0) + 1 })
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <BackButton />
      <header className="flex items-center gap-4 mt-2 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-center shrink-0 w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-600"><Settings2 size={22} /></div>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-800 tracking-tight">Източници на материали</h1>
          <p className="text-sm text-slate-500 mt-0.5">Само за ръководството. Колегите виждат само името при качване — останалото системата прилага сама.</p>
        </div>
      </header>
      <SourcesClient sources={(srcs || []) as Source[]} counts={counts} />
    </div>
  )
}
