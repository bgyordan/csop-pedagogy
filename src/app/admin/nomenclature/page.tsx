import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/ui/BackButton'
import NomenclatureSettings from './NomenclatureSettings'

export default async function NomenclaturePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('staff_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!['admin', 'zdud'].includes(profile?.role || '')) redirect('/dashboard')

  const { data: items } = await supabase
  .from('nomenclature_items')
  .select('id, item_code, name, section_code, retention_years, for_correspondence, for_orders, quick_incoming, quick_outgoing, quick_orders')
    .order('section_code')
    .order('item_code')

  return (
    <div className="p-4 md:p-8">
      <BackButton />
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Номенклатура на делата</h1>
        <p className="text-slate-500 text-sm mt-1">Настройка кои дела се показват при кореспонденция и заповеди</p>
      </div>
      <NomenclatureSettings items={items || []} />
    </div>
  )
}
